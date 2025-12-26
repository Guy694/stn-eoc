import { NextResponse } from "next/server";

// ThaiID OAuth Configuration - Production URLs ตามคู่มือ DOPA
const THAIID_CONFIG = {
    authUrl: 'https://imauth.bora.dopa.go.th/api/v2/oauth2/auth/',
    clientId: process.env.CLIENT_ID,
    redirectUri: process.env.CALLBACK,
    scope: 'pid given_name family_name name birthdate address gender', // ขอข้อมูลทั้งหมด
    responseType: 'code',
    state: null // จะสร้างแบบสุ่มเพื่อป้องกัน CSRF
};

export async function GET(request) {
    try {
        // สร้าง state แบบสุ่มเพื่อป้องกัน CSRF attack
        const state = Math.random().toString(36).substring(7) + Date.now();

        // สร้าง Authorization URL สำหรับ ThaiID
        const authUrl = new URL(THAIID_CONFIG.authUrl);
        authUrl.searchParams.append('client_id', THAIID_CONFIG.clientId);
        authUrl.searchParams.append('redirect_uri', THAIID_CONFIG.redirectUri);
        authUrl.searchParams.append('scope', THAIID_CONFIG.scope);
        authUrl.searchParams.append('response_type', THAIID_CONFIG.responseType);
        authUrl.searchParams.append('state', state);

        // Redirect ไป ThaiID Login Page
        return NextResponse.redirect(authUrl.toString());

    } catch (error) {
        console.error('ThaiID Authorization Error:', error);
        return NextResponse.json(
            {
                success: false,
                message: 'เกิดข้อผิดพลาดในการเชื่อมต่อกับ ThaiID',
                error: error.message
            },
            { status: 500 }
        );
    }
}
