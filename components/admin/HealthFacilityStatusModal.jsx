'use client';

import { useState } from 'react';
import { showError, showSuccess } from '@/lib/sweetAlert';
import { FLOOD_STATUSES, SERVICE_STATUSES, facilityTypeInfo } from '@/lib/healthFacilityStatus';

function ChoiceGroup({ legend, name, options, value, onChange }) {
    return (
        <fieldset>
            <legend className="mb-1.5 text-sm font-semibold text-gray-700">{legend}</legend>
            <div className="grid gap-2 sm:grid-cols-3">
                {options.map((option) => {
                    const checked = value === option.value;
                    return (
                        <label
                            key={option.value}
                            className="flex cursor-pointer items-center gap-2 rounded-lg border-2 px-3 py-2 text-sm font-medium transition-colors"
                            style={checked
                                ? { borderColor: option.color, background: option.bg, color: option.color }
                                : { borderColor: '#e5e7eb', color: '#374151' }}
                        >
                            <input
                                type="radio"
                                name={name}
                                value={option.value}
                                checked={checked}
                                onChange={() => onChange(option.value)}
                                className="h-4 w-4"
                                style={{ accentColor: option.color }}
                            />
                            {option.label}
                        </label>
                    );
                })}
            </div>
        </fieldset>
    );
}

// เจ้าหน้าที่อัปเดตสถานะสถานพยาบาลวันนี้ → แสดงใน popup บนแผนที่สถานการณ์ทันที
export default function HealthFacilityStatusModal({ facility, onClose, onSaved }) {
    const [serviceStatus, setServiceStatus] = useState(facility.service_status || '');
    const [floodStatus, setFloodStatus] = useState(facility.flood_status || '');
    const [note, setNote] = useState(facility.service_note || '');
    const [phone, setPhone] = useState(facility.phone || '');
    const [saving, setSaving] = useState(false);
    const type = facilityTypeInfo(facility.typecode);

    const save = async (event) => {
        event.preventDefault();
        if (!serviceStatus) {
            showError('เลือกสถานะการให้บริการก่อนบันทึก');
            return;
        }
        setSaving(true);
        try {
            const response = await fetch(`/stn-eoc/api/admin/health-facilities/${facility.id}/status`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ service_status: serviceStatus, flood_status: floodStatus || null, service_note: note, phone })
            });
            const data = await response.json().catch(() => ({}));
            if (!response.ok || !data.success) {
                showError(data.error || 'บันทึกสถานะไม่สำเร็จ');
                return;
            }
            showSuccess('บันทึกสถานะแล้ว แผนที่สถานการณ์จะแสดงสถานะนี้');
            onSaved?.(data.data);
        } catch (error) {
            console.error('Error saving facility status:', error);
            showError('บันทึกสถานะไม่สำเร็จ');
        } finally {
            setSaving(false);
        }
    };

    return (
        <div className="app-modal-overlay" role="dialog" aria-modal="true" aria-labelledby="facility-status-title">
            <form onSubmit={save} className="max-h-[90vh] w-full max-w-2xl space-y-5 overflow-y-auto rounded-lg bg-white p-6 text-gray-800">
                <div>
                    <h2 id="facility-status-title" className="text-xl font-bold text-gray-800">อัปเดตสถานะ {facility.name}</h2>
                    <p className="mt-0.5 text-sm text-gray-500">{type.label} • อ.{facility.district_name || '-'} — ประชาชนจะเห็นสถานะนี้บนแผนที่สถานการณ์</p>
                </div>

                <ChoiceGroup legend="การให้บริการ *" name="service_status" options={SERVICE_STATUSES} value={serviceStatus} onChange={setServiceStatus} />
                <ChoiceGroup legend="น้ำท่วมที่ตั้ง" name="flood_status" options={FLOOD_STATUSES} value={floodStatus} onChange={setFloodStatus} />

                <div>
                    <label htmlFor="facility-note" className="mb-1 block text-sm font-semibold text-gray-700">หมายเหตุถึงประชาชน</label>
                    <input
                        id="facility-note"
                        type="text"
                        maxLength={255}
                        value={note}
                        onChange={(e) => setNote(e.target.value)}
                        placeholder="เช่น ย้ายจุดบริการไปศาลาประชาคม หมู่ 3 / งดผ่าตัดไม่เร่งด่วน"
                        className="w-full rounded-lg border px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                </div>
                <div>
                    <label htmlFor="facility-phone" className="mb-1 block text-sm font-semibold text-gray-700">เบอร์โทรติดต่อ</label>
                    <input
                        id="facility-phone"
                        type="text"
                        maxLength={80}
                        value={phone}
                        onChange={(e) => setPhone(e.target.value)}
                        placeholder="เช่น 074-711-010 (คั่นหลายเบอร์ด้วย ,)"
                        className="w-full rounded-lg border px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                </div>

                <div className="flex gap-3 pt-1">
                    <button type="submit" disabled={saving} className="flex-1 rounded-lg bg-[#0b4c86] py-2 font-semibold text-white hover:bg-[#093d6c] disabled:opacity-60">
                        {saving ? 'กำลังบันทึก…' : 'บันทึกสถานะ'}
                    </button>
                    <button type="button" onClick={onClose} className="flex-1 rounded-lg border border-gray-300 py-2 font-semibold text-gray-700 hover:bg-gray-50">
                        ยกเลิก
                    </button>
                </div>
            </form>
        </div>
    );
}
