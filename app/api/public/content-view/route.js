import { NextResponse } from "next/server";
import { consumeRateLimit } from "@/lib/rateLimit";
import { getClientIp } from "@/lib/clientIp";
import { validateContentView } from "@/lib/contentViews";
import { recordContentView } from "@/lib/contentViewsServer";

// นับการเปิดดูสื่อความรู้ (riskcom) และอินโฟกราฟิกในหน้า "ประกาศและความรู้"
// POST { kind: 'riskcom'|'infographic', id, title } — 1 IP นับ 1 ครั้งต่อชิ้นต่อชั่วโมง · ตอบ 204 เสมอ
// (ประกาศของศูนย์ฯ นับที่ POST /api/public/announcements เหมือนเดิม)
export const dynamic = "force-dynamic";

export async function POST(request) {
  try {
    const body = await request.json().catch(() => ({}));
    const checked = validateContentView(body);
    if (!checked.value || checked.value.kind === "announcement") return new NextResponse(null, { status: 204 });
    const { kind, id } = checked.value;
    const limit = await consumeRateLimit("contentView", `${getClientIp(request)}:${kind}:${id}`, { store: "memory" });
    if (limit.allowed) await recordContentView(checked.value);
  } catch (error) {
    if (error?.code !== "ER_NO_SUCH_TABLE") console.error("Content view error:", error?.message || error);
  }
  return new NextResponse(null, { status: 204 });
}
