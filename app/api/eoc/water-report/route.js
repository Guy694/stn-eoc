import { NextResponse } from "next/server";
import { OFFICER_ROLES, requireAuth } from "@/lib/auth";
import { publicInternalError } from "@/lib/apiResponse";
import { DPM_SOURCE, DPM_URL, bangkokHourKey, buildWaterReport, shiftHourKey, thaiHourLabel, withKnownStations, SATUN_STATIONS } from "@/lib/dpmWater";
import { getDpmWaterLevels, listDpmHours, listKnownDpmStations, loadDpmBaseline } from "@/lib/dpmWaterServer";
import { resolveEventSession } from "@/lib/eocBriefData";
import { loadCurrentTriggers } from "@/lib/areaTriggersServer";
import { areaLabel, highestFlag, stageTitle } from "@/lib/floodTriggers";

// ธง/Trigger ที่ประกาศอยู่ในเหตุการณ์อุทกภัยที่เปิดอยู่ (ถ้ามี) — รายงานใช้ธงที่ประกาศแทนธงที่ระบบเสนอ
async function loadDeclared() {
  try {
    const session = await resolveEventSession({ eocType: "flood" });
    if (!session || session.status !== "active") return null;
    const current = ((await loadCurrentTriggers(session.id)) || []).filter((row) => row.stage);
    if (!current.length) return null;
    return {
      flag: highestFlag(current),
      areas: current.map((row) => ({ area: areaLabel(row), stage: row.stage, title: stageTitle(row.stage), declared_at: row.declared_at }))
    };
  } catch (error) {
    console.warn("Water report declared flags:", error.message);
    return null;
  }
}

// รายงานระดับน้ำสถานีเฝ้าระวัง (ปภ.) แบบ A4
// GET ?compare=YYYY-MM-DD HH:00:00  เทียบกับค่าที่เก็บไว้ ณ ชั่วโมงนั้น (ค่าเริ่มต้น 4 ชม.ก่อนเวลาข้อมูล)
// GET ?compare=prev                 เทียบชั่วโมงก่อนหน้าตามต้นทาง
const HOUR_PATTERN = /^\d{4}-\d{2}-\d{2} \d{2}:00:00$/;

export async function GET(request) {
  const auth = await requireAuth(request, OFFICER_ROLES);
  if (!auth.success) return auth.response;
  const params = new URL(request.url).searchParams;
  try {
    let source;
    try {
      source = await getDpmWaterLevels({ force: params.get("refresh") === "1" });
    } catch (error) {
      console.error("DPM water fetch error:", error.message);
      return NextResponse.json({ success: false, message: "ยังดึงข้อมูลระดับน้ำจาก ปภ. ไม่ได้ในขณะนี้ ลองใหม่อีกครั้ง", source: DPM_SOURCE, sourceUrl: DPM_URL }, { status: 503 });
    }
    const latestObserved = source.stations.map((station) => station.observedAt).filter(Boolean).sort().pop();
    const dataHour = bangkokHourKey(latestObserved || source.fetchedAt);

    const requested = String(params.get("compare") || "").trim();
    let compareHour = requested === "prev" ? null : HOUR_PATTERN.test(requested) ? requested : shiftHourKey(dataHour, -4);
    let baseline = null;
    let hours = [];
    let historyReady = true;
    const prefix = (process.env.DPM_WATER_PREFIX || "STN").toUpperCase();
    let stations = withKnownStations(source.stations, prefix === "STN" ? SATUN_STATIONS : []);
    try {
      stations = withKnownStations(source.stations, [...(await listKnownDpmStations()), ...(prefix === "STN" ? SATUN_STATIONS : [])]);
      hours = await listDpmHours(dataHour);
      if (compareHour) baseline = await loadDpmBaseline(compareHour);
    } catch (error) {
      if (error?.code !== "ER_NO_SUCH_TABLE") throw error;
      historyReady = false;
    }
    if (!baseline || !Object.keys(baseline).length) compareHour = null;
    const compareLabel = compareHour ? thaiHourLabel(compareHour).time : "";

    // คอลัมน์เวลาเพิ่มเติมของตาราง (แบบ 4 หัวข้อ): ค่าเริ่มต้น 6 ชม.ก่อนเวลาที่เทียบ
    const earlyRequested = String(params.get("early") || "").trim();
    const earlyHour = HOUR_PATTERN.test(earlyRequested) ? earlyRequested : shiftHourKey(compareHour || shiftHourKey(dataHour, -4), -6);
    let earlyLevels = null;
    if (historyReady) earlyLevels = await loadDpmBaseline(earlyHour).catch(() => null);
    const columns = [
      earlyLevels && Object.keys(earlyLevels).length ? { hour: earlyHour, label: thaiHourLabel(earlyHour).time, levels: earlyLevels } : null,
      compareHour ? { hour: compareHour, label: compareLabel, levels: baseline } : null
    ].filter(Boolean);

    const report = buildWaterReport(stations, { baseline, compareLabel, dataHour });
    return NextResponse.json({
      success: true,
      report,
      declared: await loadDeclared(),
      compare: compareHour || "prev",
      columns,
      early: earlyHour,
      requested_compare: requested || null,
      hours,
      history_ready: historyReady,
      fetched_at: new Date(source.fetchedAt).toISOString(),
      stale: source.stale,
      from_database: Boolean(source.fromDatabase),
      source: DPM_SOURCE,
      source_url: DPM_URL
    });
  } catch (error) {
    console.error("Water report error:", error);
    return publicInternalError("สร้างรายงานระดับน้ำไม่สำเร็จ");
  }
}
