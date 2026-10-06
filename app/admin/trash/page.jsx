"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { RotateCcw } from "lucide-react";
import EOCLayout from "@/components/layouts/EOCLayout";
import { AdminPage, Button, DataTable, FilterSelect, StatusPill, Toolbar, UpdatedAt, useNotice } from "@/components/admin/crud";
import AppDialog, { AppDialogActions, AppDialogCancel } from "@/components/ui/app-dialog";
import { apiRequest, formatDateTime } from "@/lib/adminApi";

const API = "/stn-eoc/api/admin/deleted-records";

export default function TrashPage() {
  const [rows, setRows] = useState([]);
  const [tables, setTables] = useState([]);
  const [table, setTable] = useState("all");
  const [showRestored, setShowRestored] = useState(false);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [restoring, setRestoring] = useState(null);
  const [busy, setBusy] = useState(false);
  const { notice, success, fail } = useNotice();

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (table !== "all") params.set("table", table);
      if (showRestored) params.set("include_restored", "1");
      const json = await apiRequest(`${API}?${params}`);
      setRows(json.data || []);
      setTables(json.tables || []);
      setLoadError("");
    } catch (error) {
      setRows([]);
      setLoadError(error.message);
    } finally {
      setLoading(false);
    }
  }, [showRestored, table]);

  useEffect(() => { load(); }, [load]);

  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return rows;
    return rows.filter((row) => `${row.record_label} ${row.delete_reason} ${row.deleted_by_name}`.toLowerCase().includes(query));
  }, [rows, search]);

  const restore = async () => {
    setBusy(true);
    try {
      const json = await apiRequest(API, { method: "POST", body: { id: restoring.id } });
      success(json.message);
      setRestoring(null);
      load();
    } catch (error) {
      fail(error.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <EOCLayout>
      <AdminPage
        context="บริหารระบบ"
        title="ถังขยะ"
        description="ข้อมูลศูนย์พักพิง กลุ่มเปราะบาง และคำขอจากประชาชนที่ถูกลบ จะมาอยู่ที่นี่พร้อมเหตุผล ผู้ดูแลระบบกู้คืนกลับเข้าระบบได้"
      >
        <Toolbar search={search} onSearchChange={setSearch} searchPlaceholder="ค้นหาชื่อ เหตุผล หรือผู้ลบ">
          <FilterSelect label="ประเภทข้อมูล" value={table} onChange={setTable} options={[{ value: "all", label: "ทุกประเภท" }, ...tables]} />
          <label className="flex items-center gap-2 px-1 text-sm text-slate-700">
            <input type="checkbox" checked={showRestored} onChange={(event) => setShowRestored(event.target.checked)} className="h-4 w-4" />
            แสดงรายการที่กู้คืนแล้ว
          </label>
        </Toolbar>

        {loadError ? <p className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">{loadError}</p> : null}

        <DataTable
          caption="รายการในถังขยะ"
          loading={loading}
          rows={filtered}
          emptyText="ถังขยะว่าง"
          columns={[
            { key: "record_label", label: "รายการ", render: (row) => <span className="font-semibold text-slate-900">{row.record_label || `#${row.record_id}`}</span> },
            { key: "table_label", label: "ประเภท" },
            { key: "delete_reason", label: "เหตุผลที่ลบ", className: "max-w-xs" },
            { key: "deleted_by_name", label: "ลบโดย", render: (row) => row.deleted_by_name || "-" },
            { key: "deleted_at", label: "เมื่อ", render: (row) => <UpdatedAt value={row.deleted_at} staleHours={24 * 365} /> },
            { key: "state", label: "สถานะ", render: (row) => row.restored_at ? <StatusPill tone="green">กู้คืนแล้ว {formatDateTime(row.restored_at)}</StatusPill> : <StatusPill>อยู่ในถังขยะ</StatusPill> }
          ]}
          rowActions={(row) => row.restored_at ? null : (
            <Button variant="secondary" className="min-h-9 px-3" onClick={() => setRestoring(row)}>
              <RotateCcw className="h-4 w-4" aria-hidden="true" /> กู้คืน
            </Button>
          )}
        />
      </AdminPage>

      <AppDialog open={Boolean(restoring)} onOpenChange={(open) => !open && setRestoring(null)} title="กู้คืนข้อมูล" size="sm" busy={busy}
        footer={(
          <AppDialogActions>
            <AppDialogCancel disabled={busy} />
            <Button onClick={restore} disabled={busy}>{busy ? "กำลังกู้คืน…" : "กู้คืน"}</Button>
          </AppDialogActions>
        )}
      >
        <p className="text-sm text-slate-700">
          กู้คืน <strong>{restoring?.record_label}</strong> ({restoring?.table_label}) กลับเข้าระบบด้วยรหัสเดิม
        </p>
        <p className="mt-2 text-xs text-slate-500">ลบเมื่อ {formatDateTime(restoring?.deleted_at)} โดย {restoring?.deleted_by_name || "-"} เหตุผล: {restoring?.delete_reason}</p>
      </AppDialog>
      {notice}
    </EOCLayout>
  );
}
