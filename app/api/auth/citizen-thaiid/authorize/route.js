import { NextResponse } from 'next/server';
import crypto from 'crypto';

const THAIID_CONFIG = {
    authorizeUrl: 'https://imauth.bora.dopa.go.th/api/v2/oauth2/auth/',
    clientId: process.env.THAIID_CLIENT_ID,
    redirectUri: process.env.NEXT_PUBLIC_BASE_URL + '/stn-eoc/api/auth/citizen-thaiid/callback',
    scope: 'pid given_name family_name',
};

export async function GET(request) {
    try {
        // Generate state for CSRF protection
        const state = crypto.randomBytes(32).toString('hex');

        // Build authorization URL
        const params = new URLSearchParams({
            response_type: 'code',
            client_id: THAIID_CONFIG.clientId,
            redirect_uri: THAIID_CONFIG.redirectUri,
            scope: THAIID_CONFIG.scope,
            state: state,
        });

        const authorizeUrl = `${THAIID_CONFIG.authorizeUrl}?${params.toString()}`;

        // Store state in cookie for verification
        const response = NextResponse.redirect(authorizeUrl);
        response.cookies.set('thaiid_state', state, {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'lax',
            maxAge: 600, // 10 minutes
            path: '/'
        });

        return response;
    } catch (error) {
        console.error('ThaiID authorize error:', error);
        return NextResponse.redirect(
            new URL('/public/report-incident?error=thaiid_auth_failed', request.url)
        );
    }
}
