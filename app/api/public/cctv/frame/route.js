import { NextResponse } from "next/server";
import { consumeRateLimit } from "@/lib/rateLimit";
import { getClientIp } from "@/lib/clientIp";
import { isKnownCamera, upstreamFrameUrl } from "@/lib/ddpmCctv";

// ภาพนิ่งล่าสุดจากกล้อง CCTV ของ ปภ. (cctv.disaster.go.th) — GET ?cam=STN04-01
// แคช 1 นาที (ผู้ชมกี่คนก็ดึงจาก ปภ. ไม่เกินนาทีละครั้งต่อกล้อง) · ต้นทางล่ม/กล้องดับ → ใช้ภาพเดิมได้ไม่เกิน 15 นาที แล้วตอบ 503
export const dynamic = "force-dynamic";

const FRESH_MS = 60 * 1000;
const STALE_MS = 15 * 60 * 1000;
const cache = globalThis.__stnCctvCache || (globalThis.__stnCctvCache = new Map()); // cam → { at, body, type }
const inflight = new Map();

async function loadFrame(cam) {
  const response = await fetch(upstreamFrameUrl(cam), {
    headers: { Accept: "image/jpeg,image/*", "User-Agent": "Satun-Geo-EOC/1.0 (+flood monitoring)" },
    cache: "no-store",
    signal: AbortSignal.timeout(10000)
  });
  const type = response.headers.get("content-type") || "";
  if (!response.ok || !type.startsWith("image/")) throw new Error(`upstream ${response.status}`);
  const body = Buffer.from(await response.arrayBuffer());
  if (!body.length || body.length > 3 * 1024 * 1024) throw new Error("bad image size");
  const entry = { at: Date.now(), body, type };
  cache.set(cam, entry);
  return entry;
}

function image(entry, stale = false) {
  return new NextResponse(entry.body, {
    headers: {
      "Content-Type": entry.type,
      "Cache-Control": stale ? "no-store" : "public, max-age=60",
      "X-Frame-Taken": new Date(entry.at).toISOString(),
      ...(stale ? { "X-Frame-Stale": "1" } : {})
    }
  });
}

export async function GET(request) {
  const cam = new URL(request.url).searchParams.get("cam");
  if (!isKnownCamera(cam)) return NextResponse.json({ success: false, message: "ไม่พบกล้องนี้" }, { status: 404 });
  const limit = await consumeRateLimit("cctvFrame", getClientIp(request), { store: "memory" });
  if (!limit.allowed) return NextResponse.json({ success: false, message: "เรียกดูถี่เกินไป" }, { status: 429 });

  const hit = cache.get(cam);
  if (hit && Date.now() - hit.at < FRESH_MS) return image(hit);
  try {
    if (!inflight.has(cam)) inflight.set(cam, loadFrame(cam).finally(() => inflight.delete(cam)));
    return image(await inflight.get(cam));
  } catch {
    if (hit && Date.now() - hit.at < STALE_MS) return image(hit, true);
    return NextResponse.json({ success: false, message: "กล้องนี้ไม่มีภาพขณะนี้" }, { status: 503, headers: { "Cache-Control": "no-store" } });
  }
}
