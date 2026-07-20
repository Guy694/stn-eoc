import { NextResponse } from "next/server";
import crypto from "crypto";
import { applyNoStoreHeaders, getThaiIdConfigError, getThaiIdOAuthConfig, getThaiIdScope, getThaiIdVerifyType, resolveThaiIdCallbackUrl } from "@/lib/thaiIdConfig";

const OFFICER_CALLBACK_PATH = '/api/auth/thaiid/callback';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET(request) {
    try {
        // สร้าง state แบบสุ่มเพื่อป้องกัน CSRF attack
        const state = crypto.randomBytes(32).toString('hex');
        const config = getThaiIdOAuthConfig(request, OFFICER_CALLBACK_PATH);
        const configError = getThaiIdConfigError(config, { requireClientSecret: true });

        if (configError) {
            throw new Error(configError);
        }

        // ดึงประเภทผู้ใช้จาก query string (?type=officer หรือ ?type=citizen)
        const { searchParams } = new URL(request.url);
        const userType = searchParams.get('type') === 'citizen' ? 'citizen' : 'officer';

        // สร้าง Authorization URL สำหรับ ThaiID
        const authUrl = new URL(config.authorizeUrl);
        authUrl.searchParams.append('client_id', config.clientId);
        authUrl.searchParams.append('redirect_uri', config.redirectUri);
        authUrl.searchParams.append('scope', getThaiIdScope(userType)); // ✅ ใช้ type ที่ถูกต้อง
        authUrl.searchParams.append('verify_type', getThaiIdVerifyType());
        authUrl.searchParams.append('response_type', 'code');
        authUrl.searchParams.append('state', state);
        
        const response = NextResponse.redirect(authUrl.toString());
        response.cookies.set('thaiid_state', state, {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'lax',
            maxAge: 10 * 60,
            path: '/'
        });

        return applyNoStoreHeaders(response);

    } catch (error) {
        console.error('ThaiID Authorization Error:', error);
        const loginUrl = new URL(resolveThaiIdCallbackUrl(request, OFFICER_CALLBACK_PATH));
        loginUrl.pathname = loginUrl.pathname.replace(OFFICER_CALLBACK_PATH, '/login');
        loginUrl.search = `?error=callback_failed&message=${encodeURIComponent(error.message || 'เกิดข้อผิดพลาดในการเชื่อมต่อกับ ThaiID')}`;
        return applyNoStoreHeaders(NextResponse.redirect(loginUrl.toString()));
    }
}
