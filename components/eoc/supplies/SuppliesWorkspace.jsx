"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ArrowDownToLine, ArrowUpFromLine, ClipboardList, PackageOpen, Scale } from "lucide-react";
import { ReadOnlyNotice,
  AddButton, AdminPage, Button, DataTable, latestTime, Field, FilterSelect, FormDialog, FormGrid, StatStrip, StatusPill, Tabs, Toolbar,
  UpdatedAt, inputClass, useNotice
} from "@/components/admin/crud";
import { useUrlState } from "@/components/admin/useUrlState";
import ImportExcelDialog from "@/components/eoc/ImportExcelDialog";
import SuppliesDashboard from "@/components/eoc/supplies/SuppliesDashboard";
import SuppliesDailyReport from "@/components/eoc/supplies/SuppliesDailyReport";
import { apiRequest, formatDateTime, formatNumber } from "@/lib/adminApi";
import { FLOOD_PRESET_ITEMS, MOVEMENT_TYPES, STOCK_LEVEL_LABELS, displayItemCode } from "@/lib/medicalInventory";
import { getEocTypeLabel } from "@/lib/eocDisplay";
import { sendOrQueue } from "@/lib/offlineQueue";

const TABS = [
  { value: "overview", label: "ภาพรวม" },
  { value: "daily", label: "รายงานประจำวัน" },
  { value: "stock", label: "คงคลัง" },
  { value: "history", label: "ประวัติปรับยอด" }
];

const LEVEL_ORDER = { out: 0, low: 1, unknown: 2, ok: 3 };
const MOVE_ICON = { receive: ArrowDownToLine, issue: ArrowUpFromLine, adjust: Scale };

function LevelPill({ level }) {
  const config = STOCK_LEVEL_LABELS[level] || STOCK_LEVEL_LABELS.unknown;
  return <StatusPill tone={config.tone}>{config.label}</StatusPill>;
}

// เวชภัณฑ์และคลังยาของเหตุการณ์ EOC (เมนูเดียว)
// เปิดบัญชีคลัง → วันแรกนำเข้ารายการ + ยอดตั้งต้น (Excel หรือเพิ่มทีละรายการ) → ทุกวันรายงานรับเข้า/ใช้ไปของทุกรายการ
// ระบบคำนวณคงเหลือเอง (ยกมา + รับเข้า − ใช้ไป) และสรุปใน dashboard
export default function SuppliesWorkspace({ eocType = "flood" }) {
  const { notice, success, fail } = useNotice();
  const [tab, setTab] = useUrlState("tab", "overview", TABS.map((item) => item.value));
  const [dailyFacility, setDailyFacility] = useState("");
  const [refreshKey, setRefreshKey] = useState(0);
  const [state, setState] = useState({ loading: true, data: null, error: "" });
  const [search, setSearch] = useState("");
  const [levelFilter, setLevelFilter] = useState("");
  const [facilityFilter, setFacilityFilter] = useState("");
  const [moveDialog, setMoveDialog] = useState(null);
  const [itemDialog, setItemDialog] = useState(false);
  const [importKind, setImportKind] = useState(null);
  const [busy, setBusy] = useState(false);
  const [formError, setFormError] = useState("");
  const [moveForm, setMoveForm] = useState({ qty: "", requested_team: "", note: "" });
  const [itemForm, setItemForm] = useState({ health_facility_id: "", item_name: "", item_code: "", unit: "", opening_qty: "" });

  const url = `/stn-eoc/api/eoc/supplies?eoc=${eocType}`;
  const load = useCallback(async () => {
    setState((current) => ({ ...current, loading: true, error: "" }));
    try {
      setState({ loading: false, data: await apiRequest(url), error: "" });
    } catch (error) {
      setState({ loading: false, data: null, error: error.message });
    }
    setRefreshKey((key) => key + 1);
  }, [url]);
  useEffect(() => { load(); }, [load]);

  const data = state.data;
  const perms = data?.permissions || {};
  const stock = useMemo(() => data?.stock || [], [data]);

  // หน่วยบริการที่มีรายการในคลัง (ใช้เลือกในแบบรายงานประจำวัน)
  const facilities = useMemo(() => {
    const map = new Map();
    for (const row of stock) {
      const id = row.health_facility_id || row.inventory_agency_id;
      if (!map.has(id)) map.set(id, { id, name: row.agency_name, district: row.district_name || "" });
    }
    return [...map.values()].sort((a, b) => String(a.district).localeCompare(String(b.district), "th") || String(a.name).localeCompare(String(b.name), "th"));
  }, [stock]);

  const openDaily = (facilityId) => {
    setDailyFacility(facilityId ? String(facilityId) : "");
    setTab("daily");
  };

  const facilityOptions = useMemo(() => {
    const names = [...new Set(stock.map((row) => row.agency_name))].sort((a, b) => a.localeCompare(b, "th"));
    return [{ value: "", label: "ทุกหน่วยบริการ" }, ...names.map((name) => ({ value: name, label: name }))];
  }, [stock]);

  const rows = useMemo(() => {
    const keyword = search.trim().toLowerCase();
    return stock
      .filter((row) => !levelFilter || row.level === levelFilter)
      .filter((row) => !facilityFilter || row.agency_name === facilityFilter)
      .filter((row) => !keyword || `${row.item_name} ${row.item_code} ${row.agency_name}`.toLowerCase().includes(keyword))
      .sort((a, b) => (LEVEL_ORDER[a.level] ?? 9) - (LEVEL_ORDER[b.level] ?? 9) || String(a.item_name).localeCompare(String(b.item_name), "th"));
  }, [stock, search, levelFilter, facilityFilter]);

  const post = async (body, okMessage) => {
    setBusy(true);
    setFormError("");
    try {
      const result = await apiRequest(url, { method: "POST", body });
      success(result.message || okMessage);
      await load();
      return true;
    } catch (error) {
      setFormError(error.message);
      fail(error.message);
      return false;
    } finally {
      setBusy(false);
    }
  };

  const openMove = (row, type) => {
    setFormError("");
    setMoveForm({ qty: type === "adjust" ? String(Number(row.balance_qty || 0)) : "", requested_team: "", note: "" });
    setMoveDialog({ row, type });
  };

  const submitMove = async () => {
    setBusy(true);
    setFormError("");
    try {
      const result = await sendOrQueue(url, {
        method: "POST",
        label: `${MOVEMENT_TYPES[moveDialog.type]} ${moveDialog.row.item_name} ${moveForm.qty} ${moveDialog.row.unit || ""}`.trim(),
        body: { action: "movement", stock_id: moveDialog.row.id, movement_type: moveDialog.type, ...moveForm }
      });
      success(result.message || "บันทึกแล้ว");
      setMoveDialog(null);
      if (!result.queued) await load();
    } catch (error) {
      setFormError(error.message);
      fail(error.message);
    } finally {
      setBusy(false);
    }
  };

  const submitItem = async () => {
    const ok = await post({ action: "add_item", ...itemForm });
    if (ok) {
      setItemDialog(false);
      setItemForm({ health_facility_id: "", item_name: "", item_code: "", unit: "", opening_qty: "" });
    }
  };

  const session = data?.session;
  const context = session ? `${getEocTypeLabel(eocType)} ครั้งที่ ${session.session_number}${session.status === "active" ? "" : " (ปิดแล้ว)"}` : null;

  const columns = [
    { key: "item_name", label: "รายการ", render: (row) => <span><span className="font-bold text-slate-900">{row.item_name}</span>{displayItemCode(row) ? <span className="block text-xs text-slate-500">รหัส {displayItemCode(row)}</span> : null}</span> },
    { key: "agency_name", label: "หน่วยบริการ/คลัง", render: (row) => <span>{row.agency_name}{row.district_name ? <span className="block text-xs text-slate-500">อ.{row.district_name}</span> : null}</span> },
    { key: "level", label: "สถานะ", render: (row) => <LevelPill level={row.level} /> },
    { key: "balance_qty", label: "คงเหลือ", className: "text-right", render: (row) => <span className="font-black tabular-nums">{formatNumber(row.balance_qty)} <span className="text-xs font-normal text-slate-500">{row.unit}</span></span> },
    { key: "opening_qty", label: "ยอดตั้งต้น", className: "text-right tabular-nums", render: (row) => formatNumber(row.opening_qty) },
    { key: "received_qty", label: "รับเข้า", className: "text-right tabular-nums", render: (row) => formatNumber(row.received_qty) },
    { key: "issued_qty", label: "ใช้ไป/จ่ายออก", className: "text-right tabular-nums", render: (row) => formatNumber(row.issued_qty) },
    { key: "updated_at", label: "อัปเดต", render: (row) => <UpdatedAt value={row.updated_at} /> }
  ];

  const historyColumns = [
    { key: "movement_at", label: "เวลา", render: (row) => formatDateTime(row.movement_at) },
    { key: "movement_type", label: "รายการ", render: (row) => {
      const Icon = MOVE_ICON[row.movement_type] || Scale;
      return <span className="inline-flex items-center gap-1.5 font-semibold"><Icon className="h-4 w-4 text-slate-500" />{MOVEMENT_TYPES[row.movement_type] || row.movement_type}</span>;
    } },
    { key: "item_name", label: "เวชภัณฑ์", render: (row) => <span>{row.item_name}<span className="block text-xs text-slate-500">{row.agency_name}</span></span> },
    { key: "movement_qty", label: "จำนวน", className: "text-right tabular-nums", render: (row) => `${formatNumber(row.movement_qty)} ${row.unit || ""}` },
    { key: "balance_after", label: "คงเหลือหลังทำรายการ", className: "text-right tabular-nums", render: (row) => formatNumber(row.balance_after) },
    { key: "requested_team", label: "ผู้รับ/ทีม", render: (row) => row.requested_team || "-" },
    { key: "requested_by", label: "ผู้บันทึก", render: (row) => <span>{row.requested_by || "-"}{row.note ? <span className="block text-xs text-slate-500">{row.note}</span> : null}</span> }
  ];

  // ยังไม่มีเหตุการณ์ / ยังไม่เปิดบัญชีคลัง
  if (!state.loading && data && (!session || !data.event)) {
    return (
      <AdminPage title="เวชภัณฑ์และคลังยา" context={context} description="ติดตามยอดเวชภัณฑ์ของแต่ละหน่วยบริการตลอดเหตุการณ์ รับเข้า เบิกจ่าย และรู้ทันทีว่ารายการไหนใกล้หมด">
        {notice}
        <div className="rounded-xl border border-dashed border-[#c9dcee] bg-white px-6 py-10 text-center">
          <PackageOpen className="mx-auto h-10 w-10 text-slate-300" />
          <h2 className="mt-3 text-lg font-black text-slate-900">{session ? "ยังไม่ได้เปิดบัญชีคลังของเหตุการณ์นี้" : data.message}</h2>
          {session ? (
            <>
              <p className="mx-auto mt-1 max-w-lg text-sm text-slate-600">
                {data.previous_event
                  ? `ยกยอดคงเหลือจาก "${data.previous_event.event_name}" (${formatNumber(data.previous_event.item_rows)} รายการ) มาเป็นยอดตั้งต้นได้ทันที หรือเริ่มบัญชีว่างแล้วเพิ่มรายการเอง`
                  : "เปิดบัญชีคลังแล้วเพิ่มรายการเวชภัณฑ์ของแต่ละหน่วยบริการ"}
              </p>
              {perms.can_open ? (
                <div className="mt-4 flex flex-wrap justify-center gap-2">
                  {data.previous_event ? <Button disabled={busy} onClick={() => post({ action: "open_event", carry_over: true }, "เปิดบัญชีคลังแล้ว")}>ยกยอดจากครั้งก่อน</Button> : null}
                  <Button variant={data.previous_event ? "secondary" : "primary"} disabled={busy} onClick={() => post({ action: "open_event", carry_over: false }, "เปิดบัญชีคลังแล้ว")}>เริ่มบัญชีว่าง</Button>
                </div>
              ) : <p className="mt-3 text-sm text-slate-500">ผู้ดูแลระบบหรือผู้บัญชาการเป็นผู้เปิดบัญชีคลัง</p>}
            </>
          ) : null}
        </div>
      </AdminPage>
    );
  }

  const summary = data?.summary;
  return (
    <AdminPage
      freshness={stock.length ? { value: latestTime(stock.map((row) => row.updated_at)), staleHours: 24 } : null}
      title="เวชภัณฑ์และคลังยา"
      context={context}
      description="วันแรกนำเข้ายอดตั้งต้น จากนั้นทุกหน่วยบริการรายงานรับเข้าและใช้ไปของทุกรายการทุกวัน ระบบคำนวณยอดคงเหลือให้เอง"
      actions={(
        <>
          {eocType === "flood" ? <Link href="/eoc/flood/oxygen" className="inline-flex min-h-10 items-center rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-bold text-slate-700 hover:bg-slate-50">ออกซิเจนเหลว</Link> : null}
          {eocType === "flood" ? <Link href="/eoc/flood/team-reports?team=resources" className="inline-flex min-h-10 items-center rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-bold text-slate-700 hover:bg-slate-50">แจกจ่ายรายอำเภอ</Link> : null}
          {perms.can_add_item ? <Button variant="secondary" onClick={() => setImportKind("supplies")}>นำเข้ายอดตั้งต้น</Button> : null}
          {perms.can_move ? <Button variant="secondary" onClick={() => setImportKind("supplies-daily")}><ClipboardList className="h-4 w-4" aria-hidden="true" />นำเข้ารายงานประจำวัน</Button> : null}
          {perms.can_add_item ? <AddButton onClick={() => { setFormError(""); setItemDialog(true); }}>เพิ่มรายการ</AddButton> : null}
        </>
      )}
    >
      {notice}
      {state.error ? <p className="rounded-lg bg-red-50 p-3 text-sm text-red-800">{state.error}</p> : null}
      <ReadOnlyNotice message={perms.read_only_message} />
      {summary && tab === "stock" ? (
        <StatStrip items={[
          { label: "ชนิดเวชภัณฑ์", value: formatNumber(summary.items) },
          { label: "หน่วยบริการ/คลัง", value: formatNumber(summary.agencies) },
          { label: "หมด", value: formatNumber(summary.out), className: summary.out ? "text-red-700" : undefined },
          { label: "ใกล้หมด (<20%)", value: formatNumber(summary.low), className: summary.low ? "text-amber-700" : undefined }
        ]} />
      ) : null}

      <div className="rounded-xl border border-[#c9dcee] bg-white px-2">
        <Tabs value={tab} onChange={setTab} items={TABS} />
      </div>

      {tab === "overview" ? (
        <SuppliesDashboard eocType={eocType} sessionId={session?.id} refreshKey={refreshKey} onPickFacility={openDaily} />
      ) : tab === "daily" ? (
        <SuppliesDailyReport
          eocType={eocType} sessionId={session?.id} facilities={facilities} facilityId={dailyFacility} onFacilityChange={setDailyFacility}
          onSaved={() => setRefreshKey((key) => key + 1)} success={success} fail={fail} openImport={() => setImportKind("supplies-daily")}
        />
      ) : tab === "history" ? (
        <DataTable columns={historyColumns} rows={data?.movements || []} loading={state.loading} emptyText="ยังไม่มีการปรับยอดในเหตุการณ์นี้ (รับเข้า/ใช้ไปรายวันดูได้ที่ ภาพรวม และ รายงานประจำวัน)" caption="ประวัติปรับยอด" />
      ) : (
        <>
          <Toolbar search={search} onSearchChange={setSearch} searchPlaceholder="ค้นหาชื่อเวชภัณฑ์หรือหน่วยบริการ">
            <FilterSelect label="สถานะ" value={levelFilter} onChange={setLevelFilter} options={[
              { value: "", label: "ทุกสถานะ" }, { value: "out", label: "หมด" }, { value: "low", label: "ใกล้หมด" }, { value: "ok", label: "พอใช้" }, { value: "unknown", label: "ยังไม่รายงาน" }
            ]} />
            <FilterSelect label="หน่วยบริการ" value={facilityFilter} onChange={setFacilityFilter} options={facilityOptions} className="min-w-[12rem]" />
          </Toolbar>
          <DataTable
            columns={columns}
            rows={rows}
            loading={state.loading}
            caption="คงคลังเวชภัณฑ์"
            emptyText={stock.length ? "ไม่พบรายการตามเงื่อนไข" : "ยังไม่มีรายการเวชภัณฑ์ในบัญชีคลังนี้"}
            emptyAction={!stock.length && perms.can_add_item ? <AddButton onClick={() => setItemDialog(true)}>เพิ่มรายการแรก</AddButton> : null}
            rowClassName={(row) => (row.level === "out" ? "bg-red-50/40" : row.level === "low" ? "bg-amber-50/40" : "")}
            rowActions={perms.can_move ? (row) => (
              <div className="flex flex-wrap justify-end gap-1">
                <Button variant="secondary" className="min-h-9 px-2.5" onClick={() => openDaily(row.health_facility_id || row.inventory_agency_id)}><ClipboardList className="h-4 w-4" />รายงานวันนี้</Button>
                <Button variant="ghost" className="min-h-9 px-2" onClick={() => openMove(row, "adjust")} aria-label="ปรับยอดตามที่นับได้" title="ปรับยอดตามที่นับได้ (แก้ยอดเมื่อนับคลังแล้วไม่ตรง)"><Scale className="h-4 w-4" /></Button>
              </div>
            ) : undefined}
          />
        </>
      )}

      <FormDialog
        open={Boolean(moveDialog)}
        onOpenChange={(open) => { if (!open) setMoveDialog(null); }}
        title={moveDialog ? `${MOVEMENT_TYPES[moveDialog.type]}: ${moveDialog.row.item_name}` : ""}
        description={moveDialog ? `${moveDialog.row.agency_name} · คงเหลือ ${formatNumber(moveDialog.row.balance_qty)} ${moveDialog.row.unit || ""}` : ""}
        onSubmit={submitMove}
        busy={busy}
        error={formError}
        submitText={moveDialog ? MOVEMENT_TYPES[moveDialog.type] : "บันทึก"}
        size="md"
      >
        {moveDialog ? (
          <FormGrid>
            <Field label={moveDialog.type === "adjust" ? "ยอดที่นับได้จริง" : "จำนวน"} required hint={moveDialog.row.unit ? `หน่วย: ${moveDialog.row.unit}` : undefined}>
              <input type="number" min="0" step="any" inputMode="decimal" required autoFocus className={inputClass} value={moveForm.qty} onChange={(event) => setMoveForm((current) => ({ ...current, qty: event.target.value }))} />
            </Field>
            <Field label={moveDialog.type === "receive" ? "รับจาก" : "ผู้รับ/ทีมที่เบิก"} required={moveDialog.type === "issue"}>
              <input className={inputClass} value={moveForm.requested_team} placeholder={moveDialog.type === "receive" ? "เช่น สสจ.สตูล, บริจาค" : "เช่น ทีม MCATT อ.ละงู, ศูนย์พักพิง..."} onChange={(event) => setMoveForm((current) => ({ ...current, requested_team: event.target.value }))} />
            </Field>
            <Field label={moveDialog.type === "adjust" ? "เหตุผลการปรับยอด" : "หมายเหตุ"} required={moveDialog.type === "adjust"} wide>
              <textarea rows={2} className={inputClass} value={moveForm.note} onChange={(event) => setMoveForm((current) => ({ ...current, note: event.target.value }))} />
            </Field>
          </FormGrid>
        ) : null}
      </FormDialog>

      <FormDialog open={itemDialog} onOpenChange={setItemDialog} title="เพิ่มรายการเวชภัณฑ์" description="เพิ่มรายการให้หน่วยบริการหนึ่งแห่ง พร้อมยอดตั้งต้น" onSubmit={submitItem} busy={busy} error={formError} submitText="เพิ่มรายการ">
        <FormGrid>
          <Field label="หน่วยบริการ/คลัง" required wide>
            <select required className={inputClass} value={itemForm.health_facility_id} onChange={(event) => setItemForm((current) => ({ ...current, health_facility_id: event.target.value }))}>
              <option value="">เลือกหน่วยบริการ</option>
              {(data?.facilities || []).map((facility) => <option key={facility.id} value={facility.id}>{facility.name}{facility.district_name ? ` (อ.${facility.district_name})` : ""}</option>)}
            </select>
          </Field>
          <Field label="เลือกจากรายการมาตรฐาน" wide hint="เลือกแล้วระบบเติมชื่อ หน่วยนับ และรหัสให้ หรือพิมพ์เองด้านล่าง">
            <select className={inputClass} value={FLOOD_PRESET_ITEMS.some((item) => item.item_code === itemForm.item_code) ? itemForm.item_code : ""} onChange={(event) => {
              const preset = FLOOD_PRESET_ITEMS.find((item) => item.item_code === event.target.value);
              setItemForm((current) => (preset ? { ...current, item_name: preset.item_name, unit: preset.unit, item_code: preset.item_code } : { ...current, item_code: "" }));
            }}>
              <option value="">— พิมพ์รายการเอง —</option>
              {FLOOD_PRESET_ITEMS.map((item) => <option key={item.item_code} value={item.item_code}>{item.item_name} ({item.unit})</option>)}
            </select>
          </Field>
          {itemForm.health_facility_id ? (
            <div className="sm:col-span-2 flex flex-wrap items-center gap-2 rounded-lg bg-slate-50 px-3 py-2 text-sm text-slate-700">
              หรือเพิ่มรายการมาตรฐานทั้ง {FLOOD_PRESET_ITEMS.length} รายการให้หน่วยนี้ในครั้งเดียว (ยอดตั้งต้น 0)
              <Button variant="secondary" className="min-h-9 px-3" disabled={busy} onClick={async () => {
                const ok = await post({ action: "add_presets", health_facility_id: itemForm.health_facility_id });
                if (ok) setItemDialog(false);
              }}>เพิ่มทั้งชุด</Button>
            </div>
          ) : null}
          <Field label="ชื่อรายการ" required>
            <input required className={inputClass} value={itemForm.item_name} placeholder="เช่น ผงเกลือแร่ ORS" onChange={(event) => setItemForm((current) => ({ ...current, item_name: event.target.value }))} />
          </Field>
          <Field label="หน่วยนับ" required>
            <input required className={inputClass} value={itemForm.unit} placeholder="เช่น ซอง, กล่อง, ขวด" onChange={(event) => setItemForm((current) => ({ ...current, unit: event.target.value }))} />
          </Field>
          <Field label="รหัสรายการ" hint="ไม่ระบุได้ ระบบสร้างจากชื่อรายการ">
            <input className={inputClass} value={itemForm.item_code} onChange={(event) => setItemForm((current) => ({ ...current, item_code: event.target.value }))} />
          </Field>
          <Field label="ยอดตั้งต้น">
            <input type="number" min="0" step="any" inputMode="decimal" className={inputClass} value={itemForm.opening_qty} onChange={(event) => setItemForm((current) => ({ ...current, opening_qty: event.target.value }))} />
          </Field>
        </FormGrid>
      </FormDialog>
      <ImportExcelDialog
        open={Boolean(importKind)} onOpenChange={(open) => { if (!open) setImportKind(null); }} kind={importKind || "supplies"}
        context={{ eoc: eocType, session_id: data?.session?.id, ...(importKind === "supplies-daily" && tab === "daily" && dailyFacility ? { facility_id: dailyFacility } : {}) }}
        onImported={load}
      />
    </AdminPage>
  );
}
