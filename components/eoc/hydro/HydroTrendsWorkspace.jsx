"use client";

// แนวโน้มน้ำ ฝน และน้ำทะเลหนุน: กราฟจากข้อมูลที่ระบบเก็บรายชั่วโมง (ThaiWater, ปภ., IOC/Open-Meteo)
import dynamic from "next/dynamic";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { CloudRain, CloudRainWind, Download, Droplets, RefreshCw, TrendingUp, Waves } from "lucide-react";
import { PageHero, Panel, heroButtonClass } from "@/components/common/ThemePanels";
import { MetricCard, MetricGrid } from "@/components/common/MetricCards";
import HydroRainSection from "@/components/eoc/hydro/HydroRainSection";
import { HydroSeaSection, HydroWaterSection } from "@/components/eoc/hydro/HydroWaterSection";
import { Segmented } from "@/components/eoc/hydro/HydroParts";
import { dayLabel, fmt, timeLabel } from "@/components/eoc/hydro/hydroUi";
import { downloadCsv } from "@/lib/exportCsv";
import { HEAVY_RAIN_1H_MM, HEAVY_RAIN_MM, RANGE_DAYS, bucketHours } from "@/lib/hydroHistory";

const HydroStationsMap = dynamic(() => import("@/components/eoc/hydro/HydroStationsMap"), {
  ssr: false,
  loading: () => <div className="h-[26rem] animate-pulse rounded-xl bg-slate-100 lg:h-[34rem]" aria-hidden="true" />
});

const API = "/stn-eoc/api/eoc/hydro-trends";

/** publicMode = หน้าประชาชน (/public/water-trends): ใช้ API สาธารณะ แสดงเฉพาะกราฟหลัก */
export default function HydroTrendsWorkspace({ publicMode = false }) {
  const api = publicMode ? "/stn-eoc/api/public/hydro-trends" : API;
  const detailed = !publicMode;
  const [days, setDays] = useState(7);
  const [amphoe, setAmphoe] = useState("");
  const [state, setState] = useState({ loading: true, data: null, error: "" });
  const [stationCode, setStationCode] = useState("");
  const waterRef = useRef(null);

  const load = useCallback(async () => {
    setState((s) => ({ ...s, loading: true, error: "" }));
    try {
      const response = await fetch(`${api}?days=${days}${amphoe ? `&amphoe=${encodeURIComponent(amphoe)}` : ""}`, { cache: "no-store" });
      const json = await response.json();
      if (!response.ok || !json.success) throw new Error(json.message || "โหลดข้อมูลไม่สำเร็จ");
      setState({ loading: false, data: json.data, error: "" });
    } catch (error) {
      setState((s) => ({ loading: false, data: s.data, error: error.message }));
    }
  }, [api, days, amphoe]);
  useEffect(() => { load(); }, [load]);

  const data = state.data;
  const bucket = bucketHours(data?.range?.days || days);
  const dates = data?.range?.dates || [];
  // สถานี ปภ. ก่อน แล้วตามด้วย ThaiWater (ในกลุ่มเดียวกันเรียงจากใกล้/เกินตลิ่งมากที่สุด)
  const waterStations = useMemo(() => [...(data?.water?.stations || [])].sort((a, b) =>
    (a.source === "ปภ." ? 0 : 1) - (b.source === "ปภ." ? 0 : 1) || (b.peak?.diff ?? -99) - (a.peak?.diff ?? -99)
  ), [data]);
  const station = waterStations.find((s) => s.code === stationCode) || waterStations[0] || null;
  const rainDaily = data?.rain?.daily || [];
  const allRainStations = useMemo(() => data?.rain?.stations || [], [data]);
  const rainStations = useMemo(() => (amphoe ? allRainStations.filter((s) => s.amphoe === amphoe) : allRainStations), [allRainStations, amphoe]);
  const sea = data?.sea || {};

  const heavyDays = rainDaily.filter((d) => (d.max_mm ?? 0) >= HEAVY_RAIN_MM).length;
  const wettest = rainStations[0] || null;
  const top1h = rainStations.reduce((best, s) => ((s.max_1h_mm ?? -1) > (best?.max_1h_mm ?? -1) ? s : best), null);
  const overBank = waterStations.filter((s) => s.hours_over_bank > 0);
  const fastest = waterStations.reduce((best, s) => ((s.max_rise?.rate ?? 0) > (best?.max_rise?.rate ?? 0) ? s : best), null);

  const selectWater = useCallback((code, scroll = false) => {
    setStationCode(code);
    if (scroll) waterRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, []);

  const exportCsv = () => {
    if (!data) return;
    downloadCsv([
      [`แนวโน้มน้ำและฝน จ.สตูล ${data.range.from} ถึง ${data.range.to}${amphoe ? ` (อ.${amphoe})` : ""}`],
      [],
      ["ฝนรายวัน (07:00–07:00)", "เฉลี่ย (มม.)", "สูงสุด (มม.)", "สถานีที่ฝนมากสุด", "สะสมเฉลี่ย (มม.)", "สถานีที่มีฝน", "สถานีฝนหนัก", "จำนวนสถานี"],
      ...rainDaily.map((d) => [d.date, d.avg_mm ?? "", d.max_mm ?? "", d.max_station || "", d.cum_avg_mm ?? "", d.rain_stations ?? "", d.heavy_stations ?? "", d.stations]),
      [],
      ["ฝนรายอำเภอ", "จำนวนสถานี", "สะสมเฉลี่ย (มม.)", "สูงสุดต่อวัน (มม.)", "วันที่สูงสุด", "สถานีที่สูงสุด", "สะสม 3 วันสูงสุด (มม.)", "วันมีฝน", "วันฝนหนัก"],
      ...(data.rain.by_district || []).map((d) => [d.amphoe, d.stations, d.total_mm ?? "", d.max_day_mm ?? "", d.max_day || "", d.max_station || "", d.max_3d_mm ?? "", d.rain_days, d.heavy_days]),
      [],
      ["ฝนเฉลี่ยรายอำเภอ × วัน (มม.)", ...dates],
      ...(data.rain.by_district || []).map((d) => [d.amphoe, ...d.daily_avg.map((v) => v ?? "")]),
      [],
      ["สถานีวัดฝน", "อำเภอ", "ตำบล", "ฝนรวม (มม.)", "สูงสุดต่อวัน (มม.)", "สะสม 3 วันสูงสุด (มม.)", "แรงสุด 1 ชม. (มม.)", "เวลาที่แรงสุด", "วันมีฝน", "วันฝนหนัก", ...dates],
      ...rainStations.map((s) => [s.name, s.amphoe || "", s.tambon || "", s.total_mm ?? "", s.max_day_mm ?? "", s.max_3d_mm ?? "", s.max_1h_mm ?? "", s.max_1h_at || "", s.rain_days ?? "", s.heavy_days, ...(s.daily_mm || []).map((v) => v ?? "")]),
      [],
      ["สถานีวัดระดับน้ำ", "แหล่งข้อมูล", "อำเภอ", "ตลิ่ง (ม.)", "ล่าสุด (ม.)", "ล่าสุดเทียบตลิ่ง (ม.)", "สูงสุด (ม.)", "เวลาสูงสุด", "สูงสุดเทียบตลิ่ง (ม.)", "ต่ำสุด (ม.)", "เปลี่ยนใน 6 ชม. (ม.)", "ขึ้นเร็วสุด (ม./ชม.)", "ชม.ที่ล้นตลิ่ง", "วันที่ล้นตลิ่ง"],
      ...waterStations.map((s) => [s.name, s.source, s.amphoe || "", s.bank ?? "", s.latest?.level ?? "", s.latest?.diff ?? "", s.peak?.level ?? "", s.peak?.t || "", s.peak?.diff ?? "", s.lowest?.level ?? "", s.change_6h ?? "", s.max_rise?.rate ?? "", s.hours_over_bank, s.days_over_bank ?? ""]),
      [],
      ["น้ำทะเลรายวัน", "แบบจำลองสูงสุด (ม.)", "วัดจริงสูงสุด ลังกาวี (ม.)", "พิสัยน้ำขึ้น–ลง (ม.)"],
      ...(sea.daily || []).map((d) => [d.date, d.model_max ?? "", d.observed_max ?? "", d.tidal_range ?? ""])
    ], `hydro-trends-${data.range.from}-${data.range.to}.csv`);
  };

  // ช่วงที่เลือกยาวกว่าข้อมูลที่เก็บไว้ → บอกวันที่เริ่มมีข้อมูล
  const coverageNote = useMemo(() => {
    if (!data) return null;
    const late = [["ฝน", data.coverage?.rain], ["ระดับน้ำ", data.coverage?.water], ["น้ำทะเล", data.coverage?.sea]]
      .filter(([, start]) => start && String(start).slice(0, 10) > data.range.from)
      .map(([name, start]) => `${name}เริ่ม ${dayLabel(start)}`);
    return late.length ? ` · ข้อมูลที่เก็บไว้: ${late.join(" · ")}` : null;
  }, [data]);

  return (
    <div className="w-full space-y-4 font-[family-name:var(--font-kanit)]">
      <PageHero
        icon="waves"
        eyebrow={publicMode ? "ข้อมูลจากสถานีตรวจวัด จ.สตูล" : "วิเคราะห์ข้อมูล"}
        title={publicMode ? "แนวโน้มระดับน้ำและฝน" : "แนวโน้มน้ำ ฝน และน้ำทะเลหนุน"}
        subtitle={publicMode
          ? "ฝนรายวัน ระดับน้ำในคลองเทียบตลิ่ง และน้ำทะเลหนุนหน้าสตูล ย้อนหลัง 7–90 วัน ใช้ประกอบการเฝ้าระวังน้ำท่วม"
          : "จากค่าที่ระบบเก็บทุกชั่วโมง: ฝนรายสถานี (ThaiWater) ระดับน้ำในคลอง (ThaiWater, ปภ.) และระดับน้ำทะเลหน้าสตูล"}
        actions={(
          <>
            <Segmented tone="dark" label="ช่วงเวลา" value={days} onChange={setDays} options={RANGE_DAYS.map((d) => [d, `${d} วัน`])} />
            <button type="button" onClick={load} disabled={state.loading} className={heroButtonClass}><RefreshCw className={`h-4 w-4 ${state.loading ? "animate-spin" : ""}`} aria-hidden="true" />รีเฟรช</button>
            <button type="button" onClick={exportCsv} disabled={!data} className={heroButtonClass}><Download className="h-4 w-4" aria-hidden="true" />CSV</button>
          </>
        )}
        meta={data ? `${dayLabel(data.range.from)} – ${dayLabel(data.range.to)} · ฝนนับวันแบบกรมอุตุฯ (07:00 ถึง 07:00 วันถัดไป)${coverageNote || ""}` : null}
      />

      {state.error ? <p role="alert" className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">{state.error} <button type="button" onClick={load} className="ml-2 font-semibold underline">ลองใหม่</button></p> : null}
      {!data && state.loading ? <div className="h-96 animate-pulse rounded-2xl bg-white" aria-hidden="true" /> : null}

      {data ? (
        <>
          <MetricGrid cols={detailed ? "grid-cols-2 lg:grid-cols-3 2xl:grid-cols-6" : "grid-cols-2 lg:grid-cols-4"}>
            <MetricCard icon={CloudRain} tone={heavyDays ? "amber" : "blue"} label="วันที่มีฝนหนัก" value={heavyDays} unit={`/${rainDaily.length} วัน`} note={`สถานีใดสถานีหนึ่ง ≥ ${HEAVY_RAIN_MM} มม.${amphoe ? ` · อ.${amphoe}` : ""}`} />
            <MetricCard icon={Droplets} tone="blue" label="ฝนสะสมมากสุด" value={wettest ? fmt(wettest.total_mm) : "–"} unit="มม." note={wettest ? `${wettest.name}${wettest.amphoe ? ` อ.${wettest.amphoe}` : ""}` : "ยังไม่มีข้อมูล"} />
            {detailed ? (
              <MetricCard icon={CloudRainWind} tone={(top1h?.max_1h_mm ?? 0) >= HEAVY_RAIN_1H_MM ? "amber" : "blue"} label="ฝนแรงสุดใน 1 ชม." value={top1h?.max_1h_mm !== null && top1h?.max_1h_mm !== undefined ? fmt(top1h.max_1h_mm) : "–"} unit="มม."
                note={top1h?.max_1h_at ? `${top1h.name} · ${timeLabel(top1h.max_1h_at)}` : "ไม่มีฝนในช่วงนี้"} />
            ) : null}
            <MetricCard icon={Waves} tone={overBank.length ? "red" : "green"} label="สถานีที่เคยล้นตลิ่ง" value={overBank.length} unit={`/${waterStations.length}`} note={overBank.length ? overBank.slice(0, 2).map((s) => s.name).join(", ") : "ไม่มีสถานีล้นตลิ่งในช่วงนี้"} />
            {detailed ? (
              <MetricCard icon={TrendingUp} tone={(fastest?.max_rise?.rate ?? 0) >= 0.3 ? "amber" : "blue"} label="น้ำขึ้นเร็วสุด" value={fastest?.max_rise ? fmt(fastest.max_rise.rate, 2) : "–"} unit="ม./ชม."
                note={fastest?.max_rise ? `${fastest.name} · ${timeLabel(fastest.max_rise.t)}` : "ยังไม่มีข้อมูล"} />
            ) : null}
            <MetricCard icon={Waves} tone={sea.high_days ? "amber" : "blue"} label="น้ำทะเลสูงสุด" value={sea.peak ? fmt(sea.peak.level, 2) : "–"} unit="ม." note={sea.peak ? `${timeLabel(sea.peak.t)} · หนุนสูง ${sea.high_days || 0} วัน` : "ยังไม่มีข้อมูล"} />
          </MetricGrid>

          <Panel icon="map" title="แผนที่ฝนรายอำเภอและสถานีตรวจวัด" subtitle="สีอำเภอตามฝนในช่วงที่เลือก · กดอำเภอเพื่อดูเฉพาะอำเภอนั้น · กดหมุดเพื่อดูรายละเอียดสถานี" bodyClassName="p-4">
            <HydroStationsMap
              waterStations={waterStations} rainStations={allRainStations} districts={data.rain.by_district || []} dates={dates}
              selectedCode={station?.code} onSelectWater={selectWater} selectedDistrict={amphoe} onSelectDistrict={setAmphoe}
            />
          </Panel>

          <HydroRainSection rain={data.rain} dates={dates} amphoe={amphoe} onAmphoe={setAmphoe} detailed={detailed} />
          <HydroWaterSection ref={waterRef} stations={waterStations} station={station} onSelect={selectWater} rainByDistrict={data.rain.intensity?.by_district} bucket={bucket} detailed={detailed} />
          <HydroSeaSection sea={sea} bucket={bucket} detailed={detailed} />

          <p className="text-xs leading-5 text-slate-500">
            ที่มา: คลังข้อมูลน้ำแห่งชาติ (ThaiWater) สสน. · ระบบ CCTV ระดับน้ำ กรมป้องกันและบรรเทาสาธารณภัย · IOC Sea Level Monitoring · Open-Meteo Marine ·
            ค่าเป็นข้อมูลอัตโนมัติจากสถานี อาจมีค่าผิดพลาดหรือขาดช่วงเมื่อสถานีขัดข้อง
          </p>
        </>
      ) : null}
    </div>
  );
}
