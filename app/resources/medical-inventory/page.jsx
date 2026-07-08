"use client";

import { useEffect, useMemo, useState } from "react";
import EOCLayout from "@/components/layouts/EOCLayout";
import {
    BriefcaseMedical,
    ClipboardList,
    PackageCheck,
    PackageMinus,
    PlusCircle,
    RefreshCw,
    Save,
    Search,
    Warehouse
} from "lucide-react";

function formatNumber(value) {
    if (value === null || value === undefined) return "-";
    return Number(value || 0).toLocaleString("th-TH");
}

function statusLabel(status) {
    return status === "recorded" ? "บันทึกแล้ว" : "ยังไม่บันทึก";
}

function statusClass(status) {
    return status === "recorded"
        ? "bg-emerald-50 text-emerald-700 border-emerald-200"
        : "bg-amber-50 text-amber-700 border-amber-200";
}

export default function MedicalInventoryPage() {
    const [payload, setPayload] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");
    const [success, setSuccess] = useState("");
    const [filters, setFilters] = useState({ agency_id: "", item_code: "", status: "" });
    const [inventoryForm, setInventoryForm] = useState({
        health_facility_id: "",
        item_mode: "existing",
        item_code: "",
        item_name: "",
        unit: "",
        opening_qty: "",
        received_qty: "",
        issued_qty: "",
        balance_qty: "",
        movement_tracked: true,
        data_status: "recorded"
    });

    const fetchInventory = async (nextFilters = filters) => {
        setLoading(true);
        setError("");
        try {
            const params = new URLSearchParams();
            Object.entries(nextFilters).forEach(([key, value]) => {
                if (value) params.append(key, value);
            });
            const response = await fetch(`/stn-eoc/api/resources/medical-inventory?${params.toString()}`, {
                cache: "no-store"
            });
            const data = await response.json();
            if (!response.ok || !data.success) {
                throw new Error(data.message || "โหลดข้อมูลไม่สำเร็จ");
            }
            setPayload(data);
        } catch (err) {
            console.error("Medical inventory load error:", err);
            setError(err.message || "ไม่สามารถโหลดข้อมูลเวชภัณฑ์และคงคลังได้");
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchInventory();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const rows = useMemo(() => payload?.data || [], [payload?.data]);
    const stockRows = useMemo(() => payload?.stock || rows, [payload?.stock, rows]);
    const agencies = useMemo(() => payload?.filters?.agencies || [], [payload?.filters?.agencies]);
    const healthFacilities = useMemo(() => payload?.filters?.health_facilities || [], [payload?.filters?.health_facilities]);
    const items = useMemo(() => payload?.filters?.items || [], [payload?.filters?.items]);
    const summary = payload?.summary || {};

    const selectedStock = useMemo(() => {
        if (!inventoryForm.health_facility_id || !inventoryForm.item_code) return null;
        return stockRows.find((row) => String(row.health_facility_id || row.agency_id) === String(inventoryForm.health_facility_id) && row.item_code === inventoryForm.item_code)
            || null;
    }, [inventoryForm.health_facility_id, inventoryForm.item_code, stockRows]);

    const displayedTotals = useMemo(() => ({
        opening_qty: rows.reduce((sum, row) => sum + Number(row.opening_qty || 0), 0),
        received_qty: rows.reduce((sum, row) => sum + Number(row.received_qty || 0), 0),
        issued_qty: rows.reduce((sum, row) => sum + Number(row.issued_qty || 0), 0),
        balance_qty: rows.reduce((sum, row) => sum + Number(row.balance_qty || 0), 0)
    }), [rows]);

    const calculatedBalance = useMemo(() => {
        const opening = Number(inventoryForm.opening_qty || 0);
        const received = Number(inventoryForm.received_qty || 0);
        const issued = Number(inventoryForm.issued_qty || 0);
        return opening + received - issued;
    }, [inventoryForm.opening_qty, inventoryForm.received_qty, inventoryForm.issued_qty]);

    const handleFilterChange = (key, value) => {
        const next = { ...filters, [key]: value };
        setFilters(next);
        fetchInventory(next);
    };

    const handleExistingItemChange = (itemCode) => {
        const existing = stockRows.find((row) => (
            String(row.health_facility_id || row.agency_id) === String(inventoryForm.health_facility_id)
            && row.item_code === itemCode
        )) || stockRows.find((row) => row.item_code === itemCode);

        setInventoryForm((current) => ({
            ...current,
            item_code: itemCode,
            item_name: existing?.item_name || current.item_name,
            unit: existing?.unit || current.unit,
            opening_qty: existing?.opening_qty ?? "",
            received_qty: existing?.received_qty ?? "",
            issued_qty: existing?.issued_qty ?? "",
            balance_qty: existing?.balance_qty ?? "",
            movement_tracked: existing?.movement_tracked ?? true,
            data_status: existing?.data_status || "recorded"
        }));
    };

    const handleItemModeChange = (mode) => {
        setInventoryForm((current) => ({
            ...current,
            item_mode: mode,
            item_code: "",
            item_name: "",
            unit: "",
            opening_qty: "",
            received_qty: "",
            issued_qty: "",
            balance_qty: "",
            movement_tracked: true,
            data_status: "recorded"
        }));
    };

    const saveInventory = async (event) => {
        event.preventDefault();
        setError("");
        setSuccess("");

        if (!inventoryForm.health_facility_id) {
            setError("กรุณาเลือกหน่วยบริการ");
            return;
        }

        if (!inventoryForm.item_code || !inventoryForm.item_name || !inventoryForm.unit) {
            setError("กรุณาระบุรหัส รายการ และหน่วยนับเวชภัณฑ์");
            return;
        }

        if (calculatedBalance < 0 && inventoryForm.balance_qty === "") {
            setError("ยอดคงเหลือจาก ยกมา + รับเข้า - เบิกจ่าย ต้องไม่ติดลบ");
            return;
        }

        try {
            const response = await fetch("/stn-eoc/api/resources/medical-inventory", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    ...inventoryForm,
                    item_code: inventoryForm.item_code.trim().toUpperCase().replace(/\s+/g, "_"),
                    balance_qty: inventoryForm.balance_qty === "" ? calculatedBalance : inventoryForm.balance_qty
                })
            });
            const data = await response.json();
            if (!response.ok || !data.success) {
                throw new Error(data.message || "บันทึกข้อมูลไม่สำเร็จ");
            }

            setSuccess(data.message);
            setInventoryForm({
                health_facility_id: inventoryForm.health_facility_id,
                item_mode: "existing",
                item_code: "",
                item_name: "",
                unit: "",
                opening_qty: "",
                received_qty: "",
                issued_qty: "",
                balance_qty: "",
                movement_tracked: true,
                data_status: "recorded"
            });
            await fetchInventory(filters);
        } catch (err) {
            console.error("Save inventory error:", err);
            setError(err.message || "ไม่สามารถบันทึกข้อมูลเวชภัณฑ์ได้");
        }
    };

    return (
        <EOCLayout>
            <div className="min-h-screen bg-slate-50 p-6">
                <div className="mb-5 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                    <div>
                        <div className="text-xs font-black uppercase tracking-[0.18em] text-emerald-700">
                            ทรัพยากรและโลจิสติกส์
                        </div>
                        <h1 className="mt-1 text-3xl font-black text-slate-900">เวชภัณฑ์และคงคลัง</h1>
                        <p className="mt-1 text-sm leading-6 text-slate-600">
                            บันทึกและติดตามคงคลังเวชภัณฑ์อุทกภัยน้ำท่วม EOC session 3 ในฐานข้อมูลระบบ
                        </p>
                    </div>
                    <button
                        type="button"
                        onClick={() => fetchInventory()}
                        className="inline-flex items-center justify-center gap-2 rounded-lg border border-emerald-200 bg-white px-4 py-2 text-sm font-black text-emerald-800 shadow-sm hover:bg-emerald-50"
                    >
                        <RefreshCw className="h-4 w-4" />
                        รีเฟรช
                    </button>
                </div>

                {error && (
                    <div className="mb-4 rounded-lg border border-red-200 bg-red-50 p-4 text-sm font-bold text-red-700">
                        {error}
                    </div>
                )}
                {success && (
                    <div className="mb-4 rounded-lg border border-emerald-200 bg-emerald-50 p-4 text-sm font-bold text-emerald-700">
                        {success}
                    </div>
                )}

                <section className="mb-4 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                    <StatCard icon={Warehouse} label="หน่วยบริการ" value={summary.agency_count} suffix="แห่ง" />
                    <StatCard icon={BriefcaseMedical} label="รายการเวชภัณฑ์" value={summary.item_count} suffix="รายการ" />
                    <StatCard icon={PackageMinus} label="เบิกจ่ายแล้ว" value={summary.issued_qty} />
                    <StatCard icon={PackageCheck} label="คงเหลือรวม" value={summary.balance_qty} />
                </section>

                <section className="mb-4 grid gap-4 xl:grid-cols-[minmax(0,1fr)_420px]">
                    <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
                        <div className="mb-3 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                            <div>
                                <h2 className="text-lg font-black text-slate-900">ตารางคงคลังเวชภัณฑ์</h2>
                                <p className="text-sm text-slate-500">
                                    แสดง {formatNumber(rows.length)} รายการ จากทั้งหมด {formatNumber(summary.total_rows)} รายการ
                                </p>
                            </div>
                            <div className="flex flex-wrap gap-2">
                                <FilterSelect label="หน่วยบริการ" value={filters.agency_id} onChange={(value) => handleFilterChange("agency_id", value)}>
                                    {agencies.map((agency) => (
                                        <option key={agency.id} value={agency.id}>{agency.label}</option>
                                    ))}
                                </FilterSelect>
                                <FilterSelect label="รายการ" value={filters.item_code} onChange={(value) => handleFilterChange("item_code", value)}>
                                    {items.map((item) => (
                                        <option key={item.id} value={item.id}>{item.label}</option>
                                    ))}
                                </FilterSelect>
                                <FilterSelect label="สถานะ" value={filters.status} onChange={(value) => handleFilterChange("status", value)}>
                                    <option value="recorded">บันทึกแล้ว</option>
                                    <option value="not_recorded">ยังไม่บันทึก</option>
                                </FilterSelect>
                            </div>
                        </div>

                        <div className="overflow-x-auto">
                            <table className="min-w-[1100px] w-full text-sm">
                                <thead>
                                    <tr className="border-b border-slate-200 text-left text-xs font-black uppercase tracking-wide text-slate-500">
                                        <th className="px-3 py-2">หน่วยบริการ</th>
                                        <th className="px-3 py-2">รายการ</th>
                                        <th className="px-3 py-2">หน่วยนับ</th>
                                        <th className="px-3 py-2 text-right">ยกมา</th>
                                        <th className="px-3 py-2 text-right">รับเข้า</th>
                                        <th className="px-3 py-2 text-right">เบิกจ่าย</th>
                                        <th className="px-3 py-2 text-right">คงเหลือ</th>
                                        <th className="px-3 py-2">ติดตาม movement</th>
                                        <th className="px-3 py-2">สถานะ</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {!loading && rows.length > 0 && (
                                        <tr className="border-b border-emerald-100 bg-emerald-50/70 text-sm font-black text-emerald-900">
                                            <td className="px-3 py-2" colSpan={3}>รวมรายการที่แสดง {formatNumber(rows.length)} รายการ</td>
                                            <td className="px-3 py-2 text-right">{formatNumber(displayedTotals.opening_qty)}</td>
                                            <td className="px-3 py-2 text-right">{formatNumber(displayedTotals.received_qty)}</td>
                                            <td className="px-3 py-2 text-right">{formatNumber(displayedTotals.issued_qty)}</td>
                                            <td className="px-3 py-2 text-right">{formatNumber(displayedTotals.balance_qty)}</td>
                                            <td className="px-3 py-2" colSpan={2}>สรุปตามตัวกรองปัจจุบัน</td>
                                        </tr>
                                    )}
                                    {loading ? (
                                        <tr>
                                            <td className="px-3 py-8 text-center font-bold text-slate-500" colSpan={9}>กำลังโหลดข้อมูล...</td>
                                        </tr>
                                    ) : rows.length === 0 ? (
                                        <tr>
                                            <td className="px-3 py-8 text-center font-bold text-slate-500" colSpan={9}>ไม่พบข้อมูลตามเงื่อนไข</td>
                                        </tr>
                                    ) : rows.map((row) => (
                                        <tr key={row.id} className="border-b border-slate-100 last:border-0 hover:bg-slate-50">
                                            <td className="px-3 py-3">
                                                <div className="font-black text-slate-900">{row.agency_name}</div>
                                                <div className="text-xs font-semibold text-slate-500">
                                                    {row.agency_type}
                                                    {row.health_facility_id ? ` #${row.health_facility_id}` : " | ไม่พบในทะเบียนหน่วยบริการ"}
                                                </div>
                                                {row.agency_name_original && row.agency_name_original !== row.agency_name && (
                                                    <div className="text-xs text-slate-400">จากไฟล์: {row.agency_name_original}</div>
                                                )}
                                            </td>
                                            <td className="px-3 py-3">
                                                <div className="font-bold text-slate-800">{row.item_name}</div>
                                                <div className="text-xs text-slate-500">{row.item_code}</div>
                                            </td>
                                            <td className="px-3 py-3">{row.unit}</td>
                                            <td className="px-3 py-3 text-right">{formatNumber(row.opening_qty)}</td>
                                            <td className="px-3 py-3 text-right">{formatNumber(row.received_qty)}</td>
                                            <td className="px-3 py-3 text-right font-bold text-orange-700">{formatNumber(row.issued_qty)}</td>
                                            <td className="px-3 py-3 text-right font-black text-emerald-700">{formatNumber(row.balance_qty)}</td>
                                            <td className="px-3 py-3">{row.movement_tracked ? "ใช่" : "ไม่ใช่"}</td>
                                            <td className="px-3 py-3">
                                                <span className={`inline-flex rounded-full border px-2 py-1 text-xs font-black ${statusClass(row.data_status)}`}>
                                                    {statusLabel(row.data_status)}
                                                </span>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>

                    <aside className="space-y-4">
                        <section className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
                            <div className="mb-3 flex items-center gap-2">
                                <ClipboardList className="h-5 w-5 text-emerald-700" />
                                <h2 className="text-lg font-black text-slate-900">บันทึกจำนวนเวชภัณฑ์</h2>
                            </div>
                            <form className="space-y-3" onSubmit={saveInventory}>
                                <Field label="หน่วยบริการ">
                                    <select
                                        value={inventoryForm.health_facility_id}
                                        onChange={(event) => setInventoryForm({ ...inventoryForm, health_facility_id: event.target.value, item_code: "" })}
                                        className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                                    >
                                        <option value="">เลือกหน่วยบริการ</option>
                                        {healthFacilities.map((facility) => (
                                            <option key={facility.id} value={facility.id}>{facility.name}</option>
                                        ))}
                                    </select>
                                </Field>

                                <Field label="ประเภทการบันทึก">
                                    <select
                                        value={inventoryForm.item_mode}
                                        onChange={(event) => handleItemModeChange(event.target.value)}
                                        className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                                    >
                                        <option value="existing">บันทึกรายการเดิม</option>
                                        <option value="new">เพิ่มยาชนิดใหม่</option>
                                    </select>
                                </Field>

                                {inventoryForm.item_mode === "existing" ? (
                                    <Field label="เวชภัณฑ์">
                                        <select
                                            value={inventoryForm.item_code}
                                            onChange={(event) => handleExistingItemChange(event.target.value)}
                                            className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                                        >
                                            <option value="">เลือกรายการ</option>
                                            {items.map((item) => (
                                                <option key={item.id} value={item.id}>{item.label}</option>
                                            ))}
                                        </select>
                                    </Field>
                                ) : (
                                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                                        <Field label="รหัสเวชภัณฑ์">
                                            <input
                                                value={inventoryForm.item_code}
                                                onChange={(event) => setInventoryForm({ ...inventoryForm, item_code: event.target.value })}
                                                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm uppercase"
                                                placeholder="เช่น ORS"
                                            />
                                        </Field>
                                        <Field label="หน่วยนับ">
                                            <input
                                                value={inventoryForm.unit}
                                                onChange={(event) => setInventoryForm({ ...inventoryForm, unit: event.target.value })}
                                                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                                                placeholder="เช่น ซอง, ขวด, เม็ด"
                                            />
                                        </Field>
                                        <div className="sm:col-span-2">
                                            <Field label="ชื่อเวชภัณฑ์">
                                                <input
                                                    value={inventoryForm.item_name}
                                                    onChange={(event) => setInventoryForm({ ...inventoryForm, item_name: event.target.value })}
                                                    className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                                                    placeholder="ชื่อยา/เวชภัณฑ์"
                                                />
                                            </Field>
                                        </div>
                                    </div>
                                )}

                                <div className="rounded-lg border border-slate-100 bg-slate-50 p-3 text-sm font-semibold text-slate-600">
                                    รายการปัจจุบัน: <span className="font-black text-emerald-700">{selectedStock ? `${formatNumber(selectedStock.balance_qty)} ${selectedStock.unit}` : "ยังไม่มีข้อมูลของหน่วยบริการนี้"}</span>
                                </div>

                                <div className="grid grid-cols-2 gap-3">
                                    <Field label="ยกมา">
                                        <input
                                            type="number"
                                            min="0"
                                            value={inventoryForm.opening_qty}
                                            onChange={(event) => setInventoryForm({ ...inventoryForm, opening_qty: event.target.value })}
                                            className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                                        />
                                    </Field>
                                    <Field label="รับเข้า">
                                        <input
                                            type="number"
                                            min="0"
                                            value={inventoryForm.received_qty}
                                            onChange={(event) => setInventoryForm({ ...inventoryForm, received_qty: event.target.value })}
                                            className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                                        />
                                    </Field>
                                </div>

                                <div className="grid grid-cols-2 gap-3">
                                    <Field label="เบิกจ่าย">
                                        <input
                                            type="number"
                                            min="0"
                                            value={inventoryForm.issued_qty}
                                            onChange={(event) => setInventoryForm({ ...inventoryForm, issued_qty: event.target.value })}
                                            className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                                        />
                                    </Field>
                                    <Field label="คงเหลือ">
                                        <input
                                            type="number"
                                            min="0"
                                            value={inventoryForm.balance_qty}
                                            onChange={(event) => setInventoryForm({ ...inventoryForm, balance_qty: event.target.value })}
                                            className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                                            placeholder={`${calculatedBalance}`}
                                        />
                                    </Field>
                                </div>

                                <label className="flex items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm font-bold text-slate-700">
                                    <input
                                        type="checkbox"
                                        checked={inventoryForm.movement_tracked}
                                        onChange={(event) => setInventoryForm({ ...inventoryForm, movement_tracked: event.target.checked })}
                                        className="h-4 w-4 accent-emerald-700"
                                    />
                                    ติดตาม movement รายการนี้
                                </label>

                                <button className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-emerald-700 px-4 py-2 text-sm font-black text-white hover:bg-emerald-800">
                                    {inventoryForm.item_mode === "new" ? <PlusCircle className="h-4 w-4" /> : <Save className="h-4 w-4" />}
                                    {inventoryForm.item_mode === "new" ? "เพิ่มยาชนิดใหม่" : "บันทึกจำนวนเวชภัณฑ์"}
                                </button>
                            </form>
                        </section>
                    </aside>
                </section>
            </div>
        </EOCLayout>
    );
}

function StatCard({ icon: Icon, label, value, suffix = "" }) {
    return (
        <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
            <div className="flex items-center justify-between gap-3">
                <div>
                    <div className="text-xs font-black uppercase tracking-wide text-slate-500">{label}</div>
                    <div className="mt-2 text-2xl font-black text-slate-900">{formatNumber(value)} {suffix}</div>
                </div>
                <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-emerald-50 text-emerald-700">
                    <Icon className="h-5 w-5" />
                </div>
            </div>
        </div>
    );
}

function FilterSelect({ label, value, onChange, children }) {
    return (
        <label className="relative">
            <Search className="pointer-events-none absolute left-2 top-2.5 h-4 w-4 text-slate-400" />
            <select
                aria-label={label}
                value={value}
                onChange={(event) => onChange(event.target.value)}
                className="h-9 min-w-[170px] rounded-lg border border-slate-200 bg-white pl-8 pr-3 text-sm font-semibold text-slate-700"
            >
                <option value="">{label}: ทั้งหมด</option>
                {children}
            </select>
        </label>
    );
}

function Field({ label, children }) {
    return (
        <label className="block">
            <span className="mb-1 block text-sm font-black text-slate-700">{label}</span>
            {children}
        </label>
    );
}
