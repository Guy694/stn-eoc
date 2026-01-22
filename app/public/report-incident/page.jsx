"use client";
import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import dynamic from 'next/dynamic';
import { showWarning } from '@/lib/sweetAlert';
import { useAuth } from '@/context/AuthContext';

// Import Leaflet components with no SSR
const MapContainer = dynamic(() => import('react-leaflet').then(mod => mod.MapContainer), { ssr: false });
const TileLayer = dynamic(() => import('react-leaflet').then(mod => mod.TileLayer), { ssr: false });
const Marker = dynamic(() => import('react-leaflet').then(mod => mod.Marker), { ssr: false });

// Create a separate component for map click handling
const MapClickHandler = dynamic(
    () => import('react-leaflet').then((mod) => {
        const { useMapEvents } = mod;

        function MapClickHandlerInner({ setPosition }) {
            useMapEvents({
                click(e) {
                    setPosition(e.latlng);
                },
            });
            return null;
        }

        return MapClickHandlerInner;
    }),
    { ssr: false }
);

// Location Marker Component
function LocationMarker({ position, setPosition }) {
    return (
        <>
            <MapClickHandler setPosition={setPosition} />
            {position && <Marker position={position} />}
        </>
    );
}

export default function ReportIncidentPage() {
    const [mounted, setMounted] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [submitSuccess, setSubmitSuccess] = useState(false);
    const [submitError, setSubmitError] = useState('');

    const { user } = useAuth(); // Get logged-in user (citizen or officer)

    // Form data
    const [formData, setFormData] = useState({
        firstName: '',
        lastName: '',
        nationalId: '', // เลขบัตรประชาชน
        phone: '',
        village: '',
        subDistrict: '',
        district: '',
        description: '',
        waterLevel: '',
        affectedPeople: '',
        urgency: 'medium',
        travelStatus: '', // สถานะการสัญจร
        reportType: 'help_request', // ประเภทรายงาน
        disasterType: 'flood', // ประเภทภัย
        occurredAt: ''
    });

    // Photos state (multiple photos)
    const [photos, setPhotos] = useState([]);
    const MAX_PHOTOS = 5;

    // Village autocomplete
    const [villages, setVillages] = useState([]);
    const [showVillageDropdown, setShowVillageDropdown] = useState(false);
    const [searchingVillage, setSearchingVillage] = useState(false);
    const villageInputRef = useRef(null);

    // Map position
    const [markerPosition, setMarkerPosition] = useState(null);
    const defaultCenter = [6.6238, 100.0750]; // Satun coordinates

    useEffect(() => {
        setMounted(true);
        // Set default occurrence time to now
        const now = new Date();
        const localDateTime = new Date(now.getTime() - now.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
        setFormData(prev => ({ ...prev, occurredAt: localDateTime }));

        // Fix Leaflet marker icon issue in Next.js
        if (typeof window !== 'undefined') {
            import('leaflet').then((L) => {
                delete L.Icon.Default.prototype._getIconUrl;
                L.Icon.Default.mergeOptions({
                    iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
                    iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
                    shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
                });
            });
        }
    }, []);

    // Auto-fill form when user is logged in (citizen)
    useEffect(() => {
        if (user && user.role === 'citizen') {
            // Pre-fill data from ThaiID
            const givenName = user.thaiIdData?.given_name || user.givenName || '';
            const familyName = user.thaiIdData?.family_name || user.familyName || '';

            setFormData(prev => ({
                ...prev,
                firstName: givenName,
                lastName: familyName
            }));
        }
    }, [user]);

    const handleInputChange = (e) => {
        const { name, value } = e.target;
        setFormData(prev => ({
            ...prev,
            [name]: value
        }));

        // If village field changed, search for villages
        if (name === 'village' && value.length >= 2) {
            searchVillages(value);
        } else if (name === 'village' && value.length < 2) {
            setVillages([]);
            setShowVillageDropdown(false);
        }
    };

    // Search villages from database
    const searchVillages = async (searchTerm) => {
        setSearchingVillage(true);
        try {
            const response = await fetch(`/api/public/villages?search=${encodeURIComponent(searchTerm)}`);
            const result = await response.json();

            if (result.success) {
                setVillages(result.data);
                setShowVillageDropdown(result.data.length > 0);
            }
        } catch (error) {
            console.error('Village search error:', error);
        } finally {
            setSearchingVillage(false);
        }
    };

    // Select village from dropdown
    const selectVillage = (village) => {
        setFormData(prev => ({
            ...prev,
            village: village.name,
            subDistrict: village.subDistrict,
            district: village.district
        }));
        setShowVillageDropdown(false);
        setVillages([]);
    };

    // Close dropdown when clicking outside
    useEffect(() => {
        const handleClickOutside = (event) => {
            if (villageInputRef.current && !villageInputRef.current.contains(event.target)) {
                setShowVillageDropdown(false);
            }
        };

        document.addEventListener('mousedown', handleClickOutside);
        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, []);

    const handleFileChange = (e) => {
        const file = e.target.files[0];
        if (file) {
            // Check file size (max 5MB)
            if (file.size > 5 * 1024 * 1024) {
                showWarning('ขนาดไฟล์ใหญ่เกินไป (สูงสุด 5MB)');
                return;
            }
            setFormData(prev => ({
                ...prev,
                photo: file
            }));
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();

        // Validation
        if (!formData.firstName || !formData.lastName) {
            showWarning('กรุณากรอกชื่อ-นามสกุล');
            return;
        }
        if (!formData.phone) {
            showWarning('กรุณากรอกเบอร์โทรศัพท์');
            return;
        }
        if (!markerPosition) {
            showWarning('กรุณาปักหมุดตำแหน่งที่เกิดเหตุบนแผนที่');
            return;
        }
        if (!formData.description) {
            showWarning('กรุณาอธิบายเหตุการณ์');
            return;
        }

        setIsSubmitting(true);
        setSubmitError('');

        try {
            const formDataToSend = new FormData();

            // Add all form fields
            Object.keys(formData).forEach(key => {
                if (formData[key] && key !== 'photo') {
                    formDataToSend.append(key, formData[key]);
                }
            });

            // Add location
            if (markerPosition) {
                formDataToSend.append('latitude', markerPosition.lat);
                formDataToSend.append('longitude', markerPosition.lng);
            }

            // Add photo
            if (formData.photo) {
                formDataToSend.append('photo', formData.photo);
            }

            const response = await fetch('/api/public/report-incident', {
                method: 'POST',
                body: formDataToSend
            });

            const result = await response.json();

            if (result.success) {
                setSubmitSuccess(true);
                // Reset form
                setFormData({
                    firstName: '',
                    lastName: '',
                    phone: '',
                    village: '',
                    subDistrict: '',
                    district: '',
                    description: '',
                    waterLevel: '',
                    affectedPeople: '',
                    urgency: 'medium',
                    travelStatus: '',
                    reportType: 'help_request',
                    disasterType: 'flood',
                    occurredAt: new Date().toISOString().slice(0, 16),
                    photo: null
                });
                setMarkerPosition(null);

                // Scroll to top
                window.scrollTo({ top: 0, behavior: 'smooth' });
            } else {
                setSubmitError(result.message || 'เกิดข้อผิดพลาดในการส่งข้อมูล');
            }
        } catch (error) {
            console.error('Submit error:', error);
            setSubmitError('ไม่สามารถเชื่อมต่อกับเซิร์ฟเวอร์ได้');
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-cyan-50">
            {/* Header */}
            <header className="bg-gradient-to-r from-blue-600 to-cyan-600 text-white py-4 md:py-6 shadow-lg">
                <div className="container mx-auto px-4 md:px-6">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 md:w-12 md:h-12 bg-white rounded-full flex items-center justify-center">
                                <span className="text-2xl md:text-3xl">💧</span>
                            </div>
                            <div>
                                <h1 className="text-xl md:text-3xl font-bold">แจ้งเหตุน้ำท่วม</h1>
                                <p className="text-xs md:text-sm text-blue-100">Flood Incident Report</p>
                            </div>
                        </div>
                        <Link
                            href="/"
                            className="bg-white/20 hover:bg-white/30 text-white px-3 py-2 md:px-4 md:py-2 rounded-lg font-semibold transition-all backdrop-blur-sm text-sm md:text-base"
                        >
                            ← กลับหน้าหลัก
                        </Link>
                    </div>
                </div>
            </header>

            <main className="container mx-auto px-3 md:px-6 py-4 md:py-8">
                {/* Success Message */}
                {submitSuccess && (
                    <div className="bg-green-100 border-2 border-green-500 text-green-800 rounded-xl p-4 md:p-6 mb-4 md:mb-6 shadow-lg animate-pulse">
                        <div className="flex items-center gap-3">
                            <span className="text-3xl md:text-4xl">✅</span>
                            <div>
                                <h3 className="font-bold text-lg md:text-xl mb-1">ส่งรายงานเรียบร้อยแล้ว!</h3>
                                <p className="text-sm md:text-base">ขอบคุณที่แจ้งข้อมูล เจ้าหน้าที่จะดำเนินการตรวจสอบโดยเร็วที่สุด</p>
                            </div>
                        </div>
                    </div>
                )}

                {/* Error Message */}
                {submitError && (
                    <div className="bg-red-100 border-2 border-red-500 text-red-800 rounded-xl p-4 md:p-6 mb-4 md:mb-6 shadow-lg">
                        <div className="flex items-center gap-3">
                            <span className="text-3xl md:text-4xl">❌</span>
                            <div>
                                <h3 className="font-bold text-lg md:text-xl mb-1">เกิดข้อผิดพลาด</h3>
                                <p className="text-sm md:text-base">{submitError}</p>
                            </div>
                        </div>
                    </div>
                )}

                {/* Info Box */}
                <div className="bg-blue-50 border-2 border-blue-200 rounded-xl p-4 md:p-6 mb-4 md:mb-6 shadow-md">
                    <div className="flex items-start gap-3">
                        <span className="text-3xl md:text-4xl">ℹ️</span>
                        <div className="flex-1">
                            <h3 className="font-bold text-lg md:text-xl text-blue-900 mb-2">คำแนะนำการแจ้งเหตุ</h3>
                            <ul className="space-y-1 text-sm md:text-base text-blue-800">
                                <li>• กรอกข้อมูลให้ครบถ้วนเพื่อความรวดเร็วในการช่วยเหลือ</li>
                                <li>• ปักหมุดบนแผนที่ให้ตรงกับตำแหน่งที่เกิดเหตุ</li>
                                <li>• ถ่ายภาพสถานการณ์เพื่อให้เจ้าหน้าที่ประเมินความรุนแรง</li>
                                <li>• ระบุระดับน้ำและจำนวนผู้ประสบภัย (ถ้าทราบ)</li>
                            </ul>
                        </div>
                    </div>
                </div>

                {/* Report Type Selection */}
                <div className="bg-gradient-to-r from-blue-50 to-cyan-50 border-2 border-blue-200 rounded-xl p-4 md:p-6 mb-4 md:mb-6 shadow-md">
                    <h3 className="font-bold text-lg md:text-xl text-blue-900 mb-3 md:mb-4 flex items-center gap-2">
                        <span className="text-2xl">📋</span>
                        เลือกประเภทการแจ้ง
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3 md:gap-4">
                        {/* Help Request */}
                        <button
                            type="button"
                            onClick={() => setFormData(prev => ({ ...prev, reportType: 'help_request' }))}
                            className={`p-4 md:p-6 rounded-xl border-2 transition-all text-left ${formData.reportType === 'help_request'
                                ? 'border-red-500 bg-red-50 shadow-lg scale-105'
                                : 'border-gray-300 bg-white hover:border-red-300 hover:bg-red-50'
                                }`}
                        >
                            <div className="flex items-start gap-3">
                                <div className="text-4xl md:text-5xl">🆘</div>
                                <div className="flex-1">
                                    <h4 className="font-bold text-base md:text-lg text-red-700 mb-1">แจ้งความช่วยเหลือ</h4>
                                    <p className="text-xs md:text-sm text-gray-600">
                                        สำหรับผู้ประสบภัยที่ต้องการความช่วยเหลือ เช่น ขอเสบียง อาหาร น้ำดื่ม หรือขอการอพยพ
                                    </p>
                                    {formData.reportType === 'help_request' && (
                                        <div className="mt-2 text-xs md:text-sm text-red-600 font-semibold flex items-center gap-1">
                                            <span>✓</span> เลือกแล้ว
                                        </div>
                                    )}
                                </div>
                            </div>
                        </button>

                        {/* Traffic Report */}
                        <button
                            type="button"
                            onClick={() => setFormData(prev => ({ ...prev, reportType: 'traffic_report' }))}
                            className={`p-4 md:p-6 rounded-xl border-2 transition-all text-left ${formData.reportType === 'traffic_report'
                                ? 'border-orange-500 bg-orange-50 shadow-lg scale-105'
                                : 'border-gray-300 bg-white hover:border-orange-300 hover:bg-orange-50'
                                }`}
                        >
                            <div className="flex items-start gap-3">
                                <div className="text-4xl md:text-5xl">🚧</div>
                                <div className="flex-1">
                                    <h4 className="font-bold text-base md:text-lg text-orange-700 mb-1">แจ้งเส้นทางการจราจร</h4>
                                    <p className="text-xs md:text-sm text-gray-600">
                                        สำหรับรายงานสภาพถนน เส้นทางปิด หรือสถานการณ์การจราจรที่ได้รับผลกระทบ
                                    </p>
                                    {formData.reportType === 'traffic_report' && (
                                        <div className="mt-2 text-xs md:text-sm text-orange-600 font-semibold flex items-center gap-1">
                                            <span>✓</span> เลือกแล้ว
                                        </div>
                                    )}
                                </div>
                            </div>
                        </button>
                    </div>
                </div>

                {/* ThaiID Login Section - Show only if not logged in */}
                {!user && (
                    <div className="bg-blue-50 border-2 border-blue-200 rounded-xl p-6 mb-6">
                        <div className="flex items-start gap-4">
                            <span className="text-4xl">🔐</span>
                            <div className="flex-1">
                                <h3 className="text-xl font-bold text-gray-800 mb-2">
                                    เข้าสู่ระบบด้วย ThaiID
                                </h3>
                                <p className="text-gray-600 mb-4">
                                    กรอกข้อมูลอัตโนมัติจากบัตรประชาชน (ชื่อ, นามสกุล, เลขบัตร)
                                </p>
                                <button
                                    type="button"
                                    onClick={() => window.location.href = '/api/auth/citizen-thaiid/authorize'}
                                    className="bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white px-6 py-3 rounded-lg font-semibold shadow-lg hover:shadow-xl transition-all hover:scale-105 flex items-center gap-2"
                                >
                                    <span className="text-xl">🇹🇭</span>
                                    <span>เข้าสู่ระบบด้วย ThaiID</span>
                                </button>
                            </div>
                        </div>
                    </div>
                )}

                {/* Logged In Status */}
                {/* Logged in as Citizen */}
                {user && user.role === 'citizen' && (
                    <div className="bg-green-50 border-2 border-green-200 rounded-xl p-4 mb-6">
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                                <span className="text-2xl">✅</span>
                                <div>
                                    <p className="font-semibold text-gray-800">
                                        ยืนยันตัวตนด้วย ThaiID
                                    </p>
                                    <p className="text-sm text-gray-600">
                                        {user.givenName} {user.familyName}
                                    </p>
                                </div>
                            </div>
                            <button
                                type="button"
                                onClick={async () => {
                                    await fetch('/api/auth/citizen-thaiid/session', { method: 'DELETE' });
                                    setCitizenSession(null);
                                    setFormData(prev => ({
                                        ...prev,
                                        firstName: '',
                                        lastName: '',
                                        nationalId: ''
                                    }));
                                }}
                                className="text-sm text-red-600 hover:text-red-800 font-medium"
                            >
                                ออกจากระบบ
                            </button>
                        </div>
                    </div>
                )}

                {/* Form */}
                <form onSubmit={handleSubmit} className="bg-white rounded-xl shadow-xl p-4 md:p-8">
                    {/* Personal Information Section */}
                    <div className="mb-6 md:mb-8">
                        <h2 className="text-xl md:text-2xl font-bold text-gray-800 mb-4 md:mb-6 flex items-center gap-2">
                            <span className="text-2xl md:text-3xl">👤</span>
                            ข้อมูลผู้แจ้ง
                        </h2>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6">
                            {/* First Name */}
                            <div>
                                <label className="block text-sm md:text-base font-semibold text-gray-700 mb-2">
                                    ชื่อ <span className="text-red-500">*</span>
                                </label>
                                <input
                                    type="text"
                                    name="firstName"
                                    value={formData.firstName}
                                    onChange={handleInputChange}
                                    className="text-gray-700 w-full px-3 md:px-4 py-2 md:py-3 border-2 border-gray-300 rounded-lg focus:border-blue-500 focus:outline-none text-sm md:text-base"
                                    placeholder="ระบุชื่อ"
                                    required
                                />
                            </div>

                            {/* Last Name */}
                            <div>
                                <label className="block text-sm md:text-base font-semibold text-gray-700 mb-2">
                                    นามสกุล <span className="text-red-500">*</span>
                                </label>
                                <input
                                    type="text"
                                    name="lastName"
                                    value={formData.lastName}
                                    onChange={handleInputChange}
                                    className="text-gray-700 w-full px-3 md:px-4 py-2 md:py-3 border-2 border-gray-300 rounded-lg focus:border-blue-500 focus:outline-none text-sm md:text-base"
                                    placeholder="ระบุนามสกุล"
                                    required
                                />
                            </div>

                            {/* Phone */}
                            <div>
                                <label className="block text-sm md:text-base font-semibold text-gray-700 mb-2">
                                    เบอร์โทรศัพท์ <span className="text-red-500">*</span>
                                </label>
                                <input
                                    type="tel"
                                    name="phone"
                                    value={formData.phone}
                                    onChange={handleInputChange}
                                    className="text-gray-700 w-full px-3 md:px-4 py-2 md:py-3 border-2 border-gray-300 rounded-lg focus:border-blue-500 focus:outline-none text-sm md:text-base"
                                    placeholder="0812345678"
                                    pattern="[0-9]{10}"
                                    required
                                />
                            </div>

                            {/* National ID */}
                            <div>
                                <label className="block text-sm md:text-base font-semibold text-gray-700 mb-2">
                                    เลขบัตรประชาชน {user && user.role === 'citizen' && <span className="text-green-600 text-sm">(ยืนยันจาก ThaiID ✓)</span>}
                                </label>
                                <input
                                    type="text"
                                    name="nationalId"
                                    value={formData.nationalId || ''}
                                    onChange={handleInputChange}
                                    disabled={user && user.role === 'citizen'}
                                    maxLength="13"
                                    className={`text-gray-700 w-full px-3 md:px-4 py-2 md:py-3 border-2 rounded-lg focus:outline-none text-sm md:text-base ${user && user.role === 'citizen'
                                        ? 'bg-green-50 border-green-300 cursor-not-allowed'
                                        : 'border-gray-300 focus:border-blue-500'
                                        }`}
                                    placeholder="เลขบัตรประชาชน 13 หลัก (ไม่บังคับ)"
                                />
                                {user && user.role === 'citizen' && (
                                    <p className="text-xs text-green-600 mt-1">
                                        ข้อมูลนี้ได้รับการยืนยันจากระบบ ThaiID
                                    </p>
                                )}
                            </div>

                            {/* Village */}
                            <div className="relative" ref={villageInputRef}>
                                <label className="block text-sm md:text-base font-semibold text-gray-700 mb-2">
                                    หมู่บ้าน/ชุมชน
                                </label>
                                <input
                                    type="text"
                                    name="village"
                                    value={formData.village}
                                    onChange={handleInputChange}
                                    className="text-gray-700 w-full px-3 md:px-4 py-2 md:py-3 border-2 border-gray-300 rounded-lg focus:border-blue-500 focus:outline-none text-sm md:text-base"
                                    placeholder="พิมพ์ชื่อหมู่บ้าน..."
                                    autoComplete="off"
                                />
                                {searchingVillage && (
                                    <div className="absolute right-3 top-11 text-gray-400">
                                        <span className="animate-spin">🔄</span>
                                    </div>
                                )}
                                {showVillageDropdown && villages.length > 0 && (
                                    <div className="absolute z-50 w-full mt-1 bg-white border-2 border-blue-300 rounded-lg shadow-xl max-h-60 overflow-y-auto">
                                        {villages.map((village, idx) => (
                                            <div
                                                key={idx}
                                                onClick={() => selectVillage(village)}
                                                className="px-4 py-3 hover:bg-blue-50 cursor-pointer border-b border-gray-100 last:border-b-0"
                                            >
                                                <div className="font-semibold text-gray-800">{village.name}</div>
                                                <div className="text-sm text-gray-600">
                                                    ตำบล{village.subDistrict} อำเภอ{village.district}
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>

                            {/* Sub District */}
                            <div>
                                <label className="block text-sm md:text-base font-semibold text-gray-700 mb-2">
                                    ตำบล
                                </label>
                                <input
                                    type="text"
                                    name="subDistrict"
                                    value={formData.subDistrict}
                                    onChange={handleInputChange}
                                    className="text-gray-700 w-full px-3 md:px-4 py-2 md:py-3 border-2 border-gray-300 rounded-lg focus:border-blue-500 focus:outline-none text-sm md:text-base"
                                    placeholder="ระบุตำบล"
                                />
                            </div>

                            {/* District */}
                            <div>
                                <label className="block text-sm md:text-base font-semibold text-gray-700 mb-2">
                                    อำเภอ
                                </label>
                                <input
                                    type="text"
                                    name="district"
                                    value={formData.district}
                                    onChange={handleInputChange}
                                    className="text-gray-700 w-full px-3 md:px-4 py-2 md:py-3 border-2 border-gray-300 rounded-lg focus:border-blue-500 focus:outline-none text-sm md:text-base"
                                    placeholder="ระบุอำเภอ"
                                />
                            </div>
                        </div>
                    </div>

                    {/* Incident Details Section */}
                    <div className="mb-6 md:mb-8">
                        <h2 className="text-xl md:text-2xl font-bold text-gray-800 mb-4 md:mb-6 flex items-center gap-2">
                            <span className="text-2xl md:text-3xl">💧</span>
                            รายละเอียดเหตุการณ์
                        </h2>

                        {/* Description */}
                        <div className="mb-4 md:mb-6">
                            <label className="block text-sm md:text-base font-semibold text-gray-700 mb-2">
                                อธิบายสถานการณ์ <span className="text-red-500">*</span>
                            </label>
                            <textarea
                                name="description"
                                value={formData.description}
                                onChange={handleInputChange}
                                rows="4"
                                className="text-gray-700 w-full px-3 md:px-4 py-2 md:py-3 border-2 border-gray-300 rounded-lg focus:border-blue-500 focus:outline-none text-sm md:text-base resize-none"
                                placeholder="อธิบายสถานการณ์น้ำท่วม เช่น น้ำท่วมบริเวณถนนหน้าบ้าน สูงประมาณหัวเข่า ไม่สามารถสัญจรได้"
                                required
                            />
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6">
                            {/* Water Level */}
                            <div>
                                <label className="block text-sm md:text-base font-semibold text-gray-700 mb-2">
                                    ระดับน้ำ (ซม.) <span className="text-red-500">*</span>
                                </label>
                                <select
                                    name="waterLevel"
                                    value={formData.waterLevel}
                                    onChange={handleInputChange}
                                    className="text-gray-700 w-full px-3 md:px-4 py-2 md:py-3 border-2 border-gray-300 rounded-lg focus:border-blue-500 focus:outline-none text-sm md:text-base"
                                    required
                                >
                                    <option value="">-- เลือกระดับน้ำ --</option>
                                    <option value="0-20">ต่ำ (0-20 ซม. / ใต้เข่า)</option>
                                    <option value="20-50">ปานกลาง (20-50 ซม. / เหนือเข่า)</option>
                                    <option value="50-100">สูง (50-100 ซม. / เอว)</option>
                                    <option value="100+">สูงมาก (100+ ซม. / เหนืออก)</option>
                                </select>
                            </div>

                            {/* Affected People */}
                            <div>
                                <label className="block text-sm md:text-base font-semibold text-gray-700 mb-2">
                                    จำนวนผู้ได้รับผลกระทบ (คน)
                                </label>
                                <input
                                    type="number"
                                    name="affectedPeople"
                                    value={formData.affectedPeople}
                                    onChange={handleInputChange}
                                    min="0"
                                    className="text-gray-700 w-full px-3 md:px-4 py-2 md:py-3 border-2 border-gray-300 rounded-lg focus:border-blue-500 focus:outline-none text-sm md:text-base"
                                    placeholder="ระบุจำนวน (ถ้าทราบ)"
                                />
                            </div>

                            {/* Occurred At */}
                            <div>
                                <label className="block text-sm md:text-base font-semibold text-gray-700 mb-2">
                                    วันเวลาที่เกิดเหตุ
                                </label>
                                <input
                                    type="datetime-local"
                                    name="occurredAt"
                                    value={formData.occurredAt}
                                    onChange={handleInputChange}
                                    className="text-gray-700 w-full px-3 md:px-4 py-2 md:py-3 border-2 border-gray-300 rounded-lg focus:border-blue-500 focus:outline-none text-sm md:text-base"
                                />
                            </div>

                            {/* Urgency */}
                            <div>
                                <label className="block text-sm md:text-base font-semibold text-gray-700 mb-2">
                                    ระดับความเร่งด่วน
                                </label>
                                <select
                                    name="urgency"
                                    value={formData.urgency}
                                    onChange={handleInputChange}
                                    className="text-gray-700 w-full px-3 md:px-4 py-2 md:py-3 border-2 border-gray-300 rounded-lg focus:border-blue-500 focus:outline-none text-sm md:text-base"
                                >
                                    <option value="low">ต่ำ (สถานการณ์ปกติ)</option>
                                    <option value="medium">ปานกลาง (ต้องเฝ้าระวัง)</option>
                                    <option value="high">สูง (ต้องการความช่วยเหลือ)</option>
                                    <option value="critical">วิกฤติ (ต้องช่วยเหลือทันที)</option>
                                </select>
                            </div>

                            {/* Travel Status */}
                            <div>
                                <label className="block text-sm md:text-base font-semibold text-gray-700 mb-2">
                                    🚧 สถานะการสัญจร
                                </label>
                                <select
                                    name="travelStatus"
                                    value={formData.travelStatus}
                                    onChange={handleInputChange}
                                    className="text-gray-700 w-full px-3 md:px-4 py-2 md:py-3 border-2 border-gray-300 rounded-lg focus:border-blue-500 focus:outline-none text-sm md:text-base"
                                >
                                    <option value="">-- เลือกสถานะ --</option>
                                    <option value="passable">✅ สัญจรได้ปกติ</option>
                                    <option value="difficult">⚠️ สัญจรได้ยากลำบาก</option>
                                    <option value="impassable">🚫 ไม่สามารถสัญจรได้</option>
                                </select>
                            </div>
                        </div>

                        {/* Photo Upload */}
                        <div className="mt-4 md:mt-6">
                            <label className="block text-sm md:text-base font-semibold text-gray-700 mb-2">
                                รูปภาพประกอบ (ถ้ามี)
                            </label>
                            <div className="border-2 border-dashed border-gray-300 rounded-lg p-4 md:p-6 text-center hover:border-blue-500 transition-colors">
                                <input
                                    type="file"
                                    accept="image/*"
                                    onChange={handleFileChange}
                                    className="hidden"
                                    id="photo-upload"
                                />
                                <label htmlFor="photo-upload" className="cursor-pointer">
                                    <div className="text-4xl md:text-5xl mb-2">📷</div>
                                    <p className="text-sm md:text-base text-gray-600 mb-1">
                                        {formData.photo ? formData.photo.name : 'คลิกเพื่ออัพโหลดรูปภาพ'}
                                    </p>
                                    <p className="text-xs md:text-sm text-gray-500">รองรับไฟล์: JPG, PNG (ไม่เกิน 5MB)</p>
                                </label>
                            </div>
                        </div>
                    </div>

                    {/* Map Section */}
                    <div className="mb-6 md:mb-8">
                        <h2 className="text-xl md:text-2xl font-bold text-gray-800 mb-4 md:mb-6 flex items-center gap-2">
                            <span className="text-2xl md:text-3xl">📍</span>
                            ตำแหน่งที่เกิดเหตุ <span className="text-red-500">*</span>
                        </h2>
                        <p className="text-sm md:text-base text-gray-600 mb-3 md:mb-4">
                            คลิกบนแผนที่เพื่อปักหมุดตำแหน่งที่เกิดเหตุ
                        </p>

                        {mounted && (
                            <div className="border-4 border-blue-200 rounded-xl overflow-hidden shadow-lg">
                                <MapContainer
                                    center={defaultCenter}
                                    zoom={11}
                                    style={{ height: '400px', width: '100%' }}
                                    className="z-0"
                                    scrollWheelZoom={true}
                                >
                                    <TileLayer
                                        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                                        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                                    />
                                    <LocationMarker position={markerPosition} setPosition={setMarkerPosition} />
                                </MapContainer>
                            </div>
                        )}

                        {markerPosition && (
                            <div className="mt-3 md:mt-4 bg-blue-50 rounded-lg p-3 md:p-4">
                                <p className="text-sm md:text-base text-blue-800">
                                    <strong>ตำแหน่งที่เลือก:</strong> {markerPosition.lat.toFixed(6)}, {markerPosition.lng.toFixed(6)}
                                </p>
                            </div>
                        )}
                    </div>

                    {/* Submit Button */}
                    <div className="flex flex-col sm:flex-row gap-3 md:gap-4">
                        <button
                            type="submit"
                            disabled={isSubmitting}
                            className={`flex-1 bg-gradient-to-r from-green-600 to-green-700 text-white px-6 py-3 md:px-8 md:py-4 rounded-xl font-bold shadow-lg hover:shadow-xl transition-all text-base md:text-lg ${isSubmitting ? 'opacity-50 cursor-not-allowed' : 'hover:scale-105'
                                }`}
                        >
                            {isSubmitting ? (
                                <span className="flex items-center justify-center gap-2">
                                    <span className="animate-spin">⏳</span>
                                    กำลังส่งข้อมูล...
                                </span>
                            ) : (
                                <span className="flex items-center justify-center gap-2">
                                    <span>📤</span>
                                    แจ้งเหตุการณ์
                                </span>
                            )}
                        </button>

                        <Link
                            href="/"
                            className="flex-1 sm:flex-none bg-gray-200 hover:bg-gray-300 text-gray-800 px-6 py-3 md:px-8 md:py-4 rounded-xl font-bold shadow-lg transition-all text-center text-base md:text-lg"
                        >
                            ยกเลิก
                        </Link>
                    </div>

                    {/* Emergency Contact */}
                    <div className="mt-6 md:mt-8 bg-red-50 border-2 border-red-300 rounded-xl p-4 md:p-6">
                        <h3 className="font-bold text-base md:text-lg text-red-800 mb-2">📞 กรณีฉุกเฉิน โทร:</h3>
                        <div className="grid grid-cols-2 md:grid-cols-3 gap-3 md:gap-4 text-center">
                            <div className="bg-white rounded-lg p-2 md:p-3 shadow">
                                <div className="text-xl md:text-2xl font-bold text-red-600">191</div>
                                <div className="text-xs md:text-sm text-gray-600">ตำรวจ</div>
                            </div>
                            <div className="bg-white rounded-lg p-2 md:p-3 shadow">
                                <div className="text-xl md:text-2xl font-bold text-red-600">1669</div>
                                <div className="text-xs md:text-sm text-gray-600">ฉุกเฉิน</div>
                            </div>
                            <div className="bg-white rounded-lg p-2 md:p-3 shadow col-span-2 md:col-span-1">
                                <div className="text-xl md:text-2xl font-bold text-red-600">199</div>
                                <div className="text-xs md:text-sm text-gray-600">ดับเพลิง</div>
                            </div>
                        </div>
                    </div>
                </form>
            </main>

            {/* Footer */}
            <footer className="bg-gray-800 text-gray-300 py-4 md:py-6 mt-8 md:mt-12">
                <div className="container mx-auto px-4 md:px-6 text-center">
                    <p className="text-sm md:text-base">&copy; 2025 EOC จังหวัดสตูล</p>
                    <p className="text-xs md:text-sm mt-1 md:mt-2">ศูนย์บัญชาการเหตุการณ์ฉุกเฉิน</p>
                </div>
            </footer>
        </div>
    );
}
