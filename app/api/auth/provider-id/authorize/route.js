import { NextResponse } from "next/server";
import crypto from "crypto";
import { getAuthSession } from "@/lib/auth";
import { applyNoStoreHeaders } from "@/lib/thaiIdConfig";
import {
  PROVIDER_LINK_COOKIE, PROVIDER_STATE_COOKIE, appBaseUrl, buildHealthIdAuthorizeUrl, getProviderIdConfig, getProviderIdConfigError,
  shortLivedCookie, signLinkIntent
} from "@/lib/providerId";

export const dynamic = "force-dynamic";
export const revalidate = 0;

// เริ่มเข้าสู่ระบบด้วย Provider ID (ส่งต่อไปหน้า Health ID)
// ?link=1 = เจ้าหน้าที่ที่เข้าสู่ระบบอยู่ เชื่อมบัญชี Provider ID ของตัวเอง (จากหน้าโปรไฟล์)
export async function GET(request) {
  const base = appBaseUrl(request);
  const linking = new URL(request.url).searchParams.get("link") === "1";
  const back = (error, message) => applyNoStoreHeaders(NextResponse.redirect(
    `${base}${linking ? "/profile" : "/login"}?error=${error}&message=${encodeURIComponent(message)}`
  ));

  const config = getProviderIdConfig(request);
  const configError = getProviderIdConfigError(config);
  if (configError) return back("provider_config", configError);

  let officerId = null;
  if (linking) {
    // cookie session เป็น SameSite=strict จึงอ่านได้ที่นี่ (คำขอจากหน้าเว็บเดียวกัน) แต่ไม่ถูกส่งตอน Health ID redirect กลับ
    const auth = await getAuthSession(request);
    if (!auth.success) return applyNoStoreHeaders(NextResponse.redirect(`${base}/login`));
    officerId = auth.user.id;
  }

  const state = crypto.randomBytes(32).toString("hex");
  const response = NextResponse.redirect(buildHealthIdAuthorizeUrl(config, state));
  response.cookies.set(PROVIDER_STATE_COOKIE, state, shortLivedCookie(10 * 60));
  response.cookies.set(PROVIDER_LINK_COOKIE, officerId ? signLinkIntent(officerId, state) : "", shortLivedCookie(officerId ? 10 * 60 : 0));
  return applyNoStoreHeaders(response);
}
