"use client";
import { useState, useEffect } from "react";
import EOCLayout from "@/components/layouts/EOCLayout";
import { satunDistricts } from "@/data/satunData";

export default function FloodRecordsPage() {
    const [records, setRecords] = useState([]);
    const [loading, setLoading] = useState(true);
    const [showModal, setShowModal] = useState(false);
    const [editingRecord, setEditingRecord] = useState(null);
    const [activeSession, setActiveSession] = useState(null);
    const [polygons, setPolygons] = useState([]);
    const [villageOptions, setVillageOptions] = useState([]);
    const [recordedTambons, setRecordedTambons] = useState(new Set());
    const [isTambonMode, setIsTambonMode] = useState(false);
    const [filters, setFilters] = useState({
        district: 'all',
        tambon: 'all',
        flood_level: 'all'
    });

    const [formData, setFormData] = useState({
        district: '',
        tambon: '',
        village: '',
        flood_level: 'ไม่มี',
        flood_start_date: '',
        water_depth_cm: '',
        affected_area_sqm: '',
        affected_households: 0,
        affected_people: 0,
        description: ''
    });

    const [tambonOptions, setTambonOptions] = useState([]);

    // ดึงข้อมูล polygon หมู่บ้าน
    useEffect(() => {
        const fetchPolygons = async () => {
            try {
                const response = await fetch('/api/common/village-polygons');
                const data = await response.json();
                setPolygons(data);
            } catch (error) {
                console.error('Error fetching polygons:', error);
            }
        };
        fetchPolygons();
    }, []);

    // ดึงข้อมูล Active EOC Session
    useEffect(() => {
        const fetchActiveSession = async () => {
            try {
                const response = await fetch('/api/eoc/flood/area-status');
                const result = await response.json();
                if (result.hasActiveSession && result.activeSession) {
                    setActiveSession(result.activeSession);
                }
            } catch (error) {
                console.error('Error fetching active session:', error);
            }
        };
        fetchActiveSession();
    }, []);

    // โหลดข้อมูล
    useEffect(() => {
        if (activeSession) {
            fetchRecords();
        }
    }, [filters, activeSession]);

    // อัพเดตตัวเลือกตำบลเมื่อเลือกอำเภอ
    useEffect(() => {
        if (formData.district) {
            const district = satunDistricts.find(d => d.name === formData.district);
            setTambonOptions(district?.tambons || []);
        } else {
            setTambonOptions([]);
        }
    }, [formData.district]);

    // อัพเดตตัวเลือกหมู่บ้านเมื่อเลือกตำบล
    useEffect(() => {
        if (formData.district && formData.tambon && polygons.length > 0) {
            const villages = polygons.filter(
                p => p.distname === formData.district && p.subdistnam === formData.tambon
            );
            setVillageOptions(villages);
        } else {
            setVillageOptions([]);
        }
    }, [formData.district, formData.tambon, polygons]);

    // คำนวณตำบลที่บันทึกแล้ววันนี้
    useEffect(() => {
        if (records.length > 0 && activeSession) {
            const today = new Date().toISOString().split('T')[0];
            const recorded = new Set();
            records.forEach(record => {
                const recordDate = record.flood_start_date?.split('T')[0];
                if (recordDate === today) {
                    recorded.add(`${record.district}-${record.tambon}`);
                }
            });
            setRecordedTambons(recorded);
        }
    }, [records, activeSession]);

    const fetchRecords = async () => {
        if (!activeSession) return;

        try {
            setLoading(true);
            const params = new URLSearchParams();
            params.append('year', new Date(activeSession.opened_at).getFullYear());
            if (filters.district !== 'all') params.append('district', filters.district);
            if (filters.tambon !== 'all') params.append('tambon', filters.tambon);
            if (filters.flood_level !== 'all') params.append('flood_level', filters.flood_level);

            const res = await fetch(`/api/admin/flood-records?${params}`);
            const data = await res.json();
            if (data.success) {
                setRecords(data.data);
            }
        } catch (error) {
            console.error('Error fetching records:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!activeSession) {
            alert('ไม่พบ EOC Session ที่เปิดอยู่');
            return;
        }

        try {
            const url = '/api/admin/flood-records';
            const method = editingRecord ? 'PUT' : 'POST';
            const today = new Date().toISOString().split('T')[0];

            // ถ้าเป็นโหมดตำบล ให้บันทึกทุกหมู่บ้านในตำบล
            if (isTambonMode && !editingRecord) {
                const villagesToSave = polygons.filter(
                    p => p.distname === formData.district && p.subdistnam === formData.tambon
                );

                if (villagesToSave.length === 0) {
                    alert('ไม่พบหมู่บ้านในตำบลนี้');
                    return;
                }

                let successCount = 0;
                let skippedCount = 0;

                for (const village of villagesToSave) {
                    // ตรวจสอบว่าหมู่บ้านนี้บันทึกไปแล้ววันนี้หรือยัง
                    const existingRecord = records.find(record => {
                        const recordDate = record.flood_start_date?.split('T')[0];
                        const recordVillage = record.village || record.villname;
                        const checkVillage = village.villname;
                        return recordDate === today &&
                            record.district === formData.district &&
                            record.tambon === formData.tambon &&
                            recordVillage === checkVillage;
                    });

                    if (existingRecord) {
                        skippedCount++;
                        continue; // ข้ามหมู่บ้านที่บันทึกไปแล้ว
                    }

                    const body = {
                        ...formData,
                        village: village.villname,
                        polygon_id: village.id,
                        year: new Date(activeSession.opened_at).getFullYear(),
                        status: 'กำลังดำเนินการ',
                        flood_end_date: null,
                        damage_amount: 0,
                        relief_amount: 0
                    };

                    try {
                        const res = await fetch(url, {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify(body)
                        });

                        const data = await res.json();
                        if (data.success) {
                            successCount++;
                        }
                    } catch (error) {
                        console.error('Error saving village:', village.villname, error);
                    }
                }

                const message = skippedCount > 0
                    ? `บันทึกข้อมูลสำเร็จ ${successCount} หมู่บ้าน (ข้าม ${skippedCount} หมู่บ้านที่บันทึกไปแล้ว)`
                    : `บันทึกข้อมูลสำเร็จ ${successCount} จาก ${villagesToSave.length} หมู่บ้าน`;

                alert(message);
                setShowModal(false);
                setEditingRecord(null);
                resetForm();
                // รีโหลดข้อมูลและ refresh หน้าเว็บ
                await fetchRecords();
                return;
            }

            // โหมดปกติ - บันทึกหมู่บ้านเดียว
            if (!editingRecord) {
                // ตรวจสอบว่าหมู่บ้านนี้มีข้อมูลวันนี้แล้วหรือยัง
                const existingRecord = records.find(record => {
                    const recordDate = record.flood_start_date?.split('T')[0];
                    const recordVillage = record.village || record.villname;
                    return recordDate === today &&
                        record.district === formData.district &&
                        record.tambon === formData.tambon &&
                        recordVillage === formData.village;
                });

                if (existingRecord) {
                    const confirmOverwrite = confirm(
                        `หมู่บ้าน ${formData.village} มีข้อมูลที่บันทึกไปแล้ววันนี้\n` +
                        `ต้องการบันทึกทับข้อมูลเดิมหรือไม่?`
                    );
                    if (!confirmOverwrite) {
                        return;
                    }

                    // ถ้ายืนยันให้บันทึกทับ ให้ลบข้อมูลเดิมก่อน
                    try {
                        await fetch(`/api/admin/flood-records?id=${existingRecord.id}`, {
                            method: 'DELETE'
                        });
                    } catch (error) {
                        console.error('Error deleting old record:', error);
                    }
                }
            }

            const selectedVillage = polygons.find(
                p => p.distname === formData.district &&
                    p.subdistnam === formData.tambon &&
                    p.villname === formData.village
            );

            const body = {
                ...formData,
                polygon_id: selectedVillage?.id || null,
                year: new Date(activeSession.opened_at).getFullYear(),
                status: 'กำลังดำเนินการ',
                flood_end_date: null,
                damage_amount: 0,
                relief_amount: 0
            };

            if (editingRecord) {
                body.id = editingRecord.id;
            }

            const res = await fetch(url, {
                method,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(body)
            });

            const data = await res.json();
            if (data.success) {
                alert(editingRecord ? 'แก้ไขข้อมูลสำเร็จ' : 'บันทึกข้อมูลสำเร็จ');
                setShowModal(false);
                setEditingRecord(null);
                resetForm();
                // รีโหลดข้อมูลหลังบันทึก
                await fetchRecords();
            } else {
                alert('เกิดข้อผิดพลาด: ' + data.error);
            }
        } catch (error) {
            console.error('Error saving record:', error);
            alert('เกิดข้อผิดพลาดในการบันทึกข้อมูล');
        }
    };

    const handleEdit = (record) => {
        setEditingRecord(record);
        setFormData({
            district: record.district,
            tambon: record.tambon,
            village: record.village || '',
            flood_level: record.flood_level,
            flood_start_date: record.flood_start_date?.split('T')[0] || '',
            water_depth_cm: record.water_depth_cm || '',
            affected_area_sqm: record.affected_area_sqm || '',
            affected_households: record.affected_households || 0,
            affected_people: record.affected_people || 0,
            description: record.description || ''
        });
        setShowModal(true);
    };

    const handleDelete = async (id) => {
        if (!confirm('ต้องการลบข้อมูลนี้หรือไม่?')) return;

        try {
            const res = await fetch(`/api/admin/flood-records?id=${id}`, {
                method: 'DELETE'
            });
            const data = await res.json();
            if (data.success) {
                fetchRecords();
                alert('ลบข้อมูลสำเร็จ');
            } else {
                alert('เกิดข้อผิดพลาด: ' + data.error);
            }
        } catch (error) {
            console.error('Error deleting record:', error);
            alert('เกิดข้อผิดพลาดในการลบข้อมูล');
        }
    };

    const resetForm = () => {
        setFormData({
            district: '',
            tambon: '',
            village: '',
            flood_level: 'ไม่มี',
            flood_start_date: '',
            water_depth_cm: '',
            affected_area_sqm: '',
            affected_households: 0,
            affected_people: 0,
            description: ''
        });
        setIsTambonMode(false);
    };

    // คำนวณสถานะของทุกตำบล
    const getAllTambonsStatus = () => {
        // ใช้วันที่ท้องถิ่นแทน toISOString() ที่ใช้ UTC
        const now = new Date();
        const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
        const allTambonsStatus = [];

        console.log('Today (local):', today);
        console.log('Records count:', records.length);

        satunDistricts.forEach(district => {
            district.tambons.forEach(tambon => {
                const key = `${district.name}-${tambon.name}`;

                // นับจำนวนหมู่บ้านในตำบลนี้จาก polygon data
                const villagesInTambon = polygons.filter(
                    p => p.distname === district.name && p.subdistnam === tambon.name
                );

                // นับจำนวน record ที่บันทึกไปแล้ววันนี้สำหรับตำบลนี้
                // ปรับปรุง: นับ record ที่ unique ต่อหมู่บ้าน (ไม่ซ้ำ)
                const recordedVillagesToday = records.filter(record => {
                    const recordDate = record.flood_start_date?.split('T')[0];
                    return recordDate === today &&
                        record.district === district.name &&
                        record.tambon === tambon.name;
                });

                // นับ unique villages ที่มีการบันทึก (ใช้ทั้ง village และ villname)
                const uniqueRecordedVillages = new Set(
                    recordedVillagesToday.map(r => r.village || r.villname).filter(Boolean)
                );
                const recordedCount = uniqueRecordedVillages.size;

                if (villagesInTambon.length > 0) {
                    const status = recordedCount >= villagesInTambon.length
                        ? 'complete'
                        : recordedCount > 0
                            ? 'partial'
                            : 'empty';

                    allTambonsStatus.push({
                        district: district.name,
                        tambon: tambon.name,
                        key: key,
                        totalVillages: villagesInTambon.length,
                        recordedVillages: recordedCount,
                        status: status
                    });

                    // Debug log สำหรับตำบลที่มีปัญหา
                    if (tambon.name === 'แป-ระ' || tambon.name === 'ทุ่งหว้า') {
                        console.log(`${tambon.name} Debug:`, {
                            district: district.name,
                            totalVillages: villagesInTambon.length,
                            recordedCount: recordedCount,
                            status: status,
                            uniqueVillages: Array.from(uniqueRecordedVillages),
                            allRecords: recordedVillagesToday.map(r => ({
                                village: r.village,
                                villname: r.villname,
                                date: r.flood_start_date
                            }))
                        });
                    }
                }
            });
        });

        return allTambonsStatus;
    };

    // คำนวณตำบลที่ยังไม่ได้บันทึก (สำหรับ backward compatibility)
    const getUnrecordedTambons = () => {
        return getAllTambonsStatus().filter(t => t.status !== 'complete');
    };

    // คำนวณตำบลที่บันทึกครบแล้ว
    const getCompletedTambons = () => {
        return getAllTambonsStatus().filter(t => t.status === 'complete');
    };

    const getFloodLevelColor = (level) => {
        const colors = {
            'ไม่มี': 'bg-gray-100 text-gray-800',
            'ต่ำ': 'bg-green-100 text-green-800',
            'ปานกลาง': 'bg-yellow-100 text-yellow-800',
            'สูง': 'bg-orange-100 text-orange-800',
            'สูงมาก': 'bg-red-100 text-red-800'
        };
        return colors[level] || 'bg-gray-100 text-gray-800';
    };

    if (!activeSession) {
        return (
            <EOCLayout>
                <div className="p-6">
                    <div className="bg-yellow-50 border-2 border-yellow-200 rounded-lg p-6 text-center">
                        <div className="text-6xl mb-4">⚠️</div>
                        <h3 className="text-xl font-bold text-gray-800 mb-2">ไม่มี EOC Session ที่เปิดอยู่</h3>
                        <p className="text-gray-600">
                            กรุณาเปิด EOC Session ก่อนบันทึกข้อมูลพื้นที่น้ำท่วม
                        </p>
                    </div>
                </div>
            </EOCLayout>
        );
    }

    return (
        <EOCLayout>
            <div className="p-6">
                {/* Header */}
                <div className="flex justify-between items-center mb-6">
                    <div>
                        <h1 className="text-3xl font-bold text-gray-800 mb-2 flex items-center gap-3">
                            <span className="text-4xl">💧</span>
                            บันทึกพื้นที่น้ำท่วม
                        </h1>
                        <p className="text-gray-600">
                            EOC Session #{activeSession.session_number} - {new Date(activeSession.opened_at).toLocaleDateString('th-TH')}
                        </p>
                    </div>
                    <button
                        onClick={() => {
                            setEditingRecord(null);
                            resetForm();
                            setShowModal(true);
                        }}
                        className="bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-2"
                    >
                        <span>➕</span>
                        เพิ่มข้อมูลใหม่
                    </button>
                </div>

                {/* สถานะการบันทึกตำบลวันนี้ */}
                <div className="mb-6">
                    <div className="flex items-center gap-4 mb-4">
                        <h3 className="font-bold text-gray-800">📊 สถานะการบันทึกวันนี้</h3>
                        <div className="flex gap-2 text-sm">
                            <span className="flex items-center gap-1">
                                <span className="w-3 h-3 bg-green-500 rounded-full"></span>
                                บันทึกครบ ({getCompletedTambons().length})
                            </span>
                            <span className="flex items-center gap-1">
                                <span className="w-3 h-3 bg-yellow-500 rounded-full"></span>
                                ยังไม่ครบ ({getUnrecordedTambons().length})
                            </span>
                        </div>
                    </div>

                    {/* ตำบลที่บันทึกครบแล้ว (สีเขียว) */}
                    {getCompletedTambons().length > 0 && (
                        <div className="bg-green-50 border-2 border-green-200 rounded-lg p-4 mb-4">
                            <h4 className="font-bold text-green-800 mb-2 flex items-center gap-2">
                                <span>✅</span>
                                ตำบลที่บันทึกครบแล้ว ({getCompletedTambons().length} ตำบล)
                            </h4>
                            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-2">
                                {getCompletedTambons().map((item) => (
                                    <div
                                        key={item.key}
                                        className="text-left px-3 py-2 bg-green-100 border border-green-300 rounded-lg text-sm"
                                    >
                                        <div className="font-medium text-green-800">{item.tambon}</div>
                                        <div className="text-xs text-green-600">อ.{item.district}</div>
                                        <div className="text-xs text-green-700 font-medium mt-1">
                                            ✓ {item.recordedVillages}/{item.totalVillages} หมู่บ้าน
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* ตำบลที่ยังบันทึกไม่ครบ (สีเหลือง) */}
                    {getUnrecordedTambons().length > 0 && (
                        <div className="bg-yellow-50 border-2 border-yellow-200 rounded-lg p-4">
                            <h4 className="font-bold text-gray-800 mb-2 flex items-center gap-2">
                                <span>⚠️</span>
                                ตำบลที่ยังบันทึกไม่ครบ ({getUnrecordedTambons().length} ตำบล) - คลิกเพื่อบันทึก
                            </h4>
                            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-2">
                                {getUnrecordedTambons().map((item) => (
                                    <button
                                        key={item.key}
                                        onClick={() => {
                                            setEditingRecord(null);
                                            setFormData({
                                                ...formData,
                                                district: item.district,
                                                tambon: item.tambon,
                                                village: '',
                                                flood_start_date: new Date().toISOString().split('T')[0]
                                            });
                                            setIsTambonMode(true);
                                            setShowModal(true);
                                        }}
                                        className={`text-left px-3 py-2 rounded-lg hover:opacity-80 transition-colors text-sm ${item.status === 'partial'
                                            ? 'bg-orange-100 border border-orange-300'
                                            : 'bg-white border border-yellow-300 hover:bg-yellow-50'
                                            }`}
                                    >
                                        <div className="font-medium text-gray-800">{item.tambon}</div>
                                        <div className="text-xs text-gray-500">อ.{item.district}</div>
                                        <div className={`text-xs font-medium mt-1 ${item.status === 'partial' ? 'text-orange-600' : 'text-red-600'
                                            }`}>
                                            {item.recordedVillages}/{item.totalVillages} หมู่บ้าน
                                        </div>
                                    </button>
                                ))}
                            </div>
                        </div>
                    )}
                </div>

                {/* Filters */}
                <div className="bg-white rounded-lg shadow p-4 mb-6">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">อำเภอ</label>
                            <select
                                value={filters.district}
                                onChange={(e) => setFilters({ ...filters, district: e.target.value, tambon: 'all' })}
                                className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                            >
                                <option value="all">ทั้งหมด</option>
                                {satunDistricts.map(d => (
                                    <option key={d.name} value={d.name}>{d.name}</option>
                                ))}
                            </select>
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">ตำบล</label>
                            <select
                                value={filters.tambon}
                                onChange={(e) => setFilters({ ...filters, tambon: e.target.value })}
                                disabled={filters.district === 'all'}
                                className="w-full px-3 py-2 border border-gray-300 rounded-lg disabled:bg-gray-100"
                            >
                                <option value="all">ทั้งหมด</option>
                                {filters.district !== 'all' && satunDistricts.find(d => d.name === filters.district)?.tambons.map(t => (
                                    <option key={t.name} value={t.name}>{t.name}</option>
                                ))}
                            </select>
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">ระดับน้ำท่วม</label>
                            <select
                                value={filters.flood_level}
                                onChange={(e) => setFilters({ ...filters, flood_level: e.target.value })}
                                className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                            >
                                <option value="all">ทั้งหมด</option>
                                <option value="ไม่มี">ไม่มี</option>
                                <option value="ต่ำ">ต่ำ</option>
                                <option value="ปานกลาง">ปานกลาง</option>
                                <option value="สูง">สูง</option>
                                <option value="สูงมาก">สูงมาก</option>
                            </select>
                        </div>
                    </div>
                </div>

                {/* Table */}
                <div className="bg-white rounded-lg shadow overflow-hidden">
                    {loading ? (
                        <div className="text-center py-8">
                            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500 mx-auto"></div>
                        </div>
                    ) : records.length === 0 ? (
                        <div className="text-center py-8 text-gray-500">
                            ไม่พบข้อมูล
                        </div>
                    ) : (
                        <table className="min-w-full divide-y divide-gray-200">
                            <thead className="bg-gray-50">
                                <tr>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">พื้นที่</th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">ระดับน้ำท่วม</th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">วันที่เริ่ม</th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">ผู้ได้รับผลกระทบ</th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">จัดการ</th>
                                </tr>
                            </thead>
                            <tbody className="bg-white divide-y divide-gray-200">
                                {records.map((record) => (
                                    <tr key={record.id} className="hover:bg-gray-50">
                                        <td className="px-6 py-4">
                                            <div className="text-sm font-medium text-gray-900">{record.village || '-'}</div>
                                            <div className="text-sm text-gray-500">{record.tambon}, {record.district}</div>
                                        </td>
                                        <td className="px-6 py-4">
                                            <span className={`px-2 py-1 text-xs font-medium rounded-full ${getFloodLevelColor(record.flood_level)}`}>
                                                {record.flood_level}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4 text-sm text-gray-500">
                                            {record.flood_start_date ? new Date(record.flood_start_date).toLocaleDateString('th-TH') : '-'}
                                        </td>
                                        <td className="px-6 py-4 text-sm text-gray-500">
                                            {record.affected_households} ครัวเรือน<br />
                                            {record.affected_people} คน
                                        </td>
                                        <td className="px-6 py-4 text-sm">
                                            <button
                                                onClick={() => handleEdit(record)}
                                                className="text-blue-600 hover:text-blue-800 mr-3"
                                            >
                                                แก้ไข
                                            </button>
                                            <button
                                                onClick={() => handleDelete(record.id)}
                                                className="text-red-600 hover:text-red-800"
                                            >
                                                ลบ
                                            </button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    )}
                </div>

                {/* Modal */}
                {showModal && (
                    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
                        <div className="bg-white rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto">
                            <div className="p-6">
                                <h2 className="text-2xl font-bold mb-4">
                                    {editingRecord ? 'แก้ไขข้อมูล' : isTambonMode ? 'บันทึกข้อมูลทั้งตำบล' : 'เพิ่มข้อมูลใหม่'}
                                </h2>

                                {isTambonMode && !editingRecord && (
                                    <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 mb-4">
                                        <p className="text-sm text-blue-800">
                                            🔵 โหมดบันทึกทั้งตำบล - ข้อมูลจะถูกบันทึกให้กับทุกหมู่บ้านในตำบล{formData.tambon} พร้อมกัน
                                        </p>
                                        <button
                                            type="button"
                                            onClick={() => setIsTambonMode(false)}
                                            className="mt-2 text-sm text-blue-600 hover:text-blue-800 underline"
                                        >
                                            เปลี่ยนเป็นโหมดบันทึกรายหมู่บ้าน
                                        </button>
                                    </div>
                                )}

                                <form onSubmit={handleSubmit} className="space-y-4">
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        <div>
                                            <label className="block text-sm font-medium text-gray-700 mb-1">
                                                อำเภอ <span className="text-red-500">*</span>
                                            </label>
                                            <select
                                                value={formData.district}
                                                onChange={(e) => setFormData({ ...formData, district: e.target.value, tambon: '' })}
                                                required
                                                className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                                            >
                                                <option value="">เลือกอำเภอ</option>
                                                {satunDistricts.map(d => (
                                                    <option key={d.name} value={d.name}>{d.name}</option>
                                                ))}
                                            </select>
                                        </div>
                                        <div>
                                            <label className="block text-sm font-medium text-gray-700 mb-1">
                                                ตำบล <span className="text-red-500">*</span>
                                            </label>
                                            <select
                                                value={formData.tambon}
                                                onChange={(e) => setFormData({ ...formData, tambon: e.target.value })}
                                                required
                                                disabled={!formData.district}
                                                className="w-full px-3 py-2 border border-gray-300 rounded-lg disabled:bg-gray-100"
                                            >
                                                <option value="">เลือกตำบล</option>
                                                {tambonOptions.map(t => (
                                                    <option key={t.name} value={t.name}>{t.name}</option>
                                                ))}
                                            </select>
                                        </div>
                                        <div>
                                            <label className="block text-sm font-medium text-gray-700 mb-1">
                                                หมู่บ้าน {!isTambonMode && <span className="text-red-500">*</span>}
                                            </label>
                                            {isTambonMode ? (
                                                <div className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-gray-50 text-gray-500">
                                                    บันทึกทุกหมู่บ้านในตำบล
                                                </div>
                                            ) : (
                                                <select
                                                    value={formData.village}
                                                    onChange={(e) => setFormData({ ...formData, village: e.target.value })}
                                                    required={!isTambonMode}
                                                    disabled={!formData.tambon || villageOptions.length === 0}
                                                    className="w-full px-3 py-2 border border-gray-300 rounded-lg disabled:bg-gray-100"
                                                >
                                                    <option value="">เลือกหมู่บ้าน</option>
                                                    {villageOptions.map(v => (
                                                        <option key={v.id} value={v.villname}>{v.villname}</option>
                                                    ))}
                                                </select>
                                            )}
                                            {!isTambonMode && formData.tambon && villageOptions.length === 0 && (
                                                <p className="text-xs text-gray-500 mt-1">ไม่พบหมู่บ้านในตำบลนี้</p>
                                            )}
                                        </div>
                                        <div>
                                            <label className="block text-sm font-medium text-gray-700 mb-1">
                                                ระดับน้ำท่วม <span className="text-red-500">*</span>
                                            </label>
                                            <select
                                                value={formData.flood_level}
                                                onChange={(e) => setFormData({ ...formData, flood_level: e.target.value })}
                                                required
                                                className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                                            >
                                                <option value="ไม่มี">ไม่มี</option>
                                                <option value="ต่ำ">ต่ำ</option>
                                                <option value="ปานกลาง">ปานกลาง</option>
                                                <option value="สูง">สูง</option>
                                                <option value="สูงมาก">สูงมาก</option>
                                            </select>
                                        </div>
                                        <div>
                                            <label className="block text-sm font-medium text-gray-700 mb-1">
                                                วันที่เริ่มน้ำท่วม <span className="text-red-500">*</span>
                                            </label>
                                            <input
                                                type="date"
                                                value={formData.flood_start_date}
                                                onChange={(e) => setFormData({ ...formData, flood_start_date: e.target.value })}
                                                required
                                                className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-sm font-medium text-gray-700 mb-1">ความลึกของน้ำ (ซม.)</label>
                                            <input
                                                type="number"
                                                value={formData.water_depth_cm}
                                                onChange={(e) => setFormData({ ...formData, water_depth_cm: e.target.value })}
                                                className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-sm font-medium text-gray-700 mb-1">พื้นที่ได้รับผลกระทบ (ตร.ม.)</label>
                                            <input
                                                type="number"
                                                value={formData.affected_area_sqm}
                                                onChange={(e) => setFormData({ ...formData, affected_area_sqm: e.target.value })}
                                                className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-sm font-medium text-gray-700 mb-1">จำนวนครัวเรือน</label>
                                            <input
                                                type="number"
                                                value={formData.affected_households}
                                                onChange={(e) => setFormData({ ...formData, affected_households: parseInt(e.target.value) || 0 })}
                                                className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-sm font-medium text-gray-700 mb-1">จำนวนประชากร</label>
                                            <input
                                                type="number"
                                                value={formData.affected_people}
                                                onChange={(e) => setFormData({ ...formData, affected_people: parseInt(e.target.value) || 0 })}
                                                className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                                            />
                                        </div>
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">รายละเอียดเพิ่มเติม</label>
                                        <textarea
                                            value={formData.description}
                                            onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                                            rows="3"
                                            className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                                        />
                                    </div>
                                    <div className="flex gap-2 justify-end pt-4">
                                        <button
                                            type="button"
                                            onClick={() => {
                                                setShowModal(false);
                                                setEditingRecord(null);
                                                resetForm();
                                            }}
                                            className="px-6 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
                                        >
                                            ยกเลิก
                                        </button>
                                        <button
                                            type="submit"
                                            className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                                        >
                                            {editingRecord ? 'บันทึกการแก้ไข' : 'บันทึก'}
                                        </button>
                                    </div>
                                </form>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </EOCLayout>
    );
}
