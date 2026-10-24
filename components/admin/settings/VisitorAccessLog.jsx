"use client";

// ประวัติผู้เข้าชม: ใครเข้าหน้าไหน เมื่อไร จาก IP และตำแหน่งโดยประมาณใด (ผู้ดูแลระบบ)
import { useCallback, useEffect, useMemo, useState } from "react";
import { AlertTriangle, Globe2, MapPin, Navigation, RefreshCw, ShieldCheck, Users } from "lucide-react";
import { Button, DataTable, FilterSelect, StatStrip, StatusPill, Toolbar } from "@/components/admin/crud";
import { apiRequest, formatNumber } from "@/lib/adminApi";
import VisitorMap from "@/components/admin/visitors/VisitorMap";
import IpCheckPanel from "@/components/admin/visitors/IpCheckPanel";
import { GPS_CONTEXTS, gpsMismatch, gpsPlaceLabel, locationLabel } from "@/lib/visitorLog";


const API = "/stn-eoc/api/admin/visitor-log";
const DEVICE = { mobile: "มือถือ", tablet: "แท็บเล็ต", desktop: "คอมพิวเตอร์", other: "อื่น ๆ" };

function when(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return date.toLocaleString("th-TH", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", second: "2-digit" });
}

function NetworkPill({ network }) {
  if (network === "private") return <StatusPill tone="gray">ภายใน</StatusPill>;
  if (network === "unknown") return <StatusPill tone="amber">ไม่ทราบ IP</StatusPill>;
  return null;
}

export default function VisitorAccessLog() {
  const [filters, setFilters] = useState({ days: "7", area: "", q: "", user: "", gps: "" });
  const [search, setSearch] = useState("");
  const [state, setState] = useState({ loading: true, error: "", data: null });

  // พิมพ์ค้นหาแล้วรอเล็กน้อยก่อนโหลด
  useEffect(() => {
    const timer = setTimeout(() => setFilters((current) => (current.q === search ? current : { ...current, q: search })), 400);
    return () => clearTimeout(timer);
  }, [search]);

  // ตัวกรองเดียวกันใช้ทั้งรายการและแผนที่
  const filterParams = useMemo(() => {
    const params = new URLSearchParams({ days: filters.days });
    if (filters.area) params.set("area", filters.area);
    if (filters.q) params.set("q", filters.q);
    if (filters.user) params.set("user", "1");
    if (filters.gps) params.set("gps", "1");
    return params;
  }, [filters]);
  const [refreshKey, setRefreshKey] = useState(0);

  const load = useCallback(async () => {
    setState((current) => ({ ...current, loading: true, error: "" }));
    setRefreshKey((key) => key + 1);
    try {
      const json = await apiRequest(`${API}?${filterParams}&size=100`);
      setState({ loading: false, error: "", data: json });
    } catch (error) {
      setState({ loading: false, error: error.message || "โหลดประวัติผู้เข้าชมไม่สำเร็จ", data: null });
    }
  }, [filterParams]);
  useEffect(() => { load(); }, [load]);

  const data = state.data;

  const pickIp = (ip) => setSearch(ip);

  const columns = [
    { key: "visited_at", label: "เวลา", render: (row) => <span className="whitespace-nowrap tabular-nums">{when(row.visited_at)}</span> },
    {
      key: "ip",
      label: "IP",
      render: (row) => (
        <span className="flex flex-wrap items-center gap-1">
          <button type="button" onClick={() => pickIp(row.ip_address)} className="font-mono text-xs font-semibold text-[#0b4c86] hover:underline" title="ดูทุกครั้งที่ IP นี้เข้าชม">{row.ip_address}</button>
          <NetworkPill network={row.network} />
        </span>
      )
    },
    {
      key: "location",
      label: "ตำแหน่งโดยประมาณ",
      render: (row) => {
        const gpsLabel = gpsPlaceLabel(row);
        const mismatch = gpsMismatch(row);
        return (
          <span className="block text-slate-700">
            {gpsLabel ? (
              <span className="block">
                <span className="inline-flex items-center gap-1 font-semibold text-emerald-800"><Navigation className="h-3.5 w-3.5" aria-hidden="true" />{gpsLabel}</span>
                <span className="block text-[11px] tabular-nums text-slate-500">GPS {Number(row.gps_latitude).toFixed(2)}, {Number(row.gps_longitude).toFixed(2)}{row.gps_accuracy_m ? ` ±${row.gps_accuracy_m >= 1000 ? `${Math.round(row.gps_accuracy_m / 1000)} กม.` : `${row.gps_accuracy_m} ม.`}` : ""} · {GPS_CONTEXTS[row.gps_context] || "ผู้ใช้อนุญาต"}</span>
              </span>
            ) : null}
            <span className={gpsLabel ? "block text-[11px] text-slate-500" : "block"}>{gpsLabel ? "จาก IP: " : ""}{locationLabel(row)}</span>
            {!gpsLabel && row.latitude !== null && row.latitude !== undefined ? <span className="block text-[11px] tabular-nums text-slate-500">{Number(row.latitude).toFixed(3)}, {Number(row.longitude).toFixed(3)}</span> : null}
            {mismatch ? <span className="mt-0.5 inline-flex items-center gap-1 rounded bg-amber-50 px-1.5 py-0.5 text-[11px] font-semibold text-amber-800"><AlertTriangle className="h-3 w-3" aria-hidden="true" />{mismatch.message}</span> : null}
          </span>
        );
      }
    },
    {
      key: "user",
      label: "ผู้ใช้",
      render: (row) => (row.username
        ? <span><span className="font-semibold text-slate-900">{row.username}</span><span className="block text-[11px] text-slate-500">{row.role}</span></span>
        : <span className="text-slate-500">ไม่ได้เข้าสู่ระบบ</span>)
    },
    {
      key: "path",
      label: "หน้า",
      render: (row) => (
        <span className="break-all">
          <StatusPill tone={row.area === "staff" ? "blue" : "gray"}>{row.area === "staff" ? "เจ้าหน้าที่" : "ประชาชน"}</StatusPill>
          <span className="ml-1 font-mono text-xs text-slate-700">{row.path}</span>
          {row.referrer_host ? <span className="block text-[11px] text-slate-500">มาจาก {row.referrer_host}</span> : null}
        </span>
      )
    },
    { key: "device", label: "อุปกรณ์", render: (row) => <span className="whitespace-nowrap text-slate-600">{DEVICE[row.device] || "-"} · {row.browser || "-"}</span> }
  ];

  return (
    <section className="space-y-4">
      <div className="flex flex-col gap-2 rounded-2xl border border-[#c9dcee] bg-[#edf5fc] p-4 text-sm text-[#083865] sm:flex-row sm:items-start">
        <ShieldCheck className="h-5 w-5 shrink-0" aria-hidden="true" />
        <div>
          <p>บันทึกทุกการเปิดหน้าเว็บ (ทั้งประชาชนและเจ้าหน้าที่) เพื่อตรวจสอบย้อนหลังด้านความปลอดภัย: IP ตำแหน่งโดยประมาณจาก IP หน้าที่เปิด และบัญชีที่เข้าสู่ระบบ</p>
          <p className="mt-1 text-xs">
            ตำแหน่งมี 2 แบบ: จาก IP (ทุกคน ระดับประเทศ/เมือง) และ GPS เฉพาะผู้ที่กดอนุญาต (ปัดเหลือ ≈ 1 กม.) · เตือนเมื่อ GPS กับ IP ไม่สอดคล้องกัน · เก็บ {data?.retentionDays || 365} วันแล้วลบอัตโนมัติ
            {data && !data.geoLookup ? " · ยังไม่ได้ตั้งบริการหาตำแหน่งจาก IP (VISITOR_GEO_LOOKUP_URL) จึงแสดงตำแหน่งได้เฉพาะเมื่อ proxy/CDN ส่งมาให้" : ""}
          </p>
        </div>
      </div>

      <IpCheckPanel />

      <Toolbar
        search={search}
        onSearchChange={setSearch}
        searchPlaceholder="ค้นหา IP ชื่อผู้ใช้ หน้า หรือเมือง"
        right={<Button variant="secondary" onClick={load} disabled={state.loading}><RefreshCw className={`h-4 w-4 ${state.loading ? "animate-spin" : ""}`} aria-hidden="true" /> รีเฟรช</Button>}
      >
        <FilterSelect label="ช่วงเวลา" value={filters.days} onChange={(days) => setFilters((current) => ({ ...current, days }))} options={[{ value: "1", label: "24 ชั่วโมง" }, { value: "7", label: "7 วัน" }, { value: "30", label: "30 วัน" }, { value: "90", label: "90 วัน" }, { value: "180", label: "6 เดือน" }, { value: "365", label: "1 ปี" }]} />
        <FilterSelect label="ส่วนของเว็บ" value={filters.area} onChange={(area) => setFilters((current) => ({ ...current, area }))} options={[{ value: "", label: "ทุกส่วน" }, { value: "public", label: "หน้าประชาชน" }, { value: "staff", label: "หน้าเจ้าหน้าที่" }]} />
        <FilterSelect label="ตำแหน่ง GPS" value={filters.gps} onChange={(gps) => setFilters((current) => ({ ...current, gps }))} options={[{ value: "", label: "ทุกรายการ" }, { value: "1", label: "เฉพาะที่มี GPS" }]} />
        <FilterSelect label="ผู้ใช้" value={filters.user} onChange={(user) => setFilters((current) => ({ ...current, user }))} options={[{ value: "", label: "ทุกคน" }, { value: "1", label: "เฉพาะที่เข้าสู่ระบบ" }]} />
      </Toolbar>

      {state.error ? <p role="alert" className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">{state.error}</p> : null}

      {data ? (
        <>
          <StatStrip
            compact
            items={[
              { label: "การเข้าชม", value: formatNumber(data.summary.visits), unit: "ครั้ง", icon: Globe2 },
              { label: "IP ไม่ซ้ำ", value: formatNumber(data.summary.uniqueIps), unit: "IP", tone: "blue" },
              { label: "เจ้าหน้าที่ที่เข้าระบบ", value: formatNumber(data.summary.staffUsers), unit: "คน", icon: Users },
              { label: "มีตำแหน่ง GPS (ผู้ใช้อนุญาต)", value: formatNumber(data.summary.gpsVisits || 0), unit: "ครั้ง", icon: Navigation, tone: "green", onClick: () => setFilters((current) => ({ ...current, gps: current.gps ? "" : "1" })), active: Boolean(filters.gps) }
            ]}
          />

          <VisitorMap params={filterParams} onPickIp={pickIp} refreshKey={refreshKey} />

          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <div className="rounded-2xl border border-slate-200 bg-white">
              <h4 className="border-b border-slate-100 px-4 py-3 font-black text-slate-900">IP ที่เข้าชมมากที่สุด</h4>
              {data.topIps.length ? (
                <ul className="divide-y divide-slate-100">
                  {data.topIps.map((row) => (
                    <li key={row.ip_address} className="flex items-center justify-between gap-3 px-4 py-2 text-sm">
                      <span className="min-w-0">
                        <button type="button" onClick={() => pickIp(row.ip_address)} className="font-mono text-xs font-semibold text-[#0b4c86] hover:underline">{row.ip_address}</button>
                        <span className="block truncate text-xs text-slate-500">{locationLabel(row)}{row.username ? ` · ${row.username}` : ""} · ล่าสุด {when(row.last_seen)}</span>
                      </span>
                      <span className="shrink-0 font-bold tabular-nums text-slate-900">{formatNumber(row.visits)} <span className="font-normal text-slate-500">ครั้ง</span></span>
                    </li>
                  ))}
                </ul>
              ) : <p className="p-4 text-sm text-slate-500">ยังไม่มีข้อมูล</p>}
            </div>
            <div className="rounded-2xl border border-slate-200 bg-white">
              <h4 className="flex items-center gap-2 border-b border-slate-100 px-4 py-3 font-black text-slate-900"><MapPin className="h-4 w-4 text-[#0b4c86]" aria-hidden="true" /> ตำแหน่งที่เข้าชม</h4>
              {data.places.length ? (
                <ul className="divide-y divide-slate-100">
                  {data.places.map((row) => (
                    <li key={row.place} className="flex justify-between gap-3 px-4 py-2 text-sm">
                      <span className="truncate text-slate-700">{row.place}</span>
                      <span className="shrink-0 tabular-nums text-slate-600">{formatNumber(row.visits)} ครั้ง · {formatNumber(row.unique_ips)} IP</span>
                    </li>
                  ))}
                </ul>
              ) : <p className="p-4 text-sm text-slate-500">ยังไม่มีข้อมูลตำแหน่ง</p>}
            </div>
          </div>

          <div>
            <h4 className="mb-2 font-black text-slate-900">
              การเข้าชมล่าสุด {data.total > data.rows.length ? <span className="text-sm font-normal text-slate-500">(แสดง {formatNumber(data.rows.length)} จาก {formatNumber(data.total)} ครั้ง — ใช้ตัวกรองเพื่อดูเฉพาะที่ต้องการ)</span> : null}
            </h4>
            <DataTable columns={columns} rows={data.rows} loading={state.loading} pageSize={25} caption="ประวัติผู้เข้าชม" emptyText="ไม่พบการเข้าชมตามตัวกรองนี้" />
          </div>
        </>
      ) : state.loading ? <p className="py-10 text-center text-sm text-slate-500">กำลังโหลดประวัติผู้เข้าชม…</p> : null}
    </section>
  );
}
