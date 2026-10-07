"use client";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useSatunDistricts } from "@/lib/useSatunDistricts";
import { showError, showSuccess, showDeleteConfirm } from '@/lib/sweetAlert';
import { formatEocDisplayName } from "@/lib/eocDisplay";
import PaginationControls, { paginateRows } from '@/components/common/PaginationControls';
import AppIcon from "@/components/icons/AppIcon";
import { buildDiseaseChoices } from '@/lib/diseaseNames';

// eocType: เหตุการณ์ที่ใช้ผูกข้อมูล ("disease" = EOC โรคระบาด, "flood" = โรคในชุมชนช่วงน้ำท่วม)
// priorityDiseases: โรคที่ให้ขึ้นก่อนในรายการ (เช่น โรคที่มักตามมาหลังน้ำท่วม)
export default function DailyDiseaseRecords({ eocType = 'disease', title, subtitle, priorityDiseases = [] }) {
    const satunDistricts = useSatunDistricts();
    const priorityKey = priorityDiseases.join('|');
    const [records, setRecords] = useState([]);
    // สิทธิ์จากเซิร์ฟเวอร์: ทีมเจ้าของเมนูบันทึกได้ ทีมอื่นดูอย่างเดียว
    const [permissions, setPermissions] = useState({ can_edit: false, read_only_message: null });
    const canEdit = permissions.can_edit === true;
    const [loading, setLoading] = useState(true);
    const [showModal, setShowModal] = useState(false);
    const [editingRecord, setEditingRecord] = useState(null);
    const [activeSession, setActiveSession] = useState(null);
    const [polygons, setPolygons] = useState([]);
    const [healthFacilities, setHealthFacilities] = useState([]);
    const [villageOptions, setVillageOptions] = useState([]);
    const [recordedTambons, setRecordedTambons] = useState(new Set());
    const [isTambonMode, setIsTambonMode] = useState(false);
    const [commonDiseases, setCommonDiseases] = useState([]); // รายการโรคจาก database
    const [showOtherInput, setShowOtherInput] = useState(false); // แสดง input โรคอื่นๆ
    const [customDisease, setCustomDisease] = useState(''); // ชื่อโรคที่กรอกเอง
    const [currentPage, setCurrentPage] = useState(1);
    const [pageSize, setPageSize] = useState(20);
    const [filters, setFilters] = useState({
        district: 'all',
        tambon: 'all',
        severity_level: 'all'
    });

    const [formData, setFormData] = useState({
        district: '',
        tambon: '',
        village: '',
        disease_name: 'ไข้เลือดออก',
        report_date: '',
        patient_count: 0,
        notes: ''
    });

    const [tambonOptions, setTambonOptions] = useState([]);
    const activeDiseaseEocName = eocType !== 'disease'
        ? (title || 'โรคในพื้นที่')
        : activeSession
            ? formatEocDisplayName({ eoc_type: 'disease', ...activeSession })
            : 'โรคระบาด';

    // ดึงข้อมูล polygon หมู่บ้าน
    useEffect(() => {
        const fetchPolygons = async () => {
            try {
                const response = await fetch('/stn-eoc/api/common/village-polygons');
                const data = await response.json();
                setPolygons(data);
            } catch (error) {
                console.error('Error fetching polygons:', error);
            }
        };
        fetchPolygons();
    }, []);

    // ดึงรายการโรคจาก database
    useEffect(() => {
        const fetchDiseases = async () => {
            try {
                const response = await fetch('/stn-eoc/api/common/diseases');
                const result = await response.json();
                if (result.success && result.data) {
                    // ชื่อมาตรฐานไม่ซ้ำ โรคที่ให้ขึ้นก่อนอยู่บนสุด และ "อื่นๆ" ท้ายสุด
                    setCommonDiseases(buildDiseaseChoices(result.data, priorityKey ? priorityKey.split('|') : []));
                }
            } catch (error) {
                console.error('Error fetching diseases:', error);
                // ใช้รายการ default
                setCommonDiseases(buildDiseaseChoices(['ไข้เลือดออก', 'โควิด-19', 'มือเท้าปาก', 'ไข้หวัดใหญ่', 'อุจจาระร่วง', 'โรคผิวหนัง'], priorityKey ? priorityKey.split('|') : []));
            }
        };
        fetchDiseases();
    }, [priorityKey]);

    // ดึงข้อมูล health facilities
    useEffect(() => {
        const fetchHealthFacilities = async () => {
            try {
                const response = await fetch('/stn-eoc/api/admin/health-facilities');
                const result = await response.json();
                if (result.success) {
                    setHealthFacilities(result.data || []);
                }
            } catch (error) {
                console.error('Error fetching health facilities:', error);
            }
        };
        fetchHealthFacilities();
    }, []);

    // ดึงข้อมูล Active EOC Session
    useEffect(() => {
        const fetchActiveSession = async () => {
            try {
                const response = await fetch(`/stn-eoc/api/eoc/${eocType}/area-status`);
                const result = await response.json();
                if (result.hasActiveSession && result.activeSession) {
                    setActiveSession(result.activeSession);
                } else {
                    console.error('No active session found!', result);
                }
            } catch (error) {
                console.error('Error fetching active session:', error);
            }
        };
        fetchActiveSession();
    }, [eocType]);

    // อัพเดตตัวเลือกตำบลเมื่อเลือกอำเภอ
    useEffect(() => {
        if (formData.district) {
            const district = satunDistricts.find(d => d.name === formData.district);
            setTambonOptions(district?.tambons || []);
        } else {
            setTambonOptions([]);
        }
    }, [formData.district, satunDistricts]);

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

    const fetchRecords = useCallback(async () => {
        if (!activeSession) return;

        try {
            setLoading(true);
            const params = new URLSearchParams();
            params.append('session_id', activeSession.id);
            if (filters.district !== 'all') params.append('district', filters.district);
            if (filters.tambon !== 'all') params.append('tambon', filters.tambon);

            const res = await fetch(`/stn-eoc/api/admin/disease-reports?${params}`);
            const data = await res.json();

            if (data.success) {
                setRecords(data.data || []);
                if (data.permissions) setPermissions(data.permissions);

                // อัพเดทตำบลที่บันทึกแล้ววันนี้
                const now = new Date();
                const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
                const recorded = new Set();
                (data.data || []).forEach(record => {
                    const recordDate = record.report_date?.split('T')[0];
                    if (recordDate === today) {
                        recorded.add(`${record.district_name}-${record.tambon_name}`);
                    }
                });
                setRecordedTambons(recorded);
            }
        } catch (error) {
            console.error('Error fetching records:', error);
        } finally {
            setLoading(false);
        }
    }, [activeSession, filters]);

    // โหลดข้อมูล
    useEffect(() => {
        if (activeSession) {
            fetchRecords();
        }
    }, [activeSession, fetchRecords]);

    useEffect(() => {
        setCurrentPage(1);
    }, [filters]);

    const paginatedRecords = useMemo(
        () => paginateRows(records, currentPage, pageSize),
        [records, currentPage, pageSize]
    );

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!activeSession) {
            showError('ไม่พบเหตุการณ์ EOC ที่เปิดอยู่');
            return;
        }

        try {
            const now = new Date();
            const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;

            // ถ้าเลือก "อื่นๆ" ให้ใช้ชื่อโรคที่กรอกเอง และเพิ่มเข้า database
            let diseaseName = formData.disease_name;
            if (showOtherInput && customDisease.trim()) {
                diseaseName = customDisease.trim();
                // เพิ่มโรคใหม่เข้า database
                try {
                    const addRes = await fetch('/stn-eoc/api/common/diseases', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ name: diseaseName })
                    });
                    const addResult = await addRes.json();
                    if (addResult.success) {
                        diseaseName = addResult.name || diseaseName; // ชื่อมาตรฐานที่ระบบบันทึก
                        // รีเฟรช dropdown
                        const dRes = await fetch('/stn-eoc/api/common/diseases');
                        const dResult = await dRes.json();
                        if (dResult.success) {
                            setCommonDiseases(buildDiseaseChoices(dResult.data, priorityKey ? priorityKey.split('|') : []));
                        }
                    } else if (addResult.existing_name) {
                        diseaseName = addResult.existing_name;
                    }
                } catch (err) {
                    console.error('Could not add disease to database:', err);
                }
            }

            // ถ้าเป็นโหมดตำบล ให้บันทึกทุกหน่วยบริการในตำบล
            if (isTambonMode && !editingRecord) {
                const facilitiesToSave = healthFacilities.filter(
                    hf => hf.district_name === formData.district && hf.tambon_name === formData.tambon
                );

                if (facilitiesToSave.length === 0) {
                    showError('ไม่พบหน่วยบริการในตำบลนี้');
                    return;
                }

                let successCount = 0;

                for (const facility of facilitiesToSave) {
                    const body = {
                        report_date: formData.report_date || today,
                        health_facility_id: facility.id,
                        disease_name: diseaseName,
                        patient_count: parseInt(formData.patient_count) || 0,
                        notes: formData.notes,
                        session_id: activeSession.id
                    };

                    try {
                        const res = await fetch('/stn-eoc/api/admin/disease-reports', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify(body)
                        });

                        const data = await res.json();
                        if (data.success) {
                            successCount++;
                        }
                    } catch (error) {
                        console.error('Error saving facility:', facility.name, error);
                    }
                }

                showSuccess(`บันทึกข้อมูลสำเร็จ ${successCount} หน่วยบริการ`);
                setFilters({ district: 'all', tambon: 'all', severity_level: 'all' });
                await fetchRecords();
                setShowModal(false);
                setEditingRecord(null);
                resetForm();
                return;
            }

            // โหมดปกติ - บันทึกหน่วยบริการเดียว
            // บันทึกระดับหมู่บ้านให้สอดคล้องกับข้อมูลจาก Google Sheet
            const selectedVillage = polygons.find(p => String(p.id) === String(formData.village));

            if (!selectedVillage && !editingRecord) {
                showError('กรุณาเลือกหมู่บ้าน/หมู่ที่ต้องการบันทึก');
                return;
            }

            // fallback สำหรับการแก้ไขข้อมูลเก่าที่ยังเป็นระดับหน่วยบริการ
            const selectedFacility = healthFacilities.find(
                hf => hf.district_name === formData.district && hf.tambon_name === formData.tambon
            );

            const url = editingRecord
                ? `/stn-eoc/api/admin/disease-reports?id=${editingRecord.id}`
                : '/stn-eoc/api/admin/disease-reports';
            const method = editingRecord ? 'PUT' : 'POST';

            const body = {
                report_date: formData.report_date || today,
                health_facility_id: selectedVillage ? null : editingRecord?.health_facility_id || selectedFacility?.id || null,
                village_polygon_id: selectedVillage?.id || editingRecord?.village_polygon_id || null,
                district_name: selectedVillage?.distname || formData.district,
                tambon_name: selectedVillage?.subdistnam || formData.tambon,
                moo: selectedVillage?.moo || editingRecord?.moo || null,
                village_name: selectedVillage?.villname || editingRecord?.village_name || null,
                disease_name: diseaseName,
                patient_count: parseInt(formData.patient_count) || 0,
                notes: formData.notes,
                session_id: activeSession.id
            };

            const res = await fetch(url, {
                method,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(body)
            });

            const data = await res.json();
            if (data.success) {
                showSuccess(editingRecord ? 'แก้ไขข้อมูลสำเร็จ' : 'บันทึกข้อมูลสำเร็จ');
                if (!editingRecord) {
                    setFilters({ district: 'all', tambon: 'all', severity_level: 'all' });
                }
                await fetchRecords();
                setShowModal(false);
                setEditingRecord(null);
                resetForm();
            } else {
                showError('เกิดข้อผิดพลาด: ' + data.message);
            }
        } catch (error) {
            console.error('Error in handleSubmit:', error);
            showError('เกิดข้อผิดพลาดในการบันทึกข้อมูล');
        }
    };

    const handleEdit = (record) => {
        setEditingRecord(record);
        setFormData({
            district: record.district_name || '',
            tambon: record.tambon_name || '',
            village: record.village_polygon_id ? String(record.village_polygon_id) : '',
            disease_name: record.disease_name || 'ไข้เลือดออก',
            report_date: record.report_date?.split('T')[0] || '',
            patient_count: record.patient_count || 0,
            notes: record.notes || ''
        });
        setShowModal(true);
    };

    const handleDelete = async (id) => {
        const confirmed = await showDeleteConfirm();
        if (!confirmed) return;

        try {
            const res = await fetch(`/stn-eoc/api/admin/disease-reports?id=${id}`, {
                method: 'DELETE'
            });
            const data = await res.json();
            if (data.success) {
                fetchRecords();
                showSuccess('ลบข้อมูลสำเร็จ');
            } else {
                showError('เกิดข้อผิดพลาด: ' + data.message);
            }
        } catch (error) {
            console.error('Error deleting record:', error);
            showError('เกิดข้อผิดพลาดในการลบข้อมูล');
        }
    };

    const resetForm = () => {
        const now = new Date();
        const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
        setFormData({
            district: '',
            tambon: '',
            village: '',
            disease_name: 'ไข้เลือดออก',
            report_date: today,
            patient_count: 0,
            notes: ''
        });
        setIsTambonMode(false);
    };

    // คำนวณสถานะของทุกตำบล (ใช้ polygon data เหมือน flood records)
    const getAllTambonsStatus = () => {
        const now = new Date();
        const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
        const allTambonsStatus = [];

        satunDistricts.forEach(district => {
            district.tambons.forEach(tambon => {
                const key = `${district.name}-${tambon.name}`;

                // นับจำนวนหมู่บ้านในตำบลนี้จาก polygon data
                const villagesInTambon = polygons.filter(
                    p => p.distname === district.name && p.subdistnam === tambon.name && p.villname
                );
                const uniqueVillages = new Set(villagesInTambon.map(p => p.villname));
                const totalVillages = uniqueVillages.size;

                // นับจำนวน record ที่บันทึกไปแล้ววันนี้สำหรับตำบลนี้
                const recordedToday = records.filter(record => {
                    const recordDate = record.report_date?.split('T')[0];
                    return recordDate === today &&
                        (record.district_name === district.name || record.district === district.name) &&
                        (record.tambon_name === tambon.name || record.tambon === tambon.name);
                });

                const recordedCount = recordedToday.length;
                const totalPatients = recordedToday.reduce((sum, r) => sum + (r.patient_count || 0), 0);

                // แสดงทุกตำบลที่มีหมู่บ้าน
                if (totalVillages > 0) {
                    const status = recordedCount > 0 ? 'partial' : 'empty';

                    allTambonsStatus.push({
                        district: district.name,
                        tambon: tambon.name,
                        key: key,
                        totalVillages: totalVillages,
                        recordedVillages: recordedCount,
                        totalPatients: totalPatients,
                        status: status
                    });
                }
            });
        });

        return allTambonsStatus;
    };

    const getUnrecordedTambons = () => {
        return getAllTambonsStatus().filter(t => t.status !== 'complete');
    };

    const getCompletedTambons = () => {
        return getAllTambonsStatus().filter(t => t.status === 'complete');
    };

    const getSeverityColor = (count) => {
        if (count >= 300) return 'bg-red-100 text-red-800';
        if (count >= 100) return 'bg-yellow-100 text-yellow-800';
        if (count >= 1) return 'bg-[#dbeaf7] text-[#083865]';
        return 'bg-green-100 text-green-800';
    };

    const getSeverityLabel = (count) => {
        if (count >= 300) return 'ระบาดหนัก';
        if (count >= 100) return 'ระบาดปานกลาง';
        if (count >= 1) return 'เฝ้าระวัง';
        return 'ปลอดภัย';
    };

    if (!activeSession) {
        return (
            <>
                <div className="p-6">
                    <div className="bg-yellow-50 border-2 border-yellow-200 rounded-lg p-6 text-center">
                        <div className="text-6xl mb-4"><AppIcon icon="alert" className="inline-block h-[1em] w-[1em] shrink-0 align-[-0.125em]" /></div>
                        <h3 className="text-xl font-bold text-gray-800 mb-2">ไม่มีเหตุการณ์ EOC ที่เปิดอยู่</h3>
                        <p className="text-gray-600">
                            {eocType === 'flood' ? 'บันทึกโรคในพื้นที่ได้เมื่อเปิด EOC อุทกภัยน้ำท่วมแล้ว' : 'กรุณาเปิดเหตุการณ์ EOC โรคระบาดก่อนบันทึกข้อมูล'}
                        </p>
                    </div>
                </div>
            </>
        );
    }

    return (
        <>
            <div className="p-6">
                {/* Header */}
                <div className="flex justify-between items-center mb-6">
                    <div>
                        <h1 className="text-2xl font-black text-slate-900 mb-2 flex items-center gap-3">
                            <span className="text-4xl"><AppIcon icon="biohazard" className="inline-block h-[1em] w-[1em] shrink-0 align-[-0.125em]" /></span>
                            {eocType === 'disease' ? `บันทึกพื้นที่ ${activeDiseaseEocName}` : activeDiseaseEocName}
                        </h1>
                        <p className="text-gray-600">
                            {subtitle ? `${subtitle} · ` : ''}เหตุการณ์ครั้งที่ {activeSession.session_number} เปิดเมื่อ {new Date(activeSession.opened_at).toLocaleDateString('th-TH')}
                        </p>
                        {eocType === 'disease' && activeSession.disease_name && (
                            <p className="mt-1 text-sm font-semibold text-[#0b4c86]">
                                ประเภท EOC ที่เปิดติดตาม: {activeDiseaseEocName}
                            </p>
                        )}
                    </div>
                    {canEdit && <button
                        onClick={() => {
                            setEditingRecord(null);
                            resetForm();
                            setShowModal(true);
                        }}
                        className="bg-[#0b4c86] text-white px-6 py-3 rounded-lg hover:bg-[#083865] transition-colors flex items-center gap-2"
                    >
                        <span><AppIcon icon="plus" className="inline-block h-[1em] w-[1em] shrink-0 align-[-0.125em]" /></span>
                        เพิ่มข้อมูลใหม่
                    </button>}
                </div>
                {!canEdit && permissions.read_only_message ? (
                    <p className="mb-6 rounded-xl border border-[#c9dcee] bg-[#edf5fc] px-4 py-3 text-sm text-[#083865]" role="status">{permissions.read_only_message}</p>
                ) : null}

                {/* สถานะการบันทึกตำบลวันนี้ */}
                <div className="mb-6">
                    <div className="flex items-center gap-4 mb-4">
                        <h3 className="font-bold text-gray-800"><AppIcon icon="barChart" className="inline-block h-[1em] w-[1em] shrink-0 align-[-0.125em]" /> สถานะการบันทึกวันนี้</h3>
                        <div className="flex gap-2 text-sm">
                            <span className="text-gray-600 flex items-center gap-1">
                                <span className="w-3 h-3 bg-green-500 rounded-full"></span>
                                บันทึกครบ ({getCompletedTambons().length})
                            </span>
                            <span className="text-gray-600 flex items-center gap-1">
                                <span className="w-3 h-3 bg-yellow-500 rounded-full"></span>
                                บันทึกบางส่วน ({getAllTambonsStatus().filter(t => t.status === 'partial').length})
                            </span>
                            <span className="text-gray-600 flex items-center gap-1">
                                <span className="w-3 h-3 bg-gray-400 rounded-full"></span>
                                ยังไม่ได้บันทึก ({getAllTambonsStatus().filter(t => t.status === 'empty').length})
                            </span>
                        </div>
                    </div>

                    {/* ตำบลที่บันทึกครบแล้ว (สีเขียว) */}
                    {getCompletedTambons().length > 0 && (
                        <div className="bg-green-50 border-2 border-green-200 rounded-lg p-4 mb-4">
                            <h4 className="font-bold text-green-800 mb-2 flex items-center gap-2">
                                <span><AppIcon icon="checkCircle" className="inline-block h-[1em] w-[1em] shrink-0 align-[-0.125em]" /></span>
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
                                            <AppIcon icon="check" className="inline-block h-4 w-4" /> {item.recordedVillages}/{item.totalVillages} หมู่บ้าน
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
                                <span><AppIcon icon="alert" className="inline-block h-[1em] w-[1em] shrink-0 align-[-0.125em]" /></span>
                                ตำบลที่ยังบันทึกไม่ครบ ({getUnrecordedTambons().length} ตำบล) - คลิกเพื่อบันทึก
                            </h4>
                            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-2">
                                {getUnrecordedTambons().map((item) => (
                                    <button
                                        key={item.key}
                                        disabled={!canEdit}
                                        onClick={() => {
                                            setEditingRecord(null);
                                            const now = new Date();
                                            const localDate = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
                                            setFormData({
                                                ...formData,
                                                district: item.district,
                                                tambon: item.tambon,
                                                village: '',
                                                report_date: localDate
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
                                        <div className={`text-xs font-medium mt-1 ${item.status === 'partial' ? 'text-orange-600' : 'text-gray-500'
                                            }`}>
                                            {item.totalVillages} หมู่บ้าน
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
                                className="text-gray-600 w-full px-3 py-2 border border-gray-300 rounded-lg"
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
                                className="text-gray-600 w-full px-3 py-2 border border-gray-300 rounded-lg disabled:bg-gray-100"
                            >
                                <option value="all">ทั้งหมด</option>
                                {filters.district !== 'all' && satunDistricts.find(d => d.name === filters.district)?.tambons.map(t => (
                                    <option key={t.name} value={t.name}>{t.name}</option>
                                ))}
                            </select>
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">ระดับการระบาด</label>
                            <select
                                value={filters.severity_level}
                                onChange={(e) => setFilters({ ...filters, severity_level: e.target.value })}
                                className="text-gray-600 w-full px-3 py-2 border border-gray-300 rounded-lg"
                            >
                                <option value="all">ทั้งหมด</option>
                                <option value="safe">ปลอดภัย (0 คน)</option>
                                <option value="mild">เฝ้าระวัง (1-99 คน)</option>
                                <option value="moderate">ระบาดปานกลาง (100-299 คน)</option>
                                <option value="severe">ระบาดหนัก (300+ คน)</option>
                            </select>
                        </div>
                    </div>
                </div>

                {/* Table */}
                <div className="bg-white rounded-lg shadow overflow-hidden">
                    <div className="p-4 bg-gray-50 border-b border-gray-200">
                        <h3 className="font-bold text-gray-800"><AppIcon icon="clipboard" className="inline-block h-[1em] w-[1em] shrink-0 align-[-0.125em]" /> ตารางข้อมูลที่บันทึกแล้ว</h3>
                        <p className="text-sm text-gray-600 mt-1">แสดงข้อมูลทั้งหมด {records.length} รายการ</p>
                    </div>

                    {loading ? (
                        <div className="text-center py-8">
                            <div className="animate-spin rounded-full h-8 w-8 border-b border-[#0b4c86] mx-auto mb-2"></div>
                            <p className="text-gray-600 text-sm">กำลังโหลดข้อมูล...</p>
                        </div>
                    ) : records.length === 0 ? (
                        <div className="text-center py-12">
                            <div className="text-6xl mb-4 text-slate-300"><AppIcon icon="file" className="inline-block h-[1em] w-[1em] shrink-0 align-[-0.125em]" /></div>
                            <h4 className="text-lg font-bold text-slate-800 mb-1">ยังไม่มีรายงานผู้ป่วยในพื้นที่</h4>
                            <p className="mx-auto max-w-md text-sm text-slate-500">
                                บันทึกจำนวนผู้ป่วยรายหมู่บ้านจากหน่วยบริการหรือทีมลงพื้นที่ ตัวเลขจะขึ้นในหน้าภาพรวมและสรุปการประชุมทันที
                            </p>
                            {canEdit && <button
                                type="button"
                                onClick={() => { setEditingRecord(null); resetForm(); setShowModal(true); }}
                                className="mt-4 inline-flex items-center gap-2 rounded-lg bg-[#0b4c86] px-5 py-2.5 text-sm font-bold text-white hover:bg-[#083865]"
                            >
                                <AppIcon icon="plus" className="inline-block h-[1em] w-[1em] shrink-0 align-[-0.125em]" />
                                บันทึกรายงานแรก
                            </button>}
                        </div>
                    ) : (
                        <div className="overflow-x-auto">
                            <table className="min-w-full divide-y divide-gray-200">
                                <thead className="bg-gray-50">
                                    <tr>
                                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                            #
                                        </th>
                                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                            พื้นที่
                                        </th>
                                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                            โรค
                                        </th>
                                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                            วันที่
                                        </th>
                                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                            จำนวนผู้ป่วย
                                        </th>
                                        <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                                            จัดการ
                                        </th>
                                    </tr>
                                </thead>
                                <tbody className="bg-white divide-y divide-gray-200">
                                    {paginatedRecords.map((record, index) => (
                                        <tr key={record.id} className="hover:bg-gray-50 transition-colors">
                                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                                {((currentPage - 1) * pageSize) + index + 1}
                                            </td>
                                            <td className="px-6 py-4">
                                                <div className="text-sm font-medium text-gray-900">
                                                    {record.facility_name || (record.moo || record.village_name ? `หมู่ ${record.moo || '-'} ${record.village_name || ''}` : '-')}
                                                </div>
                                                <div className="text-sm text-gray-500">ต.{record.tambon_name} อ.{record.district_name}</div>
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap">
                                                <span className="px-3 py-1 text-xs font-medium rounded-full bg-[#dbeaf7] text-[#083865]">
                                                    <AppIcon icon="biohazard" className="inline-block h-[1em] w-[1em] shrink-0 align-[-0.125em]" /> {record.disease_name}
                                                </span>
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                                {record.report_date ? new Date(record.report_date).toLocaleDateString('th-TH', {
                                                    year: 'numeric',
                                                    month: 'long',
                                                    day: 'numeric'
                                                }) : '-'}
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap">
                                                <span className={`px-3 py-1 text-xs font-medium rounded-full ${getSeverityColor(record.patient_count)}`}>
                                                    {record.patient_count || 0} คน - {getSeverityLabel(record.patient_count)}
                                                </span>
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap text-center">
                                                {canEdit && <>
                                                <button
                                                    onClick={() => handleEdit(record)}
                                                    className="text-[#0b4c86] hover:text-[#083865] mr-3 px-3 py-1 rounded hover:bg-[#edf5fc] transition-colors"
                                                    title="แก้ไขข้อมูล"
                                                >
                                                    <AppIcon icon="edit" className="inline-block h-[1em] w-[1em] shrink-0 align-[-0.125em]" /> แก้ไข
                                                </button>
                                                <button
                                                    onClick={() => handleDelete(record.id)}
                                                    className="text-red-600 hover:text-red-800 px-3 py-1 rounded hover:bg-red-50 transition-colors"
                                                    title="ลบข้อมูล"
                                                >
                                                    <AppIcon icon="trash" className="inline-block h-[1em] w-[1em] shrink-0 align-[-0.125em]" /> ลบ
                                                </button>
                                                </>}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                    <PaginationControls
                        page={currentPage}
                        pageSize={pageSize}
                        totalItems={records.length}
                        onPageChange={setCurrentPage}
                        onPageSizeChange={setPageSize}
                    />
                </div>

                {/* Modal */}
                {showModal && (
                    <div className="app-modal-overlay" role="dialog" aria-modal="true">
                        <div className="bg-white rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto">
                            <div className="p-6">
                                <h2 className="text-gray-700 text-2xl font-bold mb-4">
                                    {editingRecord ? 'แก้ไขข้อมูล' : isTambonMode ? 'บันทึกข้อมูลทั้งตำบล' : 'เพิ่มข้อมูลใหม่'}
                                </h2>

                                {isTambonMode && !editingRecord && (
                                    <div className="bg-[#edf5fc] border border-[#c9dcee] rounded-lg p-3 mb-4">
                                        <p className="text-sm text-[#083865]">
                                            <AppIcon icon="statusPurple" className="inline-block h-[1em] w-[1em] shrink-0 align-[-0.125em]" /> โหมดบันทึกทั้งตำบล - ข้อมูลจะถูกบันทึกให้กับทุกหน่วยบริการในตำบล{formData.tambon} พร้อมกัน
                                        </p>
                                        <button
                                            type="button"
                                            onClick={() => setIsTambonMode(false)}
                                            className="mt-2 text-sm text-[#0b4c86] hover:text-[#083865] underline"
                                        >
                                            เปลี่ยนเป็นโหมดบันทึกรายหน่วยบริการ
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
                                                onChange={(e) => setFormData({ ...formData, district: e.target.value, tambon: '', village: '' })}
                                                required
                                                className="text-gray-600 w-full px-3 py-2 border border-gray-300 rounded-lg"
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
                                                onChange={(e) => setFormData({ ...formData, tambon: e.target.value, village: '' })}
                                                required
                                                disabled={!formData.district}
                                                className="text-gray-600 w-full px-3 py-2 border border-gray-300 rounded-lg disabled:bg-gray-100"
                                            >
                                                <option value="">เลือกตำบล</option>
                                                {tambonOptions.map(t => (
                                                    <option key={t.name} value={t.name}>{t.name}</option>
                                                ))}
                                            </select>
                                        </div>
                                        {!isTambonMode && (
                                            <div>
                                                <label className="block text-sm font-medium text-gray-700 mb-1">
                                                    หมู่บ้าน / หมู่ <span className="text-red-500">*</span>
                                                </label>
                                                <select
                                                    value={formData.village}
                                                    onChange={(e) => setFormData({ ...formData, village: e.target.value })}
                                                    required={!isTambonMode}
                                                    disabled={!formData.district || !formData.tambon}
                                                    className="text-gray-600 w-full px-3 py-2 border border-gray-300 rounded-lg disabled:bg-gray-100"
                                                >
                                                    <option value="">เลือกหมู่บ้าน/หมู่</option>
                                                    {villageOptions.map(village => (
                                                        <option key={village.id} value={String(village.id)}>
                                                            หมู่ {village.moo || '-'} {village.villname || 'ไม่ระบุชื่อหมู่บ้าน'}
                                                        </option>
                                                    ))}
                                                </select>
                                                <p className="mt-1 text-xs text-gray-500">
                                                    ใช้บันทึกข้อมูลระดับหมู่ให้ตรงกับช่อง “หมู่ขณะป่วย” ใน Google Sheet
                                                </p>
                                            </div>
                                        )}
                                        <div>
                                            <label className="block text-sm font-medium text-gray-700 mb-1">
                                                โรค <span className="text-red-500">*</span>
                                            </label>
                                            <select
                                                value={formData.disease_name}
                                                onChange={(e) => {
                                                    const value = e.target.value;
                                                    setFormData({ ...formData, disease_name: value });
                                                    if (value === 'อื่นๆ') {
                                                        setShowOtherInput(true);
                                                    } else {
                                                        setShowOtherInput(false);
                                                        setCustomDisease('');
                                                    }
                                                }}
                                                required
                                                className="text-gray-600 w-full px-3 py-2 border border-gray-300 rounded-lg"
                                            >
                                                <option value="">เลือกโรค</option>
                                                {commonDiseases.map(disease => (
                                                    <option key={disease} value={disease}>{disease}</option>
                                                ))}
                                            </select>
                                            {showOtherInput && (
                                                <input
                                                    type="text"
                                                    value={customDisease}
                                                    onChange={(e) => setCustomDisease(e.target.value)}
                                                    placeholder="กรอกชื่อโรค..."
                                                    className="mt-2 text-gray-600 w-full px-3 py-2 border border-orange-300 rounded-lg focus:ring-2 focus:ring-orange-500"
                                                    required
                                                />
                                            )}
                                        </div>
                                        <div>
                                            <label className="block text-sm font-medium text-gray-700 mb-1">
                                                วันที่รายงาน <span className="text-red-500">*</span>
                                            </label>
                                            <input
                                                type="date"
                                                value={formData.report_date}
                                                onChange={(e) => setFormData({ ...formData, report_date: e.target.value })}
                                                required
                                                className="text-gray-600 w-full px-3 py-2 border border-gray-300 rounded-lg"
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-sm font-medium text-gray-700 mb-1">
                                                จำนวนผู้ป่วย <span className="text-red-500">*</span>
                                            </label>
                                            <input
                                                type="number"
                                                min="0"
                                                value={formData.patient_count}
                                                onChange={(e) => setFormData({ ...formData, patient_count: parseInt(e.target.value) || 0 })}
                                                required
                                                className="text-gray-600 w-full px-3 py-2 border border-gray-300 rounded-lg"
                                            />
                                            <p className="text-xs text-gray-500 mt-1">
                                                ระดับ: {getSeverityLabel(formData.patient_count)}
                                            </p>
                                        </div>
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">หมายเหตุ</label>
                                        <textarea
                                            value={formData.notes}
                                            onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                                            rows="3"
                                            className="text-gray-600 w-full px-3 py-2 border border-gray-300 rounded-lg"
                                            placeholder="รายละเอียดเพิ่มเติม..."
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
                                            className="px-6 py-2 bg-red-500 rounded-lg hover:bg-red-600 text-white"
                                        >
                                            ยกเลิก
                                        </button>
                                        <button
                                            type="submit"
                                            className="px-6 py-2 bg-[#0b4c86] text-white rounded-lg hover:bg-[#083865]"
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
        </>
    );
}
