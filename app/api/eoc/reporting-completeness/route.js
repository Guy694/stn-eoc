import { NextResponse } from "next/server";
import { query } from "@/lib/db";
import { OFFICER_ROLES, requireAuth } from "@/lib/auth";
import { publicInternalError } from "@/lib/apiResponse";
import { toDateKey } from "@/lib/sessionDateRange";
import { COMPLETENESS_SOURCES, buildCompleteness, buildReminderText } from "@/lib/reportingCompleteness";
import { escapeTelegramHtml, getTelegramHelpNotifyChatIds } from "@/lib/telegram";
import { sendCategorized } from "@/lib/telegramChannels";
import { recordChange } from "@/lib/recordArchive";

async function load(searchParams) {
  const eocType = searchParams.get("eoc");
  const source = COMPLETENESS_SOURCES[eocType];
  if (!source) return { error: NextResponse.json({ success: false, message: "ประเภท EOC ไม่ถูกต้อง" }, { status: 400 }) };

  const sessionId = searchParams.get("session_id");
  const sessions = await query(
    sessionId
      ? `SELECT id, session_number, status, opened_at, closed_at FROM eoc_sessions WHERE id = ? AND eoc_type = ? LIMIT 1`
      : `SELECT id, session_number, status, opened_at, closed_at FROM eoc_sessions WHERE eoc_type = ? AND status = 'active' ORDER BY opened_at DESC LIMIT 1`,
    sessionId ? [sessionId, eocType] : [eocType]
  );
  if (!sessions.length) return { session: null, source, eocType };

  const date = toDateKey(searchParams.get("date")) || toDateKey(new Date());
  const [areas, reported] = await Promise.all([
    query(`SELECT DISTINCT distname AS district, subdistnam AS tambon FROM satun_village_polygon WHERE distname IS NOT NULL AND subdistnam IS NOT NULL`),
    query(source.sql, [sessions[0].id, date])
  ]);
  return { session: sessions[0], source, eocType, date, summary: buildCompleteness(areas, reported) };
}

export async function GET(request) {
  try {
    const auth = await requireAuth(request, OFFICER_ROLES);
    if (!auth.success) return auth.response;
    const result = await load(new URL(request.url).searchParams);
    if (result.error) return result.error;
    if (!result.session) return NextResponse.json({ success: true, session: null, message: `ยังไม่มีเหตุการณ์ EOC ${result.source.label}ที่เปิดอยู่` });
    return NextResponse.json({
      success: true,
      session: result.session,
      date: result.date,
      records_path: result.source.recordsPath,
      telegram_ready: Boolean(process.env.TELEGRAM_BOT_TOKEN && getTelegramHelpNotifyChatIds().length),
      ...result.summary
    });
  } catch (error) {
    console.error("Reporting completeness error:", error);
    return publicInternalError("ไม่สามารถตรวจความครบของรายงานได้");
  }
}

// ส่งรายชื่อตำบลที่ยังไม่ส่งรายงานไปกลุ่ม Telegram ของศูนย์ (ผู้ดูแลระบบ/ผู้บัญชาการ)
export async function POST(request) {
  try {
    const auth = await requireAuth(request, ["admin", "commander"]);
    if (!auth.success) return auth.response;
    const result = await load(new URL(request.url).searchParams);
    if (result.error) return result.error;
    if (!result.session) return NextResponse.json({ success: false, message: "ยังไม่มีเหตุการณ์ที่เปิดอยู่" }, { status: 404 });

    const chatIds = getTelegramHelpNotifyChatIds();
    if (!process.env.TELEGRAM_BOT_TOKEN || !chatIds.length) {
      return NextResponse.json({ success: false, message: "ยังไม่ได้ตั้งค่า Telegram ของศูนย์ (TELEGRAM_BOT_TOKEN และ TELEGRAM_NOTIFY_CHAT_IDS)" }, { status: 409 });
    }
    const [y, m, d] = result.date.split("-").map(Number);
    const text = buildReminderText({
      label: result.source.label,
      sessionNumber: result.session.session_number,
      dateLabel: new Date(y, m - 1, d).toLocaleDateString("th-TH", { day: "numeric", month: "long", year: "numeric" }),
      summary: result.summary,
      escape: escapeTelegramHtml
    });
    const okCount = (await sendCategorized("report", text)).delivered;
    await recordChange({
      request, user: auth.user, action: "data_update", table: "eoc_sessions", id: result.session.id,
      description: `ส่งแจ้งเตือนความครบของรายงาน${result.source.label} วันที่ ${result.date} (${okCount}/${chatIds.length} กลุ่ม)`,
      sessionId: result.session.id
    }).catch(() => {});
    if (!okCount) return NextResponse.json({ success: false, message: "ส่งข้อความ Telegram ไม่สำเร็จ" }, { status: 502 });
    return NextResponse.json({ success: true, message: `ส่งแจ้งเตือนแล้ว ${okCount} กลุ่ม` });
  } catch (error) {
    console.error("Reporting reminder error:", error);
    return publicInternalError("ไม่สามารถส่งแจ้งเตือนได้");
  }
}
