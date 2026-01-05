"use client";
import { useState, useEffect, useRef } from "react";
import dynamic from "next/dynamic";

// Import Leaflet แบบ dynamic
const MapContainer = dynamic(
    () => import('react-leaflet').then((mod) => mod.MapContainer),
    { ssr: false }
);
const TileLayer = dynamic(
    () => import('react-leaflet').then((mod) => mod.TileLayer),
    { ssr: false }
);
const Polygon = dynamic(
    () => import('react-leaflet').then((mod) => mod.Polygon),
    { ssr: false }
);
const Popup = dynamic(
    () => import('react-leaflet').then((mod) => mod.Popup),
    { ssr: false }
);
const Marker = dynamic(
    () => import('react-leaflet').then((mod) => mod.Marker),
    { ssr: false }
);
const LayerGroup = dynamic(
    () => import('react-leaflet').then((mod) => mod.LayerGroup),
    { ssr: false }
);

export default function FloodAreaStatus({ sessionId, date, polygons }) {
    const [floodData, setFloodData] = useState([]);
    const [stats, setStats] = useState({});
    const [hasActiveSession, setHasActiveSession] = useState(true);
    const [activeSession, setActiveSession] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [showTambonBoundaries, setShowTambonBoundaries] = useState(false);
    const [showDistrictBoundaries, setShowDistrictBoundaries] = useState(false);
    const [showFacilities, setShowFacilities] = useState(true);
    const [healthFacilities, setHealthFacilities] = useState([]);
    const [tambonBoundaries, setTambonBoundaries] = useState([]);
    const [districtBoundaries, setDistrictBoundaries] = useState([]);
    const [levelFilter, setLevelFilter] = useState('all'); // all, severe, moderate, mild, safe
    const [districtFilter, setDistrictFilter] = useState('all');
    const [tambonFilter, setTambonFilter] = useState('all');
    const [villageFilter, setVillageFilter] = useState('all');
    const [startDate, setStartDate] = useState('');
    const [endDate, setEndDate] = useState('');
    const [dates, setDates] = useState([]);
    const [selectedDate, setSelectedDate] = useState(null);
    const [isMounted, setIsMounted] = useState(false);
    const mapRef = useRef(null);

    // State สำหรับควบคุมการแสดงชื่อบนแผนที่
    const [showDistrictLabels, setShowDistrictLabels] = useState(false);
    const [showTambonLabels, setShowTambonLabels] = useState(true);
    const [showVillageLabels, setShowVillageLabels] = useState(true);

    // Wait for component to mount before rendering maps
    useEffect(() => {
        setIsMounted(true);
        return () => setIsMounted(false);
    }, []);

    // สร้างรายการวันที่จาก active session
    useEffect(() => {
        if (activeSession) {
            const start = new Date(activeSession.opened_at);
            const end = activeSession.closed_at ? new Date(activeSession.closed_at) : new Date();
            const dateList = [];

            for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
                dateList.push(new Date(d));
            }

            setDates(dateList);
            if (!selectedDate && dateList.length > 0) {
                setSelectedDate(dateList[dateList.length - 1]); // เลือกวันล่าสุด
            }
        }
    }, [activeSession]);

    useEffect(() => {
        fetchFloodData();
    }, [sessionId, selectedDate]);

    // ดึงข้อมูลสถานพยาบาล
    useEffect(() => {
        const fetchHealthFacilities = async () => {
            try {
                const response = await fetch('/api/common/health-facilities');
                const result = await response.json();
                console.log('Health Facilities Response:', result);
                if (result.success) {
                    console.log('Health Facilities Data:', result.data);
                    setHealthFacilities(result.data);
                }
            } catch (error) {
                console.error('Error fetching health facilities:', error);
            }
        };
        fetchHealthFacilities();
    }, []);

    // ดึงข้อมูลเขตตำบล
    useEffect(() => {
        const fetchTambonBoundaries = async () => {
            try {
                const response = await fetch('/api/common/tambon-boundaries');
                const result = await response.json();
                if (result.success) {
                    console.log('Tambon Boundaries:', result.data);
                    setTambonBoundaries(result.data);
                }
            } catch (error) {
                console.error('Error fetching tambon boundaries:', error);
            }
        };
        fetchTambonBoundaries();
    }, []);

    // ดึงข้อมูลเขตอำเภอ
    useEffect(() => {
        const fetchDistrictBoundaries = async () => {
            try {
                const response = await fetch('/api/common/district-boundaries');
                const result = await response.json();
                if (result.success) {
                    console.log('District Boundaries:', result.data);
                    setDistrictBoundaries(result.data);
                }
            } catch (error) {
                console.error('Error fetching district boundaries:', error);
            }
        };
        fetchDistrictBoundaries();
    }, []);

    const fetchFloodData = async () => {
        setLoading(true);
        setError(null);

        try {
            let url = '/api/eoc/flood/area-status';
            const params = new URLSearchParams();

            if (sessionId) params.append('session_id', sessionId);
            if (selectedDate) {
                params.append('date', selectedDate.toISOString().split('T')[0]);
            } else if (date) {
                params.append('date', date);
            }

            if (params.toString()) {
                url += '?' + params.toString();
            }

            const response = await fetch(url);
            const result = await response.json();

            console.log('FloodAreaStatus API Response:', result);
            console.log('hasActiveSession:', result.hasActiveSession);
            console.log('success:', result.success);

            if (result.success && result.hasActiveSession) {
                setFloodData(result.data || []);
                setStats(result.stats || {});
                setHasActiveSession(true);
                if (result.activeSession) {
                    setActiveSession(result.activeSession);
                }
            } else {
                // ถ้า API ส่ง debug info กลับมาให้แสดง
                if (result.debug) {
                    console.log('Debug info:', result.debug);
                }
                setFloodData([]);
                setStats({});
                setHasActiveSession(result.hasActiveSession || false);
            }
        } catch (err) {
            console.error('Error fetching flood data:', err);
            setError(err.message);
            setHasActiveSession(false);
        } finally {
            setLoading(false);
        }
    };

    if (loading) {
        return (
            <div className="bg-white rounded-lg shadow p-6">
                <div className="flex items-center justify-center py-8">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
                    <span className="ml-3 text-gray-600">กำลังโหลดข้อมูล...</span>
                </div>
            </div>
        );
    }

    if (!hasActiveSession) {
        return (
            <div className="bg-yellow-50 border-2 border-yellow-200 rounded-lg p-6 text-center">
                <div className="text-6xl mb-4">⚠️</div>
                <h3 className="text-xl font-bold text-gray-800 mb-2">ไม่มี EOC Session ที่เปิดอยู่</h3>
                <p className="text-gray-600">
                    ไม่พบ EOC Session น้ำท่วมที่กำลังดำเนินการอยู่ในขณะนี้
                </p>
            </div>
        );
    }

    if (error) {
        return (
            <div className="bg-red-50 border-2 border-red-200 rounded-lg p-6">
                <h3 className="text-lg font-bold text-red-800 mb-2">เกิดข้อผิดพลาด</h3>
                <p className="text-red-600">{error}</p>
            </div>
        );
    }

    // แสดงข้อความเมื่อไม่มีข้อมูล แต่ยังแสดงแผนที่ได้
    const hasNoFloodData = floodData.length === 0;

    // แยกข้อมูลตามระดับ
    const severeAreas = floodData.filter(d => d.flood_level === 'severe');
    const moderateAreas = floodData.filter(d => d.flood_level === 'moderate');
    const mildAreas = floodData.filter(d => d.flood_level === 'mild');
    const safeAreas = floodData.filter(d => d.flood_level === 'safe');

    // สร้างรายการ filter จาก polygons
    const allDistricts = polygons ? [...new Set(polygons.map(p => p.distname))].filter(Boolean).sort() : [];
    const allTambons = polygons && districtFilter !== 'all'
        ? [...new Set(polygons.filter(p => p.distname === districtFilter).map(p => p.subdistnam))].filter(Boolean).sort()
        : [];
    const allVillages = polygons && tambonFilter !== 'all'
        ? polygons.filter(p => p.distname === districtFilter && p.subdistnam === tambonFilter).map(p => ({ id: p.id, name: p.villname })).sort((a, b) => a.name?.localeCompare(b.name))
        : [];

    // ฟิลเตอร์ข้อมูลตามที่เลือก
    let filteredData = floodData;

    if (levelFilter !== 'all') {
        filteredData = filteredData.filter(d => d.flood_level === levelFilter);
    }

    if (districtFilter !== 'all') {
        filteredData = filteredData.filter(d => d.district === districtFilter);
    }

    if (tambonFilter !== 'all') {
        filteredData = filteredData.filter(d => d.tambon === tambonFilter);
    }

    if (villageFilter !== 'all') {
        filteredData = filteredData.filter(d => d.villname === villageFilter || d.vid == villageFilter);
    }

    // ค้นหาข้อความ


    const getFloodColor = (level) => {
        const colors = {
            'severe': '#DC2626',
            'moderate': '#FBBF24',
            'mild': '#34D399',
            'safe': '#10B981'
        };
        return colors[level] || '#E5E7EB';
    };

    // สร้าง map ระหว่าง village id กับ flood level
    const villageFloodLevels = {};
    floodData.forEach(item => {
        // ใช้ vid (polygon id) เป็น key หลัก
        if (item.vid) {
            villageFloodLevels[item.vid] = {
                level: item.flood_level,
                water_level: item.water_level,
                affected_population: item.affected_population,
                notes: item.notes
            };
        }
        // เพิ่ม villcode เป็น key สำรอง
        if (item.villcode) {
            villageFloodLevels[item.villcode] = {
                level: item.flood_level,
                water_level: item.water_level,
                affected_population: item.affected_population,
                notes: item.notes
            };
        }
    });

    console.log('Flood Data Sample:', floodData.slice(0, 3));
    console.log('Village Flood Levels Keys:', Object.keys(villageFloodLevels).slice(0, 10));
    console.log('Polygon Sample:', polygons?.slice(0, 3).map(p => ({ id: p.id, villcode: p.villcode, villname: p.villname, distname: p.distname, subdistnam: p.subdistnam })));

    // จัดกลุ่ม polygon ตามระดับน้ำท่วม
    const getPolygonsByLevel = () => {
        const grouped = {
            severe: [],
            moderate: [],
            mild: [],
            safe: [],
            nodata: [] // เพิ่มกลุ่มสำหรับหมู่บ้านที่ไม่มีข้อมูล
        };

        if (!polygons) return grouped;

        polygons.forEach(poly => {
            // ลอง match โดย id ก่อน แล้วค่อย villcode
            const floodInfo = villageFloodLevels[poly.id] || villageFloodLevels[poly.villcode];

            if (floodInfo) {
                const level = floodInfo.level;
                if (grouped[level]) {
                    grouped[level].push({
                        ...poly,
                        floodInfo: floodInfo
                    });
                }
            } else {
                // ถ้าไม่มีข้อมูล ให้ใส่ในกลุ่ม nodata
                grouped.nodata.push({
                    ...poly,
                    floodInfo: null
                });
            }
        });

        console.log('Polygon Groups:', {
            severe: grouped.severe.length,
            moderate: grouped.moderate.length,
            mild: grouped.mild.length,
            safe: grouped.safe.length,
            nodata: grouped.nodata.length
        });

        return grouped;
    };

    const polygonGroups = getPolygonsByLevel();

    // สร้างไอคอนสำหรับสถานพยาบาล
    const createFacilityIcon = (typecode) => {
        if (typeof window === 'undefined') return null;

        const L = require('leaflet');
        const colors = {
            'รพ.ทั่วไป': '#DC2626',
            'รพ.ชุมชน': '#F59E0B',
            'รพ.สต.': '#10B981',
            'ศสช.': '#3B82F6',
            'สสจ': '#8B5CF6',
            'สสอ.': '#EC4899',
            'สอน.': '#06B6D4',
        };

        const color = colors[typecode] || '#EF4444'; // default สีแดง

        console.log('Creating facility icon for:', typecode, 'color:', color);

        return L.divIcon({
            className: 'custom-div-icon',
            html: `<div style="
                background-color: ${color};
                width: 28px;
                height: 28px;
                border-radius: 50%;
                border: 3px solid white;
                box-shadow: 0 2px 6px rgba(0,0,0,0.4);
                display: flex;
                align-items: center;
                justify-content: center;
            ">
                <svg width="14" height="14" viewBox="0 0 12 12" fill="white">
                    <path d="M5 0h2v5h5v2H7v5H5V7H0V5h5V0z"/>
                </svg>
            </div>`,
            iconSize: [28, 28],
            iconAnchor: [14, 14],
            popupAnchor: [0, -14]
        });
    };

    // สร้าง label icon สำหรับชื่อหมู่บ้าน/ตำบล/อำเภอ
    const createLabelIcon = (text, type = 'village') => {
        if (typeof window === 'undefined') return null;

        const L = require('leaflet');
        const styles = {
            village: {
                fontSize: '10px',
                color: '#1E40AF',
                fontWeight: '600',
                backgroundColor: 'rgba(255, 255, 255, 0.95)',
                padding: '1px 4px',
                borderRadius: '3px',
                border: '1px solid rgba(59, 130, 246, 0.8)',
                boxShadow: '0 1px 3px rgba(0,0,0,0.2)',
                textShadow: '0 0 2px white'
            },
            tambon: {
                fontSize: '12px',
                color: '#047857',
                fontWeight: '700',
                backgroundColor: 'rgba(255, 255, 255, 0.95)',
                padding: '2px 6px',
                borderRadius: '4px',
                border: '1.5px solid rgba(16, 185, 129, 0.8)',
                boxShadow: '0 2px 4px rgba(0,0,0,0.25)',
                textShadow: '0 0 2px white'
            },
            district: {
                fontSize: '14px',
                color: '#B91C1C',
                fontWeight: '800',
                backgroundColor: 'rgba(255, 255, 255, 0.98)',
                padding: '3px 8px',
                borderRadius: '5px',
                border: '2px solid rgba(239, 68, 68, 0.8)',
                boxShadow: '0 2px 6px rgba(0,0,0,0.3)',
                textShadow: '0 0 3px white, 0 0 5px white'
            }
        };

        const style = styles[type];
        const styleString = Object.entries(style).map(([key, value]) =>
            `${key.replace(/([A-Z])/g, '-$1').toLowerCase()}: ${value}`
        ).join('; ');

        console.log(`Creating ${type} label:`, text);

        return L.divIcon({
            className: 'label-icon',
            html: `<div style="${styleString}; white-space: nowrap; pointer-events: none;">${text}</div>`,
            iconSize: null,
            iconAnchor: [0, 0]
        });
    };

    const getLevelBadge = (level) => {
        const badges = {
            severe: 'bg-red-100 text-red-800 border-red-300',
            moderate: 'bg-orange-100 text-orange-800 border-orange-300',
            mild: 'bg-yellow-100 text-yellow-800 border-yellow-300',
            safe: 'bg-green-100 text-green-800 border-green-300'
        };
        const labels = {
            severe: 'น้ำท่วมหนัก',
            moderate: 'น้ำท่วมปานกลาง',
            mild: 'น้ำท่วมเล็กน้อย',
            safe: 'ปกติ'
        };

        return (
            <span className={`px-2 py-1 rounded text-xs font-medium border ${badges[level] || 'bg-gray-100 text-gray-800 border-gray-300'}`}>
                {labels[level] || level}
            </span>
        );
    };

    // ดึงรายการ districts ที่ไม่ซ้ำ
    const uniqueDistricts = [...new Set(floodData.map(d => d.district))].sort();

    // ดึงรายการ tambons ตาม district ที่เลือก
    const uniqueTambons = districtFilter === 'all'
        ? []
        : [...new Set(floodData.filter(d => d.district === districtFilter).map(d => d.tambon))].sort();

    // จัดกลุ่มข้อมูลตามตำบล และหาระดับความรุนแรงสูงสุดของแต่ละตำบล
    const getTambonFloodLevels = () => {
        const tambonData = {};

        floodData.forEach(item => {
            const key = `${item.district}-${item.tambon}`;

            if (!tambonData[key]) {
                tambonData[key] = {
                    district: item.district,
                    tambon: item.tambon,
                    villages: [],
                    severeCount: 0,
                    moderateCount: 0,
                    mildCount: 0,
                    safeCount: 0,
                    totalPopulation: 0
                };
            }

            tambonData[key].villages.push(item);
            tambonData[key].totalPopulation += item.affected_population || 0;

            // นับจำนวนหมู่บ้านตามระดับ
            if (item.flood_level === 'severe') tambonData[key].severeCount++;
            else if (item.flood_level === 'moderate') tambonData[key].moderateCount++;
            else if (item.flood_level === 'mild') tambonData[key].mildCount++;
            else tambonData[key].safeCount++;
        });

        // กำหนดระดับของตำบลตามความรุนแรงสูงสุด
        Object.keys(tambonData).forEach(key => {
            const data = tambonData[key];
            if (data.severeCount > 0) {
                data.level = 'severe';
            } else if (data.moderateCount > 0) {
                data.level = 'moderate';
            } else if (data.mildCount > 0) {
                data.level = 'mild';
            } else {
                data.level = 'safe';
            }
        });

        console.log('Tambon Flood Levels Keys:', Object.keys(tambonData));
        return tambonData;
    };

    const tambonFloodLevels = getTambonFloodLevels();

    // จัดกลุ่ม polygon ตามตำบลและระดับน้ำท่วม
    const getPolygonsByTambon = () => {
        const grouped = {
            severe: [],
            moderate: [],
            mild: [],
            safe: [],
            nodata: []
        };

        if (!polygons) return grouped;

        polygons
            .filter(poly => {
                // กรองตาม district และ tambon filter
                if (districtFilter !== 'all' && poly.distname !== districtFilter) return false;
                if (tambonFilter !== 'all' && poly.subdistnam !== tambonFilter) return false;
                return true;
            })
            .forEach(poly => {
                // ใช้ distname และ subdistnam จาก polygon
                const key = `${poly.distname}-${poly.subdistnam}`;
                const tambonInfo = tambonFloodLevels[key];
                const level = tambonInfo?.level || 'nodata';

                if (grouped[level]) {
                    grouped[level].push({
                        ...poly,
                        tambonInfo: tambonInfo
                    });
                } else {
                    grouped.nodata.push({
                        ...poly,
                        tambonInfo: null
                    });
                }
            });

        return grouped;
    };

    const polygonGroupsByTambon = getPolygonsByTambon();

    console.log('Polygon Groups by Tambon:', {
        severe: polygonGroupsByTambon.severe?.length || 0,
        moderate: polygonGroupsByTambon.moderate?.length || 0,
        mild: polygonGroupsByTambon.mild?.length || 0,
        safe: polygonGroupsByTambon.safe?.length || 0,
        nodata: polygonGroupsByTambon.nodata?.length || 0
    });

    return (
        <div className="space-y-6">
            {/* Timeline รายวัน */}
            {activeSession && dates.length > 0 && (
                <div className="bg-white rounded-lg shadow p-6">
                    <div className="mb-4">
                        <h3 className="text-lg font-bold text-gray-800 mb-2">
                            📅 แผนที่สถานการณ์น้ำท่วมรายวัน
                        </h3>
                        <p className="text-sm text-gray-600">
                            Session #{activeSession.session_number} - ตั้งแต่ {new Date(activeSession.opened_at).toLocaleDateString('th-TH')}
                            {activeSession.closed_at && ` ถึง ${new Date(activeSession.closed_at).toLocaleDateString('th-TH')}`}
                            {' '}(รวม {dates.length} วัน)
                        </p>
                    </div>
                    <div className="space-y-4">
                        <div className="flex flex-wrap gap-2">
                            {dates.map((d, idx) => {
                                const dateStr = d.toLocaleDateString('th-TH', {
                                    weekday: 'short',
                                    day: 'numeric',
                                    month: 'short'
                                });
                                const isSelected = selectedDate?.getTime() === d.getTime();
                                return (
                                    <button
                                        key={idx}
                                        onClick={() => setSelectedDate(d)}
                                        className={`px-4 py-2 rounded-lg font-medium transition-all ${isSelected
                                            ? 'bg-green-600 text-white shadow-lg transform scale-105'
                                            : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                                            }`}
                                    >
                                        <div className="text-xs">วันที่ {idx + 1}</div>
                                        <div className="text-sm">{dateStr}</div>
                                    </button>
                                );
                            })}
                        </div>

                        {selectedDate && (
                            <div className="text-sm text-gray-600 bg-blue-50 p-3 rounded-lg">
                                💡 แสดงข้อมูลวันที่: <strong>{selectedDate.toLocaleDateString('th-TH', {
                                    weekday: 'long',
                                    day: 'numeric',
                                    month: 'long',
                                    year: 'numeric'
                                })}</strong>
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* แสดงข้อความเมื่อไม่มีข้อมูล flood */}
            {hasNoFloodData && (
                <div className="bg-blue-50 border-2 border-blue-200 rounded-lg p-4 text-center">
                    <div className="text-2xl mb-2">📋</div>
                    <p className="text-blue-700 font-medium">ยังไม่มีข้อมูลน้ำท่วมในช่วงเวลาที่เลือก</p>
                    <p className="text-blue-600 text-sm mt-1">แผนที่จะแสดงพื้นที่ทั้งหมดของจังหวัดสตูล</p>
                </div>
            )}



            {/* ฟิลเตอร์ข้อมูล */}
            <div className="bg-white text-gray-700 rounded-lg shadow p-4">
                <div className="flex items-center justify-between mb-3">
                    <label className="font-semibold text-gray-700 flex items-center gap-2">
                        <span>🔍</span>ฟิลเตอร์ข้อมูล
                    </label>
                    <button
                        onClick={() => {
                            setDistrictFilter('all');
                            setTambonFilter('all');
                            setVillageFilter('all');

                        }}
                        className="text-sm text-blue-600 hover:text-blue-800"
                    >
                        ล้างตัวกรอง
                    </button>
                </div>




                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div>
                        <label className="text-sm text-gray-600 block mb-1">อำเภอ:</label>
                        <select
                            value={districtFilter}
                            onChange={(e) => {
                                setDistrictFilter(e.target.value);
                                setTambonFilter('all');
                                setVillageFilter('all');
                            }}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                        >
                            <option value="all">ทั้งหมด ({allDistricts.length} อำเภอ)</option>
                            {allDistricts.map(district => (
                                <option key={district} value={district}>{district}</option>
                            ))}
                        </select>
                    </div>
                    <div>
                        <label className="text-sm text-gray-600 block mb-1">ตำบล:</label>
                        <select
                            value={tambonFilter}
                            onChange={(e) => {
                                setTambonFilter(e.target.value);
                                setVillageFilter('all');
                            }}
                            disabled={districtFilter === 'all'}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100 disabled:cursor-not-allowed"
                        >
                            <option value="all">{districtFilter === 'all' ? 'กรุณาเลือกอำเภอก่อน' : `ทั้งหมด (${allTambons.length} ตำบล)`}</option>
                            {allTambons.map(tambon => (
                                <option key={tambon} value={tambon}>{tambon}</option>
                            ))}
                        </select>
                    </div>
                    <div>
                        <label className="text-sm text-gray-600 block mb-1">หมู่บ้าน:</label>
                        <select
                            value={villageFilter}
                            onChange={(e) => setVillageFilter(e.target.value)}
                            disabled={tambonFilter === 'all'}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100 disabled:cursor-not-allowed"
                        >
                            <option value="all">{tambonFilter === 'all' ? 'กรุณาเลือกตำบลก่อน' : `ทั้งหมด (${allVillages.length} หมู่บ้าน)`}</option>
                            {allVillages.map(village => (
                                <option key={village.id} value={village.id}>{village.name}</option>
                            ))}
                        </select>
                    </div>
                </div>
            </div>



            {/* แผนที่สถานการณ์น้ำท่วมรายวัน (ระดับตำบล) */}
            {
                polygons && polygons.length > 0 && (
                    <div className="bg-gradient-to-br from-blue-50 to-green-50 rounded-xl p-6">
                        {/* Header */}
                        <div className="text-center mb-4">
                            <h3 className="text-2xl font-bold text-gray-800 mb-2">
                                สถานการณ์น้ำท่วม จังหวัดสตูล (ระดับตำบล)
                            </h3>
                            <p className="text-lg text-gray-600">
                                {selectedDate ? selectedDate.toLocaleDateString('th-TH', {
                                    year: 'numeric',
                                    month: 'long',
                                    day: 'numeric',
                                    weekday: 'long'
                                }) : ''}
                            </p>
                            <p className="text-sm text-gray-500 mt-1">
                                แสดงสีตามระดับความรุนแรงสูงสุดของตำบล
                            </p>
                        </div>

                        {/* Controls */}
                        <div className="flex flex-wrap justify-end gap-2 mb-4">
                            <label className="flex items-center gap-2 text-sm text-gray-700 bg-white px-3 py-2 rounded-lg shadow">
                                <input
                                    type="checkbox"
                                    checked={showVillageLabels}
                                    onChange={(e) => setShowVillageLabels(e.target.checked)}
                                    className="w-4 h-4 text-blue-600 rounded"
                                />
                                แสดงชื่อหมู่บ้าน
                            </label>


                            <label className="flex items-center gap-2 text-sm text-gray-700 bg-white px-3 py-2 rounded-lg shadow">
                                <input
                                    type="checkbox"
                                    checked={showTambonLabels}
                                    onChange={(e) => setShowTambonLabels(e.target.checked)}
                                    className="w-4 h-4 text-green-600 rounded"
                                />
                                แสดงชื่อตำบล
                            </label>
                            <label className="flex items-center gap-2 text-gray-700 text-sm bg-white px-3 py-2 rounded-lg shadow">
                                <input
                                    type="checkbox"
                                    checked={showDistrictLabels}
                                    onChange={(e) => setShowDistrictLabels(e.target.checked)}
                                    className="w-4 h-4 text-orange-600 rounded"
                                />
                                แสดงชื่ออำเภอ
                            </label>
                            <label className="text-gray-700 flex items-center gap-2 text-sm bg-white px-3 py-2 rounded-lg shadow">
                                <input
                                    type="checkbox"
                                    checked={showFacilities}
                                    onChange={(e) => setShowFacilities(e.target.checked)}
                                    className="w-4 h-4 text-blue-600 rounded"
                                />
                                แสดงสถานพยาบาล
                            </label>
                        </div>

                        {/* Map */}
                        <div className="bg-white rounded-lg shadow-lg overflow-hidden mb-6" style={{ height: '1100px' }}>
                            {isMounted && !loading && polygons && (
                                <MapContainer
                                    key={`tambon-map-${selectedDate?.getTime() || 'default'}`}
                                    center={[6.9, 100.05]}
                                    zoom={10}
                                    style={{ height: '100%', width: '100%' }}
                                >
                                    <TileLayer
                                        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                                        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
                                    />

                                    {/* Polygons ระดับตำบล - nodata (ไม่มีข้อมูล - วาดก่อน) */}
                                    {polygonGroupsByTambon.nodata?.map((poly, idx) => {
                                        if (!poly.geom) return null;
                                        const coords = JSON.parse(poly.geom);
                                        if (coords.type !== 'Polygon') return null;

                                        const positions = coords.coordinates[0].map(coord => [coord[1], coord[0]]);

                                        return (
                                            <Polygon
                                                key={`tambon-nodata-${idx}`}
                                                positions={positions}
                                                pathOptions={{
                                                    fillColor: 'transparent',
                                                    fillOpacity: 0,
                                                    color: '#000000',
                                                    weight: 1
                                                }}
                                            >
                                                <Popup>
                                                    <div className="text-sm">
                                                        <strong>{poly.villname}</strong>
                                                        <br />ต.{poly.subdistnam} อ.{poly.distname}
                                                        <br />สถานะ: ไม่มีข้อมูล
                                                    </div>
                                                </Popup>
                                            </Polygon>
                                        );
                                    })}

                                    {/* แสดงเส้นขอบเขตตำบล */}
                                    {showTambonBoundaries && tambonBoundaries
                                        .filter(tambon => {
                                            // กรองตาม district filter
                                            if (districtFilter !== 'all' && tambon.distname !== districtFilter) return false;
                                            return true;
                                        })
                                        .map((tambon, idx) => {
                                            if (!tambon.boundary_geom) return null;
                                            const coords = JSON.parse(tambon.boundary_geom);
                                            if (coords.type !== 'Polygon') return null;

                                            const positions = coords.coordinates[0].map(coord => [coord[1], coord[0]]);

                                            return (
                                                <Polygon
                                                    key={`tambon-${idx}`}
                                                    positions={positions}
                                                    pathOptions={{
                                                        color: '#9333EA',
                                                        weight: 3,
                                                        fillOpacity: 0,
                                                        dashArray: '10, 5'
                                                    }}
                                                >
                                                    <Popup>
                                                        <div className="text-sm">
                                                            <strong>ตำบล{tambon.subdistnam}</strong>
                                                            <br />อ.{tambon.distname}
                                                        </div>
                                                    </Popup>
                                                </Polygon>
                                            );
                                        })}

                                    {/* Polygons ระดับตำบล - severe */}
                                    {polygonGroupsByTambon.severe.map((poly, idx) => {
                                        if (!poly.geom) return null;
                                        const coords = JSON.parse(poly.geom);
                                        if (coords.type !== 'Polygon') return null;

                                        const positions = coords.coordinates[0].map(coord => [coord[1], coord[0]]);

                                        return (
                                            <Polygon
                                                key={`tambon-severe-${idx}`}
                                                positions={positions}
                                                pathOptions={{
                                                    fillColor: getFloodColor('severe'),
                                                    fillOpacity: 0.7,
                                                    color: '#DC2626',
                                                    weight: 1
                                                }}
                                            >
                                                <Popup>
                                                    <div className="text-sm">
                                                        <strong>{poly.villname}</strong>
                                                        <br />ต.{poly.subdistnam} อ.{poly.distname}
                                                        <br />🔴 <strong>ตำบลมีน้ำท่วมหนัก</strong>
                                                        {poly.tambonInfo && (
                                                            <>
                                                                <br />หมู่บ้านน้ำท่วมหนัก: {poly.tambonInfo.severeCount}
                                                                <br />ประชากร: {poly.tambonInfo.totalPopulation.toLocaleString()} คน
                                                            </>
                                                        )}
                                                    </div>
                                                </Popup>
                                            </Polygon>
                                        );
                                    })}

                                    {/* Polygons ระดับตำบล - moderate */}
                                    {polygonGroupsByTambon.moderate.map((poly, idx) => {
                                        if (!poly.geom) return null;
                                        const coords = JSON.parse(poly.geom);
                                        if (coords.type !== 'Polygon') return null;

                                        const positions = coords.coordinates[0].map(coord => [coord[1], coord[0]]);

                                        return (
                                            <Polygon
                                                key={`tambon-moderate-${idx}`}
                                                positions={positions}
                                                pathOptions={{
                                                    fillColor: getFloodColor('moderate'),
                                                    fillOpacity: 0.7,
                                                    color: '#FBBF24',
                                                    weight: 1
                                                }}
                                            >
                                                <Popup>
                                                    <div className="text-sm">
                                                        <strong>{poly.villname}</strong>
                                                        <br />ต.{poly.subdistnam} อ.{poly.distname}
                                                        <br />🟠 <strong>ตำบลมีน้ำท่วมปานกลาง</strong>
                                                        {poly.tambonInfo && (
                                                            <>
                                                                <br />หมู่บ้านน้ำท่วมปานกลาง: {poly.tambonInfo.moderateCount}
                                                                <br />ประชากร: {poly.tambonInfo.totalPopulation.toLocaleString()} คน
                                                            </>
                                                        )}
                                                    </div>
                                                </Popup>
                                            </Polygon>
                                        );
                                    })}

                                    {/* Polygons ระดับตำบล - mild */}
                                    {polygonGroupsByTambon.mild.map((poly, idx) => {
                                        if (!poly.geom) return null;
                                        const coords = JSON.parse(poly.geom);
                                        if (coords.type !== 'Polygon') return null;

                                        const positions = coords.coordinates[0].map(coord => [coord[1], coord[0]]);

                                        return (
                                            <Polygon
                                                key={`tambon-mild-${idx}`}
                                                positions={positions}
                                                pathOptions={{
                                                    fillColor: getFloodColor('mild'),
                                                    fillOpacity: 0.6,
                                                    color: '#34D399',
                                                    weight: 1
                                                }}
                                            >
                                                <Popup>
                                                    <div className="text-sm">
                                                        <strong>{poly.villname}</strong>
                                                        <br />ต.{poly.subdistnam} อ.{poly.distname}
                                                        <br />🟡 <strong>ตำบลมีน้ำท่วมเล็กน้อย</strong>
                                                        {poly.tambonInfo && (
                                                            <>
                                                                <br />หมู่บ้านน้ำท่วมเล็กน้อย: {poly.tambonInfo.mildCount}
                                                                <br />ประชากร: {poly.tambonInfo.totalPopulation.toLocaleString()} คน
                                                            </>
                                                        )}
                                                    </div>
                                                </Popup>
                                            </Polygon>
                                        );
                                    })}

                                    {/* Polygons ระดับตำบล - safe */}
                                    {polygonGroupsByTambon.safe.map((poly, idx) => {
                                        if (!poly.geom) return null;
                                        const coords = JSON.parse(poly.geom);
                                        if (coords.type !== 'Polygon') return null;

                                        const positions = coords.coordinates[0].map(coord => [coord[1], coord[0]]);

                                        return (
                                            <Polygon
                                                key={`tambon-safe-${idx}`}
                                                positions={positions}
                                                pathOptions={{
                                                    fillColor: getFloodColor('safe'),
                                                    fillOpacity: 0.3,
                                                    color: '#10B981',
                                                    weight: 1
                                                }}
                                            >
                                                <Popup>
                                                    <div className="text-sm">
                                                        <strong>{poly.villname}</strong>
                                                        <br />ต.{poly.subdistnam} อ.{poly.distname}
                                                        <br />🟢 <strong>ตำบลปกติ</strong>
                                                    </div>
                                                </Popup>
                                            </Polygon>
                                        );
                                    })}

                                    {/* สถานพยาบาล */}
                                    {showFacilities && healthFacilities && healthFacilities.length > 0 && (
                                        <LayerGroup>
                                            {(() => {
                                                console.log('Total facilities:', healthFacilities.length);
                                                const filtered = healthFacilities.filter(facility => {
                                                    // กรองตาม district และ tambon filter (ถ้ามีข้อมูล)
                                                    if (districtFilter !== 'all' && facility.district && facility.district !== districtFilter) return false;
                                                    if (tambonFilter !== 'all' && facility.tambon && facility.tambon !== tambonFilter) return false;
                                                    return true;
                                                });
                                                console.log('Filtered facilities:', filtered.length);
                                                return filtered.map((facility, idx) => {
                                                    console.log('Rendering facility:', facility.name, 'lat:', facility.lat, 'lon:', facility.lon, 'district:', facility.district);
                                                    if (!facility.lat || !facility.lon) {
                                                        console.log('Skipping facility (no coords):', facility.name);
                                                        return null;
                                                    }

                                                    return (
                                                        <Marker
                                                            key={`facility-${idx}`}
                                                            position={[parseFloat(facility.lat), parseFloat(facility.lon)]}
                                                            icon={createFacilityIcon(facility.typecode)}
                                                        >
                                                            <Popup>
                                                                <div className="text-sm">
                                                                    <strong>{facility.name}</strong>
                                                                    <br />ประเภท: {facility.typecode}
                                                                    <br />ที่อยู่: {facility.address}
                                                                    {facility.phone && (
                                                                        <>
                                                                            <br />📞 {facility.phone}
                                                                        </>
                                                                    )}
                                                                </div>
                                                            </Popup>
                                                        </Marker>
                                                    );
                                                });
                                            })()}
                                        </LayerGroup>
                                    )}

                                    {/* แสดงชื่อหมู่บ้าน */}
                                    {showVillageLabels && polygons && polygons.length > 0 && (
                                        <LayerGroup>
                                            {(() => {
                                                const filtered = polygons
                                                    .filter(p => p.lat && p.lng && p.villname)
                                                    .filter(p => {
                                                        // กรองตาม district และ tambon filter
                                                        if (districtFilter !== 'all' && p.distname !== districtFilter) return false;
                                                        if (tambonFilter !== 'all' && p.subdistnam !== tambonFilter) return false;
                                                        return true;
                                                    });
                                                console.log('Showing village labels:', filtered.length, 'of', polygons.length);
                                                return filtered.map((poly, idx) => (
                                                    <Marker
                                                        key={`village-label-${idx}`}
                                                        position={[parseFloat(poly.lat), parseFloat(poly.lng)]}
                                                        icon={createLabelIcon(poly.villname, 'village')}
                                                    />
                                                ));
                                            })()}
                                        </LayerGroup>
                                    )}

                                    {/* แสดงชื่อตำบล */}
                                    {showTambonLabels && tambonBoundaries && tambonBoundaries.length > 0 && (
                                        <LayerGroup>
                                            {tambonBoundaries
                                                .filter(tambon => {
                                                    // กรองตาม district filter
                                                    if (districtFilter !== 'all' && tambon.distname !== districtFilter) return false;
                                                    return true;
                                                })
                                                .map((tambon, idx) => {
                                                    if (tambon.center_lat && tambon.center_lng) {
                                                        const tambonName = tambon.subdistnam || tambon.tambname;
                                                        return (
                                                            <Marker
                                                                key={`tambon-label-${idx}`}
                                                                position={[parseFloat(tambon.center_lat), parseFloat(tambon.center_lng)]}
                                                                icon={createLabelIcon(`ต.${tambonName}`, 'tambon')}
                                                            />
                                                        );
                                                    }
                                                    return null;
                                                })}
                                        </LayerGroup>
                                    )}

                                    {/* แสดงชื่ออำเภอ */}
                                    {showDistrictLabels && polygons && polygons.length > 0 && (
                                        <LayerGroup>
                                            {Array.from(new Set(polygons.map(p => p.distname).filter(Boolean)))
                                                .filter(distName => {
                                                    // กรองตาม district filter
                                                    if (districtFilter !== 'all' && distName !== districtFilter) return false;
                                                    return true;
                                                })
                                                .map((distName, idx) => {
                                                    // หาตำแหน่งกลางของอำเภอจากหมู่บ้านทั้งหมด
                                                    const districtPolygons = polygons.filter(p => p.distname === distName && p.lat && p.lng);
                                                    if (districtPolygons.length > 0) {
                                                        const avgLat = districtPolygons.reduce((sum, p) => sum + parseFloat(p.lat), 0) / districtPolygons.length;
                                                        const avgLng = districtPolygons.reduce((sum, p) => sum + parseFloat(p.lng), 0) / districtPolygons.length;
                                                        console.log(`District ${distName}:`, { avgLat, avgLng, count: districtPolygons.length });
                                                        return (
                                                            <Marker
                                                                key={`district-label-${idx}`}
                                                                position={[avgLat, avgLng]}
                                                                icon={createLabelIcon(`อ.${distName}`, 'district')}
                                                            />
                                                        );
                                                    }
                                                    return null;
                                                })}
                                        </LayerGroup>
                                    )}

                                    {/* แสดง polygon ระดับอำเภอ */}
                                    {showDistrictBoundaries && (
                                        <>
                                            {/* Polygons ระดับอำเภอ - severe */}
                                            {polygonGroupsByDistrict.severe.map((poly, idx) => {
                                                if (!poly.geom) return null;
                                                const coords = JSON.parse(poly.geom);
                                                if (coords.type !== 'Polygon') return null;

                                                const positions = coords.coordinates[0].map(coord => [coord[1], coord[0]]);

                                                return (
                                                    <Polygon
                                                        key={`district-severe-${idx}`}
                                                        positions={positions}
                                                        pathOptions={{
                                                            fillColor: getFloodColor('severe'),
                                                            fillOpacity: 0.7,
                                                            color: '#DC2626',
                                                            weight: 2
                                                        }}
                                                    >
                                                        <Popup>
                                                            <div className="text-sm">
                                                                <strong>{poly.villname}</strong>
                                                                <br />ต.{poly.subdistnam} อ.{poly.distname}
                                                                <br />🔴 <strong>อำเภอมีน้ำท่วมหนัก</strong>
                                                                {poly.districtInfo && (
                                                                    <>
                                                                        <br />หมู่บ้านน้ำท่วมหนัก: {poly.districtInfo.severeCount}
                                                                        <br />หมู่บ้านน้ำท่วมปานกลาง: {poly.districtInfo.moderateCount}
                                                                        <br />หมู่บ้านน้ำท่วมเล็กน้อย: {poly.districtInfo.mildCount}
                                                                        <br />ประชากร: {poly.districtInfo.totalPopulation.toLocaleString()} คน
                                                                    </>
                                                                )}
                                                            </div>
                                                        </Popup>
                                                    </Polygon>
                                                );
                                            })}

                                            {/* Polygons ระดับอำเภอ - moderate */}
                                            {polygonGroupsByDistrict.moderate.map((poly, idx) => {
                                                if (!poly.geom) return null;
                                                const coords = JSON.parse(poly.geom);
                                                if (coords.type !== 'Polygon') return null;

                                                const positions = coords.coordinates[0].map(coord => [coord[1], coord[0]]);

                                                return (
                                                    <Polygon
                                                        key={`district-moderate-${idx}`}
                                                        positions={positions}
                                                        pathOptions={{
                                                            fillColor: getFloodColor('moderate'),
                                                            fillOpacity: 0.7,
                                                            color: '#FBBF24',
                                                            weight: 2
                                                        }}
                                                    >
                                                        <Popup>
                                                            <div className="text-sm">
                                                                <strong>{poly.villname}</strong>
                                                                <br />ต.{poly.subdistnam} อ.{poly.distname}
                                                                <br />🟠 <strong>อำเภอมีน้ำท่วมปานกลาง</strong>
                                                                {poly.districtInfo && (
                                                                    <>
                                                                        <br />หมู่บ้านน้ำท่วมหนัก: {poly.districtInfo.severeCount}
                                                                        <br />หมู่บ้านน้ำท่วมปานกลาง: {poly.districtInfo.moderateCount}
                                                                        <br />หมู่บ้านน้ำท่วมเล็กน้อย: {poly.districtInfo.mildCount}
                                                                        <br />ประชากร: {poly.districtInfo.totalPopulation.toLocaleString()} คน
                                                                    </>
                                                                )}
                                                            </div>
                                                        </Popup>
                                                    </Polygon>
                                                );
                                            })}

                                            {/* Polygons ระดับอำเภอ - mild */}
                                            {polygonGroupsByDistrict.mild.map((poly, idx) => {
                                                if (!poly.geom) return null;
                                                const coords = JSON.parse(poly.geom);
                                                if (coords.type !== 'Polygon') return null;

                                                const positions = coords.coordinates[0].map(coord => [coord[1], coord[0]]);

                                                return (
                                                    <Polygon
                                                        key={`district-mild-${idx}`}
                                                        positions={positions}
                                                        pathOptions={{
                                                            fillColor: getFloodColor('mild'),
                                                            fillOpacity: 0.6,
                                                            color: '#34D399',
                                                            weight: 2
                                                        }}
                                                    >
                                                        <Popup>
                                                            <div className="text-sm">
                                                                <strong>{poly.villname}</strong>
                                                                <br />ต.{poly.subdistnam} อ.{poly.distname}
                                                                <br />🟡 <strong>อำเภอมีน้ำท่วมเล็กน้อย</strong>
                                                                {poly.districtInfo && (
                                                                    <>
                                                                        <br />หมู่บ้านน้ำท่วมหนัก: {poly.districtInfo.severeCount}
                                                                        <br />หมู่บ้านน้ำท่วมปานกลาง: {poly.districtInfo.moderateCount}
                                                                        <br />หมู่บ้านน้ำท่วมเล็กน้อย: {poly.districtInfo.mildCount}
                                                                        <br />ประชากร: {poly.districtInfo.totalPopulation.toLocaleString()} คน
                                                                    </>
                                                                )}
                                                            </div>
                                                        </Popup>
                                                    </Polygon>
                                                );
                                            })}

                                            {/* Polygons ระดับอำเภอ - safe */}
                                            {polygonGroupsByDistrict.safe.map((poly, idx) => {
                                                if (!poly.geom) return null;
                                                const coords = JSON.parse(poly.geom);
                                                if (coords.type !== 'Polygon') return null;

                                                const positions = coords.coordinates[0].map(coord => [coord[1], coord[0]]);

                                                return (
                                                    <Polygon
                                                        key={`district-safe-${idx}`}
                                                        positions={positions}
                                                        pathOptions={{
                                                            fillColor: getFloodColor('safe'),
                                                            fillOpacity: 0.3,
                                                            color: '#10B981',
                                                            weight: 2
                                                        }}
                                                    >
                                                        <Popup>
                                                            <div className="text-sm">
                                                                <strong>{poly.villname}</strong>
                                                                <br />ต.{poly.subdistnam} อ.{poly.distname}
                                                                <br />🟢 <strong>อำเภอปกติ</strong>
                                                                {poly.districtInfo && (
                                                                    <>
                                                                        <br />หมู่บ้านปกติ: {poly.districtInfo.safeCount}
                                                                        <br />ประชากร: {poly.districtInfo.totalPopulation.toLocaleString()} คน
                                                                    </>
                                                                )}
                                                            </div>
                                                        </Popup>
                                                    </Polygon>
                                                );
                                            })}

                                            {/* Polygons อำเภอที่ไม่มีข้อมูล */}
                                            {polygonGroupsByDistrict.nodata.map((poly, idx) => {
                                                if (!poly.geom) return null;
                                                const coords = JSON.parse(poly.geom);
                                                if (coords.type !== 'Polygon') return null;

                                                const positions = coords.coordinates[0].map(coord => [coord[1], coord[0]]);

                                                return (
                                                    <Polygon
                                                        key={`district-nodata-${idx}`}
                                                        positions={positions}
                                                        pathOptions={{
                                                            fillColor: '#E5E7EB',
                                                            fillOpacity: 0.3,
                                                            color: '#9CA3AF',
                                                            weight: 1,
                                                            dashArray: '5, 5'
                                                        }}
                                                    >
                                                        <Popup>
                                                            <div className="text-sm">
                                                                <strong>{poly.villname}</strong>
                                                                <br />ต.{poly.subdistnam} อ.{poly.distname}
                                                                <br />⚪ <strong>ไม่มีข้อมูล</strong>
                                                            </div>
                                                        </Popup>
                                                    </Polygon>
                                                );
                                            })}
                                        </>
                                    )}
                                </MapContainer>
                            )}
                        </div>

                        {/* Legend */}
                        <div className="mb-4 mt-4">
                            <h3 className="text-sm font-semibold text-gray-700 mb-2">สัญลักษณ์พื้นที่น้ำท่วม:</h3>
                            <div className="flex justify-start gap-4 flex-wrap">
                                <LegendItem color="#DC2626" label="ตำบลมีน้ำท่วมหนัก" />
                                <LegendItem color="#FBBF24" label="ตำบลมีน้ำท่วมปานกลาง" />
                                <LegendItem color="#34D399" label="ตำบลมีน้ำท่วมเล็กน้อย" />
                                <LegendItem color="#10B981" label="ตำบลปกติ" />
                                <div className="flex items-center gap-2">
                                    <div
                                        className="w-6 h-6 rounded border-2 border-black"
                                        style={{ backgroundColor: 'transparent' }}
                                    />
                                    <span className="text-sm font-medium text-gray-700">ไม่มีข้อมูล</span>
                                </div>
                            </div>
                        </div>

                        {showTambonBoundaries && (
                            <div className="mb-4">
                                <h3 className="text-sm font-semibold text-gray-700 mb-2">สัญลักษณ์เขตตำบล:</h3>
                                <div className="flex items-center gap-2">
                                    <div className="w-12 h-1 border-2 border-purple-500" style={{ borderStyle: 'dashed' }}></div>
                                    <span className="text-sm text-gray-700">เส้นขอบเขตตำบล</span>
                                </div>
                            </div>
                        )}

                        {showFacilities && (
                            <div className="mb-6">
                                <h3 className="text-sm font-semibold text-gray-700 mb-2">สัญลักษณ์สถานพยาบาล:</h3>
                                <div className="flex justify-start gap-4 flex-wrap">
                                    <FacilityLegendItem color="#DC2626" label="รพ.ทั่วไป" />
                                    <FacilityLegendItem color="#F59E0B" label="รพ.ชุมชน" />
                                    <FacilityLegendItem color="#10B981" label="รพ.สต." />
                                    <FacilityLegendItem color="#3B82F6" label="ศสช." />
                                    <FacilityLegendItem color="#8B5CF6" label="สสจ" />
                                    <FacilityLegendItem color="#EC4899" label="สสอ." />
                                    <FacilityLegendItem color="#06B6D4" label="สอน." />
                                </div>
                            </div>
                        )}

                        {/* สถิติระดับตำบล */}
                        <div className="mb-6 grid grid-cols-2 md:grid-cols-4 gap-4">
                            <StatBox
                                label="ตำบลน้ำท่วมหนัก"
                                value={Object.values(tambonFloodLevels).filter(t => t.level === 'severe').length}
                                color="bg-red-100 text-red-700"
                                unit="ตำบล"
                            />
                            <StatBox
                                label="ตำบลน้ำท่วมปานกลาง"
                                value={Object.values(tambonFloodLevels).filter(t => t.level === 'moderate').length}
                                color="bg-yellow-100 text-yellow-700"
                                unit="ตำบล"
                            />
                            <StatBox
                                label="ตำบลน้ำท่วมเล็กน้อย"
                                value={Object.values(tambonFloodLevels).filter(t => t.level === 'mild').length}
                                color="bg-green-100 text-green-700"
                                unit="ตำบล"
                            />
                            <StatBox
                                label="ตำบลปกติ"
                                value={Object.values(tambonFloodLevels).filter(t => t.level === 'safe').length}
                                color="bg-blue-100 text-blue-700"
                                unit="ตำบล"
                            />
                        </div>
                    </div>
                )
            }


            {/* สถิติสรุป */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <StatCard
                    label="อำเภอที่ได้รับผลกระทบ"
                    value={stats.affected_districts || 0}
                    icon="🏘️"
                    color="blue"
                />
                <StatCard
                    label="ตำบลที่ได้รับผลกระทบ"
                    value={stats.affected_tambons || 0}
                    icon="📍"
                    color="indigo"
                />
                <StatCard
                    label="หมู่บ้านที่ได้รับผลกระทบ"
                    value={stats.affected_villages || 0}
                    icon="🏠"
                    color="purple"
                />
                <StatCard
                    label="ประชากรที่ได้รับผลกระทบ"
                    value={stats.total_population || 0}
                    icon="👥"
                    color="pink"
                />
            </div>

            {/* ระดับความรุนแรง */}
            <div className="bg-white rounded-lg shadow p-6 text-gray-700">
                <h3 className="text-lg font-bold mb-4">สรุปตามระดับความรุนแรง</h3>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <LevelCard
                        label="น้ำท่วมหนัก"
                        count={stats.severe_count || 0}
                        color="red"
                        icon="🔴"
                    />
                    <LevelCard
                        label="ปานกลาง"
                        count={stats.moderate_count || 0}
                        color="orange"
                        icon="🟠"
                    />
                    <LevelCard
                        label="เล็กน้อย"
                        count={stats.mild_count || 0}
                        color="yellow"
                        icon="🟡"
                    />
                    <LevelCard
                        label="ปกติ"
                        count={stats.safe_count || 0}
                        color="green"
                        icon="🟢"
                    />
                </div>
            </div>

            {/* รายการพื้นที่ */}
            <div className="bg-white rounded-lg shadow">
                <div className="p-6 border-b">
                    <h3 className="text-lg font-bold text-gray-700">รายการพื้นที่ ({filteredData.length})</h3>
                </div>
                <div className="divide-y max-h-96 overflow-y-auto">
                    {filteredData.map((area) => (
                        <div key={area.id} className="p-4 hover:bg-gray-50 transition-colors">
                            <div className="flex justify-between items-start mb-2">
                                <div className="flex-1">
                                    <h4 className="font-medium text-gray-900">
                                        {area.villname || area.villcode}
                                    </h4>
                                    <p className="text-sm text-gray-600">
                                        ต.{area.tambon} อ.{area.district}
                                    </p>
                                </div>
                                <div>
                                    {getLevelBadge(area.flood_level)}
                                </div>
                            </div>
                            {area.water_level && Number(area.water_level) > 0 && (
                                <div className="text-sm text-gray-700 mb-1">
                                    💧 ระดับน้ำ: <span className="font-medium">{Number(area.water_level).toFixed(2)} เมตร</span>
                                </div>
                            )}
                            {area.affected_population > 0 && (
                                <div className="text-sm text-gray-700 mb-1">
                                    👥 ประชากรได้รับผลกระทบ: <span className="font-medium">{area.affected_population.toLocaleString()} คน</span>
                                    {' '}({area.affected_households} ครัวเรือน)
                                </div>
                            )}
                            {area.notes && (
                                <div className="text-sm text-gray-600 mt-2 p-2 bg-gray-50 rounded">
                                    📝 {area.notes}
                                </div>
                            )}
                            <div className="text-xs text-gray-400 mt-2">
                                อัพเดทล่าสุด: {new Date(area.updated_at).toLocaleString('th-TH')}
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </div >
    );
}

function StatCard({ label, value, icon, color }) {
    const colors = {
        blue: 'from-blue-500 to-blue-600',
        indigo: 'from-indigo-500 to-indigo-600',
        purple: 'from-purple-500 to-purple-600',
        pink: 'from-pink-500 to-pink-600'
    };

    return (
        <div className={`bg-gradient-to-br ${colors[color]} text-white rounded-lg p-4 shadow`}>
            <div className="text-3xl mb-2">{icon}</div>
            <div className="text-2xl font-bold">{value.toLocaleString()}</div>
            <div className="text-sm opacity-90">{label}</div>
        </div>
    );
}

function LevelCard({ label, count, color, icon }) {
    const colors = {
        red: 'bg-red-50 border-red-200 text-red-800',
        orange: 'bg-orange-50 border-orange-200 text-orange-800',
        yellow: 'bg-yellow-50 border-yellow-200 text-yellow-800',
        green: 'bg-green-50 border-green-200 text-green-800'
    };

    return (
        <div className={`${colors[color]} border-2 rounded-lg p-4 text-center`}>
            <div className="text-2xl mb-1">{icon}</div>
            <div className="text-3xl font-bold mb-1">{count}</div>
            <div className="text-sm font-medium">{label}</div>
        </div>
    );
}

function LegendItem({ color, label }) {
    return (
        <div className="flex items-center gap-2">
            <div
                className="w-6 h-6 rounded border-2 border-gray-300"
                style={{ backgroundColor: color }}
            />
            <span className="text-sm font-medium text-gray-700">{label}</span>
        </div>
    );
}

function FacilityLegendItem({ color, label }) {
    return (
        <div className="flex items-center gap-2">
            <div
                className="w-6 h-6 rounded-full border-2 border-white shadow-md flex items-center justify-center"
                style={{ backgroundColor: color }}
            >
                <svg width="12" height="12" viewBox="0 0 12 12" fill="white">
                    <path d="M5 0h2v5h5v2H7v5H5V7H0V5h5V0z" />
                </svg>
            </div>
            <span className="text-sm font-medium text-gray-700">{label}</span>
        </div>
    );
}

function StatBox({ label, value, color, unit = "" }) {
    return (
        <div className={`${color} p-4 rounded-lg text-center`}>
            <div className="text-2xl font-bold">{value}</div>
            <div className="text-sm">
                {label}
                {unit && <span className="text-xs ml-1">({unit})</span>}
            </div>
        </div>
    );
}
