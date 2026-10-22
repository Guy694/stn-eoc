'use client';

// หน่วยบริการสุขภาพ: รายการ + แผนที่ปักพิกัด
// ทุกบทบาทเจ้าหน้าที่ดูและอัปเดตสถานะการให้บริการได้ · เพิ่ม/แก้ไข/ปักพิกัด/ลบ เฉพาะผู้ดูแลระบบ
import { useCallback, useEffect, useMemo, useState } from 'react';
import EOCLayout from '@/components/layouts/EOCLayout';
import {
    AddButton, AdminPage, Button, DataTable, DeleteDialog, Field, FilterSelect, FormDialog, FormGrid,
    ReadOnlyNotice, RowActions, StatStrip, StatusPill, Tabs, Toolbar, inputClass, useNotice
} from '@/components/admin/crud';
import LocationPicker from '@/components/admin/LocationPicker';
import FacilityPinMap, { hasCoordinates, typeColor } from '@/components/admin/health/FacilityPinMap';
import HealthFacilityStatusModal from '@/components/admin/HealthFacilityStatusModal';
import { useAuth } from '@/context/AuthContext';
import { apiRequest } from '@/lib/adminApi';
import { SERVICE_STATUSES, UNKNOWN_SERVICE, floodStatusMeta, isStatusStale, serviceStatusMeta } from '@/lib/healthFacilityStatus';

const API = '/stn-eoc/api/admin/health-facilities';

const FACILITY_TYPES = [
    { value: 'รพ.ทั่วไป', label: 'โรงพยาบาลทั่วไป' },
    { value: 'รพ.ชุมชน', label: 'โรงพยาบาลชุมชน' },
    { value: 'รพ.สต.', label: 'โรงพยาบาลส่งเสริมสุขภาพตำบล' },
    { value: 'ศสช.', label: 'ศูนย์สุขภาพชุมชน' },
    { value: 'สสจ', label: 'สำนักงานสาธารณสุขจังหวัด' },
    { value: 'สสอ.', label: 'สำนักงานสาธารณสุขอำเภอ' },
    { value: 'สอน.', label: 'สถานีอนามัย' }
];

const EMPTY_FORM = { name: '', typecode: '', address: '', district: '', tambon: '', lat: '', lon: '', phone: '' };

function formatUpdated(value) {
    if (!value) return '';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return '';
    return date.toLocaleString('th-TH', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
}

function ServiceCell({ facility, onUpdate }) {
    const service = serviceStatusMeta(facility.service_status);
    const flood = floodStatusMeta(facility.flood_status);
    const stale = facility.service_status && isStatusStale(facility.status_updated_at);
    return (
        <div className="flex min-w-[10rem] flex-col items-start gap-1">
            <span className="rounded-full px-2.5 py-0.5 text-xs font-semibold" style={{ background: service.bg, color: service.color }}>{service.label}</span>
            {flood && flood.value !== 'normal' ? (
                <span className="rounded-full px-2.5 py-0.5 text-xs font-semibold" style={{ background: flood.bg, color: flood.color }}>{flood.label}</span>
            ) : null}
            {facility.status_updated_at ? (
                <span className={`text-[11px] ${stale ? 'font-semibold text-amber-700' : 'text-slate-500'}`}>
                    อัปเดต {formatUpdated(facility.status_updated_at)}{stale ? ' (เกิน 24 ชม.)' : ''}
                </span>
            ) : null}
            <button type="button" onClick={() => onUpdate(facility)} className="text-xs font-semibold text-[#0b4c86] underline-offset-2 hover:underline">
                อัปเดตสถานะ
            </button>
        </div>
    );
}

export default function HealthFacilitiesPage() {
    const { user } = useAuth();
    const canEdit = user?.role === 'admin';
    const { success, fail } = useNotice();

    const [facilities, setFacilities] = useState([]);
    const [loading, setLoading] = useState(true);
    const [tab, setTab] = useState('list');
    const [search, setSearch] = useState('');
    const [typeFilter, setTypeFilter] = useState('');
    const [statusFilter, setStatusFilter] = useState('');
    const [pinFilter, setPinFilter] = useState('');

    const [form, setForm] = useState(EMPTY_FORM);
    const [editing, setEditing] = useState(null);
    const [formOpen, setFormOpen] = useState(false);
    const [saving, setSaving] = useState(false);
    const [formError, setFormError] = useState('');
    const [deleting, setDeleting] = useState(null);
    const [deleteBusy, setDeleteBusy] = useState(false);
    const [deleteError, setDeleteError] = useState('');
    const [statusFacility, setStatusFacility] = useState(null);

    const load = useCallback(async () => {
        setLoading(true);
        try {
            const json = await apiRequest(API);
            setFacilities(json.data || []);
        } catch (error) {
            fail(error.message || 'โหลดรายการหน่วยบริการไม่สำเร็จ');
        } finally {
            setLoading(false);
        }
    }, [fail]);

    useEffect(() => { load(); }, [load]);

    const missingCount = useMemo(() => facilities.filter((item) => !hasCoordinates(item)).length, [facilities]);
    const serviceCounts = useMemo(() => facilities.reduce((acc, facility) => {
        const key = facility.service_status || 'unknown';
        acc[key] = (acc[key] || 0) + 1;
        return acc;
    }, {}), [facilities]);

    const rows = useMemo(() => {
        const text = search.trim().toLowerCase();
        return facilities.filter((facility) => {
            if (typeFilter && facility.typecode !== typeFilter) return false;
            if (statusFilter && (facility.service_status || 'unknown') !== statusFilter) return false;
            if (pinFilter === 'missing' && hasCoordinates(facility)) return false;
            if (pinFilter === 'pinned' && !hasCoordinates(facility)) return false;
            if (!text) return true;
            return [facility.name, facility.address, facility.district_name, facility.tambon]
                .some((value) => String(value || '').toLowerCase().includes(text));
        });
    }, [facilities, search, typeFilter, statusFilter, pinFilter]);

    const openCreate = () => {
        setEditing(null);
        setForm(EMPTY_FORM);
        setFormError('');
        setFormOpen(true);
    };

    const openEdit = (facility) => {
        setEditing(facility);
        setForm({
            name: facility.name || '',
            typecode: facility.typecode || '',
            address: facility.address || '',
            district: facility.district_name || facility.district || '',
            tambon: facility.tambon || '',
            lat: facility.lat ?? '',
            lon: facility.lon ?? '',
            phone: facility.phone || ''
        });
        setFormError('');
        setFormOpen(true);
    };

    const updateForm = (patch) => setForm((current) => ({ ...current, ...patch }));

    const submit = async () => {
        if (!form.name.trim() || !form.typecode) {
            setFormError('กรอกชื่อและเลือกประเภทหน่วยบริการ');
            return;
        }
        setSaving(true);
        setFormError('');
        try {
            await apiRequest(editing ? `${API}/${editing.id}` : API, { method: editing ? 'PUT' : 'POST', body: form });
            success(editing ? `บันทึก ${form.name} แล้ว` : `เพิ่ม ${form.name} แล้ว`);
            setFormOpen(false);
            await load();
        } catch (error) {
            setFormError(error.message || 'บันทึกไม่สำเร็จ');
        } finally {
            setSaving(false);
        }
    };

    const savePin = async (facility, point) => {
        try {
            await apiRequest(`${API}/${facility.id}`, { method: 'PATCH', body: point });
            setFacilities((list) => list.map((item) => (item.id === facility.id ? { ...item, ...point } : item)));
            success(`ปักพิกัด ${facility.name} แล้ว`);
        } catch (error) {
            fail(error.message || 'บันทึกพิกัดไม่สำเร็จ');
            throw error;
        }
    };

    const confirmDelete = async (reason) => {
        setDeleteBusy(true);
        setDeleteError('');
        try {
            const json = await apiRequest(`${API}/${deleting.id}`, { method: 'DELETE', body: { id: deleting.id, reason } });
            success(json.message || `ย้าย ${deleting.name} ไปถังขยะแล้ว`);
            setDeleting(null);
            await load();
        } catch (error) {
            setDeleteError(error.message || 'ลบไม่สำเร็จ');
        } finally {
            setDeleteBusy(false);
        }
    };

    const columns = [
        {
            key: 'name',
            label: 'หน่วยบริการ',
            render: (facility) => (
                <div className="min-w-0">
                    <div className="font-bold text-slate-900">{facility.name}</div>
                    <div className="mt-0.5 flex items-center gap-1.5 text-xs font-medium text-slate-600">
                        <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: typeColor(facility.typecode) }} aria-hidden="true" />
                        {facility.typecode}
                    </div>
                </div>
            )
        },
        {
            key: 'area',
            label: 'อำเภอ/ตำบล',
            render: (facility) => (
                <span className="text-slate-700">
                    {facility.district_name ? `อ.${facility.district_name}` : '-'}
                    {facility.tambon ? <span className="block text-xs text-slate-500">ต.{facility.tambon}</span> : null}
                </span>
            )
        },
        {
            key: 'pin',
            label: 'พิกัด',
            render: (facility) => (hasCoordinates(facility)
                ? <span className="whitespace-nowrap text-xs tabular-nums text-slate-600">{Number(facility.lat).toFixed(4)}, {Number(facility.lon).toFixed(4)}</span>
                : <StatusPill tone="amber">ยังไม่มีพิกัด</StatusPill>)
        },
        { key: 'phone', label: 'โทรศัพท์', render: (facility) => facility.phone || '-' },
        { key: 'status', label: 'สถานะวันนี้', render: (facility) => <ServiceCell facility={facility} onUpdate={setStatusFacility} /> }
    ];

    const statusOptions = [
        { value: '', label: 'ทุกสถานะบริการ' },
        ...[...SERVICE_STATUSES, UNKNOWN_SERVICE].map((status) => ({ value: status.value, label: `${status.label} (${serviceCounts[status.value] || 0})` }))
    ];

    return (
        <EOCLayout>
            <AdminPage
                title="หน่วยบริการสุขภาพ"
                description="โรงพยาบาล รพ.สต. และสำนักงานสาธารณสุข พร้อมพิกัดและสถานะการให้บริการที่แสดงบนแผนที่ประชาชน"
                actions={canEdit ? <AddButton onClick={openCreate}>เพิ่มหน่วยบริการ</AddButton> : null}
            >
                {!canEdit ? <ReadOnlyNotice message="ดูข้อมูลและอัปเดตสถานะการให้บริการได้ · เพิ่ม แก้ไข หรือปักพิกัดหน่วยบริการ ให้ผู้ดูแลระบบเป็นผู้ทำ" /> : null}

                <StatStrip
                    compact
                    items={[
                        { label: 'หน่วยบริการทั้งหมด', value: facilities.length, unit: 'แห่ง' },
                        { label: 'เปิดให้บริการปกติ', value: serviceCounts.open || 0, unit: 'แห่ง', tone: 'green' },
                        { label: 'จำกัด/ปิดบริการ', value: (serviceCounts.limited || 0) + (serviceCounts.closed || 0), unit: 'แห่ง', tone: 'red' },
                        { label: 'ยังไม่มีพิกัด', value: missingCount, unit: 'แห่ง', tone: missingCount ? 'amber' : undefined, onClick: missingCount ? () => setTab('map') : undefined }
                    ]}
                />

                <Tabs
                    value={tab}
                    onChange={setTab}
                    items={[
                        { value: 'list', label: 'รายการ', count: facilities.length },
                        { value: 'map', label: canEdit ? 'แผนที่และปักพิกัด' : 'แผนที่', count: missingCount || undefined }
                    ]}
                />

                {tab === 'map' ? (
                    <FacilityPinMap facilities={facilities} canEdit={canEdit} onSave={savePin} onEdit={canEdit ? openEdit : undefined} />
                ) : (
                    <>
                        <Toolbar search={search} onSearchChange={setSearch} searchPlaceholder="ค้นหาชื่อ ที่อยู่ อำเภอ ตำบล">
                            <FilterSelect label="ประเภท" value={typeFilter} onChange={setTypeFilter} options={[{ value: '', label: 'ทุกประเภท' }, ...FACILITY_TYPES]} />
                            <FilterSelect label="สถานะบริการ" value={statusFilter} onChange={setStatusFilter} options={statusOptions} />
                            <FilterSelect
                                label="พิกัด"
                                value={pinFilter}
                                onChange={setPinFilter}
                                options={[{ value: '', label: 'พิกัด: ทั้งหมด' }, { value: 'missing', label: `ยังไม่มีพิกัด (${missingCount})` }, { value: 'pinned', label: 'มีพิกัดแล้ว' }]}
                            />
                        </Toolbar>
                        <DataTable
                            columns={columns}
                            rows={rows}
                            loading={loading}
                            pageSize={20}
                            pageSizeOptions={[20, 50, 100]}
                            caption="รายการหน่วยบริการสุขภาพ"
                            emptyText={facilities.length ? 'ไม่พบหน่วยบริการที่ตรงกับตัวกรอง' : 'ยังไม่มีหน่วยบริการ'}
                            emptyAction={canEdit && !facilities.length ? <AddButton onClick={openCreate}>เพิ่มหน่วยบริการ</AddButton> : null}
                            rowActions={canEdit ? (facility) => (
                                <RowActions itemName={facility.name} onEdit={() => openEdit(facility)} onDelete={() => { setDeleteError(''); setDeleting(facility); }} />
                            ) : undefined}
                        />
                    </>
                )}
            </AdminPage>

            <FormDialog
                open={formOpen}
                onOpenChange={(open) => { if (!saving) setFormOpen(open); }}
                title={editing ? `แก้ไข ${editing.name}` : 'เพิ่มหน่วยบริการ'}
                onSubmit={submit}
                busy={saving}
                error={formError}
                submitText={editing ? 'บันทึก' : 'เพิ่มหน่วยบริการ'}
            >
                <FormGrid>
                    <Field label="ชื่อหน่วยบริการ" required wide>
                        <input className={inputClass} value={form.name} onChange={(event) => updateForm({ name: event.target.value })} placeholder="เช่น รพ.สต.บ้านควน" />
                    </Field>
                    <Field label="ประเภท" required>
                        <select className={inputClass} value={form.typecode} onChange={(event) => updateForm({ typecode: event.target.value })}>
                            <option value="">เลือกประเภท</option>
                            {FACILITY_TYPES.map((type) => <option key={type.value} value={type.value}>{type.label}</option>)}
                        </select>
                    </Field>
                    <Field label="โทรศัพท์" hint="หลายเบอร์คั่นด้วยเครื่องหมายจุลภาค">
                        <input className={inputClass} inputMode="tel" value={form.phone} onChange={(event) => updateForm({ phone: event.target.value })} />
                    </Field>
                    <Field label="อำเภอ">
                        <input className={inputClass} value={form.district} onChange={(event) => updateForm({ district: event.target.value })} />
                    </Field>
                    <Field label="ตำบล">
                        <input className={inputClass} value={form.tambon} onChange={(event) => updateForm({ tambon: event.target.value })} />
                    </Field>
                    <Field label="ที่อยู่" wide>
                        <textarea rows={2} className={inputClass} value={form.address} onChange={(event) => updateForm({ address: event.target.value })} />
                    </Field>
                    <LocationPicker
                        lat={form.lat}
                        lon={form.lon}
                        onChange={updateForm}
                        hint="คลิกบนแผนที่ตรงที่ตั้งหน่วยบริการ ใช้แสดงบนแผนที่ประชาชนและหาหน่วยบริการใกล้บ้าน"
                    />
                </FormGrid>
            </FormDialog>

            <DeleteDialog
                open={Boolean(deleting)}
                onOpenChange={(open) => { if (!open && !deleteBusy) setDeleting(null); }}
                itemType="หน่วยบริการ"
                itemLabel={deleting?.name}
                onConfirm={confirmDelete}
                busy={deleteBusy}
                error={deleteError}
            />

            {statusFacility ? (
                <HealthFacilityStatusModal
                    facility={statusFacility}
                    onClose={() => setStatusFacility(null)}
                    onSaved={() => { setStatusFacility(null); load(); }}
                />
            ) : null}
        </EOCLayout>
    );
}
