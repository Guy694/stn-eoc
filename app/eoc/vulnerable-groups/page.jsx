"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import EOCLayout from "@/components/layouts/EOCLayout";
import { satunDistricts } from "@/data/satunData";
import { showError, showSuccess, showDeleteConfirm } from "@/lib/sweetAlert";

const GROUPS = [
    { key: "elderly", label: "ผู้สูงอายุ" },
    { key: "children", label: "เด็กเล็ก" },
    { key: "disabled", label: "ผู้พิการ" },
    { key: "bedridden", label: "ติดบ้าน/ติดเตียง" },
    { key: "pregnant", label: "หญิงตั้งครรภ์" },
    { key: "chronic_illness", label: "โรคเรื้อรัง" },
];

const emptyForm = {
    district: "",
    tambon: "",
    village: "",
    elderly: 0,
    children: 0,
    disabled: 0,
    bedridden: 0,
    pregnant: 0,
    chronic_illness: 0,
    total_cared: 0,
    moved: 0,
    notes: "",
    needs: "",
};

function numberValue(value) {
    return Number(value) || 0;
}

function total(record) {
    return GROUPS.reduce((sum, group) => sum + numberValue(record[group.key]), 0);
}

export default function VulnerableGroupBaselinePage() {
    const [records, setRecords] = useState([]);
    const [summary, setSummary] = useState({});
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [selectedDistrict, setSelectedDistrict] = useState("all");
    const [selectedTambon, setSelectedTambon] = useState("all");
    const [showModal, setShowModal] = useState(false);
    const [editingRecord, setEditingRecord] = useState(null);
    const [formData, setFormData] = useState(emptyForm);

    const tambonOptions = useMemo(() => {
        const district = satunDistricts.find(item => item.name === (formData.district || selectedDistrict));
        return district?.tambons || [];
    }, [formData.district, selectedDistrict]);

    const filterTambonOptions = useMemo(() => {
        const district = satunDistricts.find(item => item.name === selectedDistrict);
        return district?.tambons || [];
    }, [selectedDistrict]);

    const fetchRecords = useCallback(async () => {
        try {
            setLoading(true);
            const params = new URLSearchParams();
            if (selectedDistrict !== "all") params.append("district", selectedDistrict);
            if (selectedTambon !== "all") params.append("tambon", selectedTambon);

            const response = await fetch(`/stn-eoc/api/eoc/vulnerable-groups/baseline?${params}`);
            const result = await response.json();

            if (result.success) {
                setRecords(result.data || []);
                setSummary(result.summary || {});
            } else {
                showError(result.message || "โหลดข้อมูลไม่สำเร็จ");
            }
        } catch (error) {
            console.error("Fetch vulnerable baseline error:", error);
            showError("เกิดข้อผิดพลาดในการโหลดข้อมูล");
        } finally {
            setLoading(false);
        }
    }, [selectedDistrict, selectedTambon]);

    useEffect(() => {
        fetchRecords();
    }, [fetchRecords]);

    const resetForm = () => {
        setFormData(emptyForm);
        setEditingRecord(null);
    };

    const openCreate = () => {
        resetForm();
        setShowModal(true);
    };

    const openEdit = (record) => {
        setEditingRecord(record);
        setFormData({
            district: record.district || "",
            tambon: record.tambon || "",
            village: record.village || "",
            elderly: record.elderly || 0,
            children: record.children || 0,
            disabled: record.disabled || 0,
            bedridden: record.bedridden || 0,
            pregnant: record.pregnant || 0,
            chronic_illness: record.chronic_illness || 0,
            total_cared: record.total_cared || 0,
            moved: record.moved || 0,
            notes: record.notes || "",
            needs: record.needs || "",
        });
        setShowModal(true);
    };

    const handleSubmit = async (event) => {
        event.preventDefault();
        setSaving(true);

        try {
            const response = await fetch("/stn-eoc/api/eoc/vulnerable-groups/baseline", {
                method: editingRecord ? "PUT" : "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    ...formData,
                    id: editingRecord?.id,
                    elderly: numberValue(formData.elderly),
                    children: numberValue(formData.children),
                    disabled: numberValue(formData.disabled),
                    bedridden: numberValue(formData.bedridden),
                    pregnant: numberValue(formData.pregnant),
                    chronic_illness: numberValue(formData.chronic_illness),
                    total_cared: numberValue(formData.total_cared),
                    moved: numberValue(formData.moved),
                }),
            });
            const result = await response.json();

            if (result.success) {
                showSuccess(editingRecord ? "แก้ไขข้อมูลสำเร็จ" : "เพิ่มข้อมูลสำเร็จ");
                setShowModal(false);
                resetForm();
                fetchRecords();
            } else {
                showError(result.message || "บันทึกข้อมูลไม่สำเร็จ");
            }
        } catch (error) {
            console.error("Save vulnerable baseline error:", error);
            showError("เกิดข้อผิดพลาดในการบันทึกข้อมูล");
        } finally {
            setSaving(false);
        }
    };

    const adjustCount = async (record, field, delta) => {
        try {
            const response = await fetch("/stn-eoc/api/eoc/vulnerable-groups/baseline", {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ id: record.id, field, delta }),
            });
            const result = await response.json();

            if (result.success) {
                fetchRecords();
            } else {
                showError(result.message || "ปรับจำนวนไม่สำเร็จ");
            }
        } catch (error) {
            console.error("Adjust vulnerable baseline error:", error);
            showError("เกิดข้อผิดพลาดในการปรับจำนวน");
        }
    };

    const handleDelete = async (id) => {
        const confirmed = await showDeleteConfirm();
        if (!confirmed) return;

        try {
            const response = await fetch(`/stn-eoc/api/eoc/vulnerable-groups/baseline?id=${id}`, {
                method: "DELETE",
            });
            const result = await response.json();

            if (result.success) {
                showSuccess("ลบข้อมูลสำเร็จ");
                fetchRecords();
            } else {
                showError(result.message || "ลบข้อมูลไม่สำเร็จ");
            }
        } catch (error) {
            console.error("Delete vulnerable baseline error:", error);
            showError("เกิดข้อผิดพลาดในการลบข้อมูล");
        }
    };

    return (
        <EOCLayout>
            <div className="p-6">
                <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between mb-6">
                    <div>
                        <h1 className="text-2xl md:text-3xl font-bold text-gray-800">ฐานข้อมูลกลุ่มเปราะบาง</h1>
                        <p className="text-gray-600 mt-1">ข้อมูลกลางสำหรับใช้ร่วมกับทุก EOC และปรับจำนวนรายกลุ่มได้</p>
                    </div>
                    <button
                        type="button"
                        onClick={openCreate}
                        className="bg-blue-600 text-white px-5 py-3 rounded-lg hover:bg-blue-700 transition-colors"
                    >
                        เพิ่มพื้นที่
                    </button>
                </div>

                <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-4 mb-6">
                    {GROUPS.map(group => (
                        <div key={group.key} className="bg-white border border-gray-200 rounded-lg p-4 shadow-sm">
                            <p className="text-sm text-gray-500">{group.label}</p>
                            <p className="text-2xl font-bold text-gray-800">{summary[`total_${group.key}`] || 0}</p>
                        </div>
                    ))}
                    <div className="bg-green-700 text-white rounded-lg p-4 shadow-sm">
                        <p className="text-sm text-green-100">รวมทั้งหมด</p>
                        <p className="text-2xl font-bold">{summary.grand_total || 0}</p>
                    </div>
                </div>

                <div className="bg-white rounded-lg shadow p-4 mb-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">อำเภอ</label>
                            <select
                                value={selectedDistrict}
                                onChange={(event) => {
                                    setSelectedDistrict(event.target.value);
                                    setSelectedTambon("all");
                                }}
                                className="text-gray-700 w-full px-3 py-2 border border-gray-300 rounded-lg"
                            >
                                <option value="all">ทั้งหมด</option>
                                {satunDistricts.map(district => (
                                    <option key={district.name} value={district.name}>{district.name}</option>
                                ))}
                            </select>
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">ตำบล</label>
                            <select
                                value={selectedTambon}
                                onChange={(event) => setSelectedTambon(event.target.value)}
                                disabled={selectedDistrict === "all"}
                                className="text-gray-700 w-full px-3 py-2 border border-gray-300 rounded-lg disabled:bg-gray-100"
                            >
                                <option value="all">ทั้งหมด</option>
                                {filterTambonOptions.map(tambon => (
                                    <option key={tambon.name} value={tambon.name}>{tambon.name}</option>
                                ))}
                            </select>
                        </div>
                    </div>
                </div>

                <div className="bg-white rounded-lg shadow overflow-hidden">
                    <div className="p-4 bg-gray-50 border-b border-gray-200">
                        <h2 className="font-bold text-gray-800">ตารางฐานข้อมูลกลาง</h2>
                        <p className="text-sm text-gray-600 mt-1">แสดงข้อมูล {records.length} พื้นที่</p>
                    </div>

                    {loading ? (
                        <div className="text-center py-10 text-gray-600">กำลังโหลดข้อมูล...</div>
                    ) : records.length === 0 ? (
                        <div className="text-center py-10 text-gray-600">ยังไม่มีข้อมูล</div>
                    ) : (
                        <div className="overflow-x-auto">
                            <table className="min-w-full divide-y divide-gray-200">
                                <thead className="bg-gray-50">
                                    <tr>
                                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">พื้นที่</th>
                                        {GROUPS.map(group => (
                                            <th key={group.key} className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase min-w-36">
                                                {group.label}
                                            </th>
                                        ))}
                                        <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">รวม</th>
                                        <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">จัดการ</th>
                                    </tr>
                                </thead>
                                <tbody className="bg-white divide-y divide-gray-200">
                                    {records.map(record => (
                                        <tr key={record.id} className="hover:bg-gray-50">
                                            <td className="px-4 py-4 align-top">
                                                <div className="font-medium text-gray-900">{record.village || "ทั้งตำบล"}</div>
                                                <div className="text-sm text-gray-500">ต.{record.tambon} อ.{record.district}</div>
                                            </td>
                                            {GROUPS.map(group => (
                                                <td key={group.key} className="px-4 py-4 text-center align-top">
                                                    <div className="flex items-center justify-center gap-2">
                                                        <button
                                                            type="button"
                                                            onClick={() => adjustCount(record, group.key, -1)}
                                                            className="w-8 h-8 rounded border border-gray-300 text-gray-700 hover:bg-red-50 hover:border-red-300"
                                                            title={`ลด${group.label}`}
                                                        >
                                                            -
                                                        </button>
                                                        <span className="min-w-10 font-semibold text-gray-800">{record[group.key] || 0}</span>
                                                        <button
                                                            type="button"
                                                            onClick={() => adjustCount(record, group.key, 1)}
                                                            className="w-8 h-8 rounded border border-gray-300 text-gray-700 hover:bg-green-50 hover:border-green-300"
                                                            title={`เพิ่ม${group.label}`}
                                                        >
                                                            +
                                                        </button>
                                                    </div>
                                                </td>
                                            ))}
                                            <td className="px-4 py-4 text-center font-bold text-blue-700 align-top">{total(record)}</td>
                                            <td className="px-4 py-4 text-center align-top">
                                                <button
                                                    type="button"
                                                    onClick={() => openEdit(record)}
                                                    className="text-blue-600 hover:text-blue-800 px-2 py-1 rounded hover:bg-blue-50"
                                                >
                                                    แก้ไข
                                                </button>
                                                <button
                                                    type="button"
                                                    onClick={() => handleDelete(record.id)}
                                                    className="text-red-600 hover:text-red-800 px-2 py-1 rounded hover:bg-red-50"
                                                >
                                                    ลบ
                                                </button>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>

                {showModal && (
                    <div className="fixed inset-0 backdrop-blur-md bg-white/30 flex items-center justify-center z-50 p-4">
                        <div className="bg-white rounded-lg max-w-3xl w-full max-h-[90vh] overflow-y-auto">
                            <div className="p-6">
                                <h2 className="text-2xl font-bold text-gray-800 mb-4">
                                    {editingRecord ? "แก้ไขพื้นที่" : "เพิ่มพื้นที่"}
                                </h2>
                                <form onSubmit={handleSubmit} className="space-y-4">
                                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                        <div>
                                            <label className="block text-sm font-medium text-gray-700 mb-1">อำเภอ</label>
                                            <select
                                                value={formData.district}
                                                onChange={(event) => setFormData({ ...formData, district: event.target.value, tambon: "" })}
                                                required
                                                className="text-gray-700 w-full px-3 py-2 border border-gray-300 rounded-lg"
                                            >
                                                <option value="">เลือกอำเภอ</option>
                                                {satunDistricts.map(district => (
                                                    <option key={district.name} value={district.name}>{district.name}</option>
                                                ))}
                                            </select>
                                        </div>
                                        <div>
                                            <label className="block text-sm font-medium text-gray-700 mb-1">ตำบล</label>
                                            <select
                                                value={formData.tambon}
                                                onChange={(event) => setFormData({ ...formData, tambon: event.target.value })}
                                                required
                                                disabled={!formData.district}
                                                className="text-gray-700 w-full px-3 py-2 border border-gray-300 rounded-lg disabled:bg-gray-100"
                                            >
                                                <option value="">เลือกตำบล</option>
                                                {tambonOptions.map(tambon => (
                                                    <option key={tambon.name} value={tambon.name}>{tambon.name}</option>
                                                ))}
                                            </select>
                                        </div>
                                        <div>
                                            <label className="block text-sm font-medium text-gray-700 mb-1">หมู่บ้าน</label>
                                            <input
                                                type="text"
                                                value={formData.village}
                                                onChange={(event) => setFormData({ ...formData, village: event.target.value })}
                                                className="text-gray-700 w-full px-3 py-2 border border-gray-300 rounded-lg"
                                                placeholder="เช่น รวม หรือ หมู่ 1"
                                            />
                                        </div>
                                    </div>

                                    <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                                        {GROUPS.map(group => (
                                            <div key={group.key}>
                                                <label className="block text-sm font-medium text-gray-700 mb-1">{group.label}</label>
                                                <input
                                                    type="number"
                                                    min="0"
                                                    value={formData[group.key]}
                                                    onChange={(event) => setFormData({ ...formData, [group.key]: numberValue(event.target.value) })}
                                                    className="text-gray-700 w-full px-3 py-2 border border-gray-300 rounded-lg"
                                                />
                                            </div>
                                        ))}
                                    </div>

                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        <div>
                                            <label className="block text-sm font-medium text-gray-700 mb-1">ได้รับการดูแลแล้ว</label>
                                            <input
                                                type="number"
                                                min="0"
                                                value={formData.total_cared}
                                                onChange={(event) => setFormData({ ...formData, total_cared: numberValue(event.target.value) })}
                                                className="text-gray-700 w-full px-3 py-2 border border-gray-300 rounded-lg"
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-sm font-medium text-gray-700 mb-1">เคลื่อนย้ายแล้ว</label>
                                            <input
                                                type="number"
                                                min="0"
                                                value={formData.moved}
                                                onChange={(event) => setFormData({ ...formData, moved: numberValue(event.target.value) })}
                                                className="text-gray-700 w-full px-3 py-2 border border-gray-300 rounded-lg"
                                            />
                                        </div>
                                    </div>

                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">หมายเหตุ</label>
                                        <textarea
                                            value={formData.notes}
                                            onChange={(event) => setFormData({ ...formData, notes: event.target.value })}
                                            rows="2"
                                            className="text-gray-700 w-full px-3 py-2 border border-gray-300 rounded-lg"
                                        />
                                    </div>

                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">ความต้องการเฉพาะ</label>
                                        <textarea
                                            value={formData.needs}
                                            onChange={(event) => setFormData({ ...formData, needs: event.target.value })}
                                            rows="2"
                                            className="text-gray-700 w-full px-3 py-2 border border-gray-300 rounded-lg"
                                        />
                                    </div>

                                    <div className="flex justify-end gap-2 pt-4">
                                        <button
                                            type="button"
                                            onClick={() => {
                                                setShowModal(false);
                                                resetForm();
                                            }}
                                            className="px-5 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200"
                                        >
                                            ยกเลิก
                                        </button>
                                        <button
                                            type="submit"
                                            disabled={saving}
                                            className="px-5 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-60"
                                        >
                                            {saving ? "กำลังบันทึก..." : "บันทึก"}
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
