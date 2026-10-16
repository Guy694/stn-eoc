import { NextResponse } from "next/server";
import { createUserSession, setSessionCookie } from "@/lib/auth";
import { clearCitizenSessionCookie } from "@/lib/citizenAuth";
import { clearRegistrationSessionCookie } from "@/lib/registrationSession";
import { getClientIp, getUserAgent } from "@/lib/clientIp";
import { getPool } from "@/lib/db";
import { notifySecurityEvent } from "@/lib/telegram";
import { applyNoStoreHeaders } from "@/lib/thaiIdConfig";
import {
  PROVIDER_LINK_COOKIE, PROVIDER_STATE_COOKIE, ProviderIdError, appBaseUrl, exchangeHealthIdCode, fetchProviderProfile, getProviderIdConfig,
  getProviderIdConfigError, normalizeProviderProfile, requestProviderToken, shortLivedCookie, verifyLinkIntent
} from "@/lib/providerId";
import { resolveProviderLogin } from "@/lib/providerIdLogin";

export const dynamic = "force-dynamic";
export const revalidate = 0;

function clearFlowCookies(response) {
  response.cookies.set(PROVIDER_STATE_COOKIE, "", shortLivedCookie(0));
  response.cookies.set(PROVIDER_LINK_COOKIE, "", shortLivedCookie(0));
  return applyNoStoreHeaders(response);
}

// Health ID redirect กลับมาพร้อม code → ขอ token Health ID → token Provider ID → ข้อมูลบุคลากร → เข้าสู่ระบบ/เชื่อมบัญชี
export async function GET(request) {
  const base = appBaseUrl(request);
  const params = new URL(request.url).searchParams;
  const state = params.get("state");
  const storedState = request.cookies.get(PROVIDER_STATE_COOKIE)?.value;
  const linkOfficerId = verifyLinkIntent(request.cookies.get(PROVIDER_LINK_COOKIE)?.value, storedState);
  const page = linkOfficerId ? "/profile" : "/login";
  const fail = (error, message) => clearFlowCookies(NextResponse.redirect(`${base}${page}?error=${error}&message=${encodeURIComponent(message)}`));

  if (!state || !storedState || state !== storedState) {
    void notifySecurityEvent("provider_id_oauth_state_mismatch", { ip: getClientIp(request), hasState: Boolean(state), hasStoredState: Boolean(storedState) });
    return fail("provider_failed", "รหัสตรวจสอบการเข้าสู่ระบบไม่ตรงกัน กรุณาเริ่มใหม่อีกครั้ง");
  }
  const code = params.get("code");
  if (!code) return fail("provider_failed", "ไม่ได้รับรหัสยืนยันจาก Health ID");

  const config = getProviderIdConfig(request);
  const configError = getProviderIdConfigError(config);
  if (configError) return fail("provider_config", configError);

  let profile;
  try {
    const healthToken = await exchangeHealthIdCode(config, code);
    const providerToken = await requestProviderToken(config, healthToken);
    profile = normalizeProviderProfile(await fetchProviderProfile(config, providerToken));
  } catch (error) {
    if (error instanceof ProviderIdError) {
      console.warn("[provider-id]", error.code, error.status || "", error.message);
      return fail(error.code === "no_provider" ? "provider_none" : "provider_failed", error.message);
    }
    console.error("Provider ID callback error:", error);
    return fail("provider_failed", "เข้าสู่ระบบด้วย Provider ID ไม่สำเร็จ");
  }

  const connection = await getPool().getConnection();
  try {
    const execute = (sql, values) => connection.execute(sql, values);
    const outcome = await resolveProviderLogin(execute, profile, { linkOfficerId });
    if (outcome.kind === "error") return fail(outcome.code, outcome.message);

    const officer = outcome.officer;
    await connection.execute(
      `INSERT INTO activity_logs (user_id, action_type, details, ip_address, user_agent, timestamp) VALUES (?, ?, ?, ?, ?, NOW())`,
      [officer.id, outcome.kind === "linked" ? "UPDATE" : "LOGIN",
        outcome.kind === "linked" ? `เชื่อมบัญชี Provider ID - User: ${officer.username}` : `เข้าสู่ระบบด้วย Provider ID สำเร็จ - User: ${officer.username}`,
        getClientIp(request), getUserAgent(request)]
    ).catch((error) => console.error("Failed to log activity:", error?.message));

    if (outcome.kind === "linked") {
      return clearFlowCookies(NextResponse.redirect(`${base}/profile?provider=linked`));
    }
    if (Number(officer.is_approved) !== 1) {
      return clearFlowCookies(NextResponse.redirect(`${base}/login?error=provider_pending&message=${encodeURIComponent("บัญชีเจ้าหน้าที่ของคุณยังรอผู้ดูแลระบบอนุมัติ")}`));
    }

    const response = NextResponse.redirect(`${base}/dashboard`);
    const { token } = await createUserSession(execute, {
      officer, ipAddress: getClientIp(request), userAgent: getUserAgent(request), loginMethod: "provider_id"
    });
    setSessionCookie(response, token);
    clearRegistrationSessionCookie(response);
    clearCitizenSessionCookie(response);
    return clearFlowCookies(response);
  } catch (error) {
    console.error("Provider ID login error:", error);
    return fail("provider_failed", error?.code === "ER_BAD_FIELD_ERROR" ? "ยังไม่ได้รัน migration ของ Provider ID (20261016_provider_id_login.sql)" : "เข้าสู่ระบบด้วย Provider ID ไม่สำเร็จ");
  } finally {
    connection.release();
  }
}
