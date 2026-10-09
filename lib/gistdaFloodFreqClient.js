import { mkdir, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { compactFeature, summarizeFloodFreq, summarizeFloodFreqByTambon } from "@/lib/floodFreq";

// ดึงพื้นที่น้ำท่วมซ้ำซากของ จ.สตูล จาก GISTDA API Gateway (ต้องใช้ GISTDA_API_KEY ใน .env)
// ข้อมูลเป็นสถิติย้อนหลัง (อัปเดตปีละครั้ง) จึงดึงครั้งเดียวแล้วเก็บไว้ 7 วัน ทั้งในหน่วยความจำและไฟล์
// - ใช้ header "API-Key" (แบบ Bearer ตอบ INVALID_TOKEN)
// - endpoint resources/flood/flood-freq ตอบ 405/503 จึงใช้ resources/features/flood-freq ซึ่งเป็น OGC Features
const ENDPOINT = "https://api-gateway.gistda.or.th/api/2.0/resources/features/flood-freq";
const PROVINCE_ID = 91;
const PAGE_SIZE = 1000;
const MAX_PAGES = 20;
const CACHE_MS = 7 * 24 * 60 * 60 * 1000;
const CACHE_FILE = path.join(tmpdir(), "stn-eoc-flood-freq-91.json");
const CACHE_VERSION = 3; // 3: เพิ่มสรุปรายตำบล — เปลี่ยนเมื่อรูปแบบข้อมูลที่เก็บเปลี่ยน (เช่น ช่วงสี) เพื่อไม่ใช้ไฟล์แคชเก่า

let memory = null;
let inflight = null;

async function fetchPage(offset, key) {
  const url = `${ENDPOINT}?pv_idn=${PROVINCE_ID}&limit=${PAGE_SIZE}&offset=${offset}`;
  const response = await fetch(url, {
    headers: { "API-Key": key, Accept: "application/geo+json, application/json" },
    cache: "no-store",
    signal: AbortSignal.timeout(60 * 1000)
  });
  if (!response.ok) throw new Error(`GISTDA flood-freq HTTP ${response.status}`);
  const json = await response.json();
  if (!Array.isArray(json?.features)) throw new Error("GISTDA flood-freq: ไม่มี features");
  return json;
}

async function download(key) {
  const raw = [];
  let matched = null;
  for (let page = 0; page < MAX_PAGES; page += 1) {
    const json = await fetchPage(page * PAGE_SIZE, key);
    matched = Number(json.numberMatched) || matched;
    raw.push(...json.features);
    if (json.features.length < PAGE_SIZE || (matched && raw.length >= matched)) break;
  }
  // กันกรณี API ไม่กรองจังหวัด: เก็บเฉพาะของสตูล
  const satun = raw.filter((feature) => Number(feature?.properties?.pv_idn) === PROVINCE_ID);
  const features = satun.map((feature) => compactFeature(feature)).filter(Boolean);
  return {
    version: CACHE_VERSION,
    fetched_at: new Date().toISOString(),
    source_updated_at: satun.reduce((latest, feature) => {
      const value = feature?.properties?._updatedAt || "";
      return value > latest ? value : latest;
    }, "") || null,
    number_matched: matched,
    raw_count: satun.length,
    summary: summarizeFloodFreq(satun),
    tambon_summary: summarizeFloodFreqByTambon(satun),
    geojson: { type: "FeatureCollection", features }
  };
}

async function readDiskCache() {
  try {
    const cached = JSON.parse(await readFile(CACHE_FILE, "utf8"));
    if (cached?.version === CACHE_VERSION && Date.now() - Date.parse(cached.fetched_at) < CACHE_MS) return cached;
  } catch {
    // ยังไม่มีไฟล์ หรืออ่านไม่ได้ → ดึงใหม่
  }
  return null;
}

export async function getFloodFreqData() {
  if (memory && memory.version === CACHE_VERSION && Date.now() - Date.parse(memory.fetched_at) < CACHE_MS) return memory;
  const disk = await readDiskCache();
  if (disk) {
    memory = disk;
    return memory;
  }
  const key = process.env.GISTDA_API_KEY || "";
  if (!key) {
    const error = new Error("ยังไม่ได้ตั้งค่า GISTDA_API_KEY");
    error.code = "missing_api_key";
    throw error;
  }
  if (!inflight) {
    inflight = download(key)
      .then(async (data) => {
        memory = data;
        try {
          await mkdir(path.dirname(CACHE_FILE), { recursive: true });
          await writeFile(CACHE_FILE, JSON.stringify(data));
        } catch (error) {
          console.warn("[flood-freq] cannot write cache file:", error?.message);
        }
        return data;
      })
      .catch((error) => {
        // ดึงใหม่ไม่ได้ แต่มีของเก่าในหน่วยความจำ → ใช้ของเก่า
        if (memory) return memory;
        throw error;
      })
      .finally(() => { inflight = null; });
  }
  return inflight;
}
