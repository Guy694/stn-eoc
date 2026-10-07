"use client";

// บันทึกพื้นที่น้ำท่วมรายวัน (ทีม SAT)
// ลำดับการใช้งาน: เลือกวัน → ดูว่าตำบลไหนยังไม่ส่ง → กดตำบลเพื่อบันทึกทั้งตำบล หรือบันทึกรายหมู่บ้าน → แก้ไขรายแถวในตาราง
import { useCallback, useEffect, useMemo, useState } from "react";
import { ChevronLeft, ChevronRight, Copy, Plus } from "lucide-react";
import {
  AdminPage, Button, DataTable, DeleteDialog, FilterSelect, RowActions, StatStrip, StatusPill, Toolbar, UpdatedAt, inputClass, useNotice
} from "@/components/admin/crud";
import { apiRequest, formatNumber } from "@/lib/adminApi";
import { useSatunDistricts } from "@/lib/useSatunDistricts";
import { getOperationSessionLockByType } from "@/lib/eocSessionLock";
import {
  FLOOD_LEVELS, buildTambonCoverage, clampDateKey, levelMeta, localDateKey, recordsOnDate, shiftDateKey, summarizeCoverage, summarizeDay, todayKey, villageName
} from "@/lib/floodRecords";
import TambonCoverage from "./TambonCoverage";
import RecordFormDialog from "./RecordFormDialog";
import CopyDayDialog from "./CopyDayDialog";

const API = "/stn-eoc/api/admin/flood-records";

function thaiDate(key, options = { weekday: "long", day: "numeric", month: "long", year: "numeric" }) {
  if (!key) return "-";
  const [y, m, d] = key.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString("th-TH", options);
}

function sessionLabel(session) {
  const range = `${thaiDate(localDateKey(session.opened_at), { day: "numeric", month: "short", year: "2-digit" })} – ${session.closed_at ? thaiDate(localDateKey(session.closed_at), { day: "numeric", month: "short", year: "2-digit" }) : "ปัจจุบัน"}`;
  return `ครั้งที่ ${session.session_number} · ${session.status === "active" ? "เปิดอยู่" : "ปิดแล้ว"} · ${range}`;
}

export default function FloodRecordsWorkspace() {
  const districts = useSatunDistricts();
  const { notice, success, fail } = useNotice();
  const [sessions, setSessions] = useState([]);
  const [session, setSession] = useState(null);
  const [sessionsState, setSessionsState] = useState({ loading: true, error: "" });
  const [polygons, setPolygons] = useState([]);
  const [records, setRecords] = useState([]);
  const [recordsState, setRecordsState] = useState({ loading: false, error: "" });
  const [permissions, setPermissions] = useState({ can_edit: true, read_only_message: null });
  const [date, setDate] = useState("");
  const [search, setSearch] = useState("");
  const [district, setDistrict] = useState("all");
  const [level, setLevel] = useState("all");
  const [dialog, setDialog] = useState(null); // { mode: "village" | "tambon" | "edit", record?, district?, tambon? }
  const [copyOpen, setCopyOpen] = useState(false);
  const [deleting, setDeleting] = useState(null);
  const [deleteState, setDeleteState] = useState({ busy: false, error: "" });

  // เหตุการณ์: ใช้เหตุการณ์ที่เลือกไว้จากหน้าหลักก่อน ถ้าไม่มีใช้เหตุการณ์ที่เปิดอยู่
  useEffect(() => {
    let alive = true;
    apiRequest("/stn-eoc/api/eoc/sessions?type=flood&limit=100")
      .then((json) => {
        if (!alive) return;
        const list = Array.isArray(json.data) ? json.data : [];
        setSessions(list);
        const lock = getOperationSessionLockByType("flood");
        const pick = list.find((item) => Number(item.id) === Number(lock?.sessionId)) || list.find((item) => item.status === "active") || list[0] || null;
        setSession(pick);
        setSessionsState({ loading: false, error: "" });
      })
      .catch((error) => alive && setSessionsState({ loading: false, error: error.message }));
    apiRequest("/stn-eoc/api/common/village-polygons")
      .then((json) => alive && setPolygons(Array.isArray(json) ? json : json.data || []))
      .catch(() => alive && setPolygons([]));
    return () => { alive = false; };
  }, []);

  const minDate = localDateKey(session?.opened_at);
  const maxDate = useMemo(() => {
    const today = todayKey();
    const closed = localDateKey(session?.closed_at);
    return closed && closed < today ? closed : today;
  }, [session?.closed_at]);
  // บันทึกได้เมื่อเหตุการณ์เปิดอยู่และเป็นทีม SAT (ทีมอื่นดูได้อย่างเดียว — เซิร์ฟเวอร์ตรวจซ้ำ)
  const canOperate = session?.status === "active" && permissions.can_edit !== false;

  useEffect(() => {
    if (!session) return;
    setDate((current) => clampDateKey(current || maxDate, minDate, maxDate));
  }, [session, minDate, maxDate]);

  const load = useCallback(async () => {
    if (!session) return;
    setRecordsState((current) => ({ ...current, loading: true }));
    try {
      const json = await apiRequest(`${API}?session_id=${session.id}`);
      setRecords(Array.isArray(json.data) ? json.data : []);
      if (json.permissions) setPermissions(json.permissions);
      setRecordsState({ loading: false, error: "" });
    } catch (error) {
      setRecordsState({ loading: false, error: error.message });
    }
  }, [session]);
  useEffect(() => { load(); }, [load]);

  const dayRecords = useMemo(() => recordsOnDate(records, date), [records, date]);
  const coverage = useMemo(() => buildTambonCoverage({ districts, polygons, records, date }), [districts, polygons, records, date]);
  const coverageSummary = useMemo(() => summarizeCoverage(coverage), [coverage]);
  const day = useMemo(() => summarizeDay(dayRecords), [dayRecords]);

  const visible = useMemo(() => {
    const query = search.trim().toLowerCase();
    return dayRecords
      .filter((record) => district === "all" || record.district === district)
      .filter((record) => level === "all" || record.flood_level === level)
      .filter((record) => !query || `${villageName(record)} ${record.tambon} ${record.district}`.toLowerCase().includes(query))
      .sort((a, b) => a.district.localeCompare(b.district, "th") || a.tambon.localeCompare(b.tambon, "th") || villageName(a).localeCompare(villageName(b), "th"));
  }, [dayRecords, district, level, search]);

  const confirmDelete = async (reason) => {
    setDeleteState({ busy: true, error: "" });
    try {
      const json = await apiRequest(`${API}?id=${deleting.id}`, { method: "DELETE", body: { reason } });
      success(json.message);
      setDeleting(null);
      setDeleteState({ busy: false, error: "" });
      load();
    } catch (error) {
      setDeleteState({ busy: false, error: error.message });
    }
  };

  const onSaved = (message) => {
    success(message);
    setDialog(null);
    setCopyOpen(false);
    load();
  };

  if (sessionsState.loading) {
    return <AdminPage context="บันทึกข้อมูล" title="บันทึกพื้นที่น้ำท่วม"><div className="h-40 animate-pulse rounded-xl border border-slate-200 bg-white" /></AdminPage>;
  }
  if (!session) {
    return (
      <AdminPage context="บันทึกข้อมูล" title="บันทึกพื้นที่น้ำท่วม">
        <p className="rounded-xl border border-dashed border-[#c9dcee] bg-white px-5 py-6 text-sm text-slate-700" role="status">
          {sessionsState.error || "ยังไม่มีเหตุการณ์ EOC อุทกภัยน้ำท่วม — เปิดเหตุการณ์ก่อนจึงจะบันทึกพื้นที่น้ำท่วมได้"}
        </p>
      </AdminPage>
    );
  }

  const isToday = date === todayKey();

  return (
    <AdminPage
      context={`บันทึกข้อมูล · อุทกภัยน้ำท่วม ครั้งที่ ${session.session_number}`}
      title="บันทึกพื้นที่น้ำท่วม"
      description="ส่งสถานการณ์รายหมู่บ้านวันละครั้ง ตัวเลขนี้ใช้ในแผงสรุปสถานการณ์ แผนที่สาธารณะ และสรุปห้องประชุม"
      actions={canOperate ? (
        <>
          <Button variant="secondary" onClick={() => setCopyOpen(true)}><Copy className="h-4 w-4" aria-hidden="true" /> คัดลอกจากวันอื่น</Button>
          <Button onClick={() => setDialog({ mode: "village" })}><Plus className="h-4 w-4" aria-hidden="true" /> บันทึกหมู่บ้าน</Button>
        </>
      ) : null}
    >
      <section className="flex flex-col gap-3 rounded-xl border border-slate-200 bg-white p-3 lg:flex-row lg:items-center" aria-label="เลือกเหตุการณ์และวันที่">
        {sessions.length > 1 ? (
          <label className="block lg:w-80">
            <span className="sr-only">เหตุการณ์</span>
            <select
              className={inputClass}
              value={session.id}
              onChange={(event) => setSession(sessions.find((item) => String(item.id) === event.target.value) || session)}
            >
              {sessions.map((item) => <option key={item.id} value={item.id}>{sessionLabel(item)}</option>)}
            </select>
          </label>
        ) : null}
        <div className="flex flex-1 flex-wrap items-center gap-2">
          <Button variant="secondary" className="min-h-10 px-2.5" disabled={!date || date <= minDate} onClick={() => setDate(shiftDateKey(date, -1))} aria-label="วันก่อนหน้า">
            <ChevronLeft className="h-4 w-4" aria-hidden="true" />
          </Button>
          <label className="block">
            <span className="sr-only">วันที่บันทึก</span>
            <input type="date" className={`${inputClass} w-auto`} value={date} min={minDate} max={maxDate} onChange={(event) => event.target.value && setDate(clampDateKey(event.target.value, minDate, maxDate))} />
          </label>
          <Button variant="secondary" className="min-h-10 px-2.5" disabled={!date || date >= maxDate} onClick={() => setDate(shiftDateKey(date, 1))} aria-label="วันถัดไป">
            <ChevronRight className="h-4 w-4" aria-hidden="true" />
          </Button>
          {date !== maxDate ? (
            <Button variant="ghost" className="min-h-10" onClick={() => setDate(maxDate)}>{canOperate ? "วันนี้" : "วันปิด EOC"}</Button>
          ) : null}
          <span className="ml-1 text-sm font-bold text-slate-800">{thaiDate(date)}</span>
          {!isToday && canOperate ? <StatusPill tone="amber">บันทึกย้อนหลัง</StatusPill> : null}
        </div>
      </section>

      {!canOperate ? (
        <p className="rounded-xl border border-[#c9dcee] bg-[#edf5fc] px-4 py-3 text-sm text-[#083865]" role="status">
          {permissions.read_only_message || "เหตุการณ์นี้ปิดแล้ว ดูข้อมูลได้อย่างเดียว"}
        </p>
      ) : null}
      {recordsState.error ? <p className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800" role="alert">{recordsState.error}</p> : null}

      <StatStrip items={[
        { label: "ส่งรายงานแล้ว", value: `${coverageSummary.percent}%`, className: coverageSummary.percent >= 100 ? "text-emerald-700" : coverageSummary.percent >= 50 ? "text-amber-700" : "text-red-700" },
        { label: "หมู่บ้านที่มีน้ำท่วม", value: formatNumber(day.villages) },
        { label: "ระดับสูง–สูงมาก", value: formatNumber(day.severe), className: day.severe ? "text-red-700" : undefined },
        { label: "ผู้ได้รับผลกระทบ", value: `${formatNumber(day.people)} คน` }
      ]} />

      <TambonCoverage
        rows={coverage}
        summary={coverageSummary}
        loading={recordsState.loading && !records.length}
        canOperate={canOperate}
        onPick={(row) => setDialog({ mode: "tambon", district: row.district, tambon: row.tambon })}
      />

      <section aria-labelledby="day-records-title" className="space-y-3">
        <h2 id="day-records-title" className="text-lg font-black text-slate-900">ข้อมูลรายหมู่บ้าน {formatNumber(dayRecords.length)} แถว</h2>
        <Toolbar search={search} onSearchChange={setSearch} searchPlaceholder="ค้นหาหมู่บ้าน ตำบล อำเภอ">
          <FilterSelect label="อำเภอ" value={district} onChange={setDistrict} options={[{ value: "all", label: "ทุกอำเภอ" }, ...districts.map((item) => ({ value: item.name, label: `อ.${item.name}` }))]} />
          <FilterSelect label="ระดับน้ำท่วม" value={level} onChange={setLevel} options={[{ value: "all", label: "ทุกระดับ" }, ...FLOOD_LEVELS.map((item) => ({ value: item.value, label: item.value }))]} />
        </Toolbar>
        <DataTable
          caption={`ข้อมูลพื้นที่น้ำท่วม ${thaiDate(date)}`}
          loading={recordsState.loading}
          rows={visible}
          emptyText={dayRecords.length ? "ไม่พบข้อมูลตามตัวกรอง" : canOperate ? "ยังไม่มีข้อมูลของวันนี้ — กดตำบลด้านบนเพื่อบันทึกทั้งตำบล หรือคัดลอกจากวันก่อนแล้วแก้เฉพาะที่เปลี่ยน" : "ไม่มีข้อมูลในวันที่เลือก"}
          columns={[
            { key: "village", label: "หมู่บ้าน", render: (row) => (
              <div>
                <div className="font-semibold text-slate-900">{villageName(row) || "-"}</div>
                <div className="text-xs text-slate-500">ต.{row.tambon} อ.{row.district}</div>
              </div>
            ) },
            { key: "flood_level", label: "ระดับ", render: (row) => <StatusPill tone={levelMeta(row.flood_level).tone}>{row.flood_level || "-"}</StatusPill> },
            { key: "water_depth_cm", label: "ความลึก", render: (row) => (row.water_depth_cm ? `${formatNumber(row.water_depth_cm)} ซม.` : "-") },
            { key: "affected", label: "ผู้ได้รับผลกระทบ", render: (row) => (
              <span className="whitespace-nowrap">{formatNumber(row.affected_households)} ครัวเรือน · {formatNumber(row.affected_people)} คน</span>
            ) },
            { key: "updated_at", label: "บันทึกล่าสุด", mobile: false, render: (row) => (
              <div className="text-xs text-slate-600">
                <UpdatedAt value={row.updated_at || row.created_at} staleHours={24 * 365} />
                {row.created_by ? <div className="text-slate-500">{row.created_by}</div> : null}
              </div>
            ) }
          ]}
          rowActions={canOperate ? (row) => (
            <RowActions
              onEdit={() => setDialog({ mode: "edit", record: row })}
              onDelete={() => { setDeleteState({ busy: false, error: "" }); setDeleting(row); }}
            />
          ) : undefined}
        />
      </section>

      {dialog ? (
        <RecordFormDialog
          key={`${dialog.mode}-${dialog.record?.id || dialog.tambon || "new"}`}
          open
          onOpenChange={(value) => !value && setDialog(null)}
          dialog={dialog}
          session={session}
          date={date}
          minDate={minDate}
          maxDate={maxDate}
          districts={districts}
          polygons={polygons}
          records={records}
          onSaved={onSaved}
          onError={fail}
        />
      ) : null}

      <CopyDayDialog
        open={copyOpen}
        onOpenChange={setCopyOpen}
        session={session}
        records={records}
        targetDate={date}
        minDate={minDate}
        maxDate={maxDate}
        onDone={onSaved}
      />

      <DeleteDialog
        open={Boolean(deleting)}
        onOpenChange={(value) => !value && setDeleting(null)}
        itemType="ข้อมูลพื้นที่น้ำท่วม"
        itemLabel={deleting ? `${villageName(deleting)} ต.${deleting.tambon} (${thaiDate(localDateKey(deleting.flood_start_date), { day: "numeric", month: "short" })})` : ""}
        onConfirm={confirmDelete}
        busy={deleteState.busy}
        error={deleteState.error}
        note="ถ้าแค่ตัวเลขผิด ให้กด “แก้ไข” แทน การลบจะย้ายไปถังขยะและกู้คืนได้"
      />
      {notice}
    </AdminPage>
  );
}
