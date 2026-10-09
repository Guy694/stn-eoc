// รวบรวมข้อมูลสำคัญสาธารณะ (ใช้กับ offline pack และหน้าภาษาอังกฤษ) — ฝั่งเซิร์ฟเวอร์
import { query } from "@/lib/db";
import { buildOfflinePack } from "@/lib/offlinePack";
import { getPublicSituation } from "@/lib/publicSituation";
import { loadOpenShelters } from "@/lib/publicShelterData";
import { getSeaLevelPayload } from "@/lib/seaLevelClient";
import { getWeatherWatchPayload } from "@/lib/weatherWatch";

const optional = (promise) => promise.catch(() => null);

export async function getOfflinePack() {
  const [hotlines, shelters, weather, situation, sea] = await Promise.all([
    optional(query(`SELECT name, phone, status FROM agency_contacts WHERE is_active = 1 AND is_hotline = 1 ORDER BY sort_order, id LIMIT 12`)),
    optional(loadOpenShelters({})),
    optional(getWeatherWatchPayload()),
    optional(getPublicSituation()),
    optional(getSeaLevelPayload())
  ]);
  return buildOfflinePack({ hotlines, shelters: shelters?.data, warnings: weather?.weather_warnings, situation, sea, now: Date.now() });
}
