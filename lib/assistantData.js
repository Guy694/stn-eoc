import { query } from "@/lib/db";
import { getWeatherWatchPayload } from "@/lib/weatherWatch";
import { getSatunWaterLevels } from "@/lib/thaiWaterClient";
import { loadOpenShelters } from "@/lib/publicShelterData";
import { getOpenEocSessions } from "@/lib/eocOpen";
import { FACILITY_STATUS_SELECT, hasFacilityStatusColumns } from "@/lib/healthFacilityDb";

// ข้อมูลสดสำหรับผู้ช่วย EOC (แคช 3 นาที) — แต่ละแหล่งล่มได้โดยไม่ทำให้ผู้ช่วยตอบไม่ได้ทั้งหมด
const CACHE_MS = 3 * 60 * 1000;
let cache = null;
let inflight = null;

const EVENT_LABELS = { flood: "อุทกภัย (น้ำท่วม)", disease: "โรคระบาด", "festival-accidents": "อุบัติเหตุช่วงเทศกาล" };

async function safe(label, promise, fallback) {
  try {
    return await promise;
  } catch (error) {
    console.error(`assistant data ${label}:`, error?.message || error);
    return fallback;
  }
}

async function loadFacilities() {
  const withStatus = await hasFacilityStatusColumns();
  return query(
    `SELECT name, typecode, district_name ${withStatus ? `, ${FACILITY_STATUS_SELECT}` : ""}
     FROM health_facilities WHERE is_active = 1`
  );
}

async function build() {
  const [weather, water, shelters, facilities, sessions] = await Promise.all([
    safe("weather", getWeatherWatchPayload(), null),
    safe("water", getSatunWaterLevels(), null),
    safe("shelters", loadOpenShelters(), { open: false, data: [] }),
    safe("facilities", loadFacilities(), []),
    safe("sessions", getOpenEocSessions(), [])
  ]);
  const stations = water?.stations || [];
  return {
    now: Date.now(),
    districts: weather?.district_weather || [],
    warnings: weather?.weather_warnings || [],
    riverOutlook: weather?.river_outlook || [],
    waterStations: stations,
    waterObservedAt: stations.map((item) => item.observedAt).filter(Boolean).sort().pop() || null,
    shelters: shelters.data || [],
    sheltersOpen: Boolean(shelters.open),
    facilities,
    openEvents: sessions.map((session) => ({
      type: session.eoc_type,
      label: session.eoc_type === "disease" && session.disease_name ? `โรค${session.disease_name}` : EVENT_LABELS[session.eoc_type] || session.eoc_type
    }))
  };
}

export async function loadAssistantData() {
  if (cache && Date.now() - cache.at < CACHE_MS) return cache.value;
  if (!inflight) {
    inflight = build()
      .then((value) => {
        cache = { value, at: Date.now() };
        return value;
      })
      .finally(() => { inflight = null; });
  }
  return inflight;
}
