import { NextResponse } from 'next/server';
import { setCitizenSessionCookie } from '@/lib/citizenAuth';

const THAIID_CONFIG = {
    tokenUrl: 'https://imauth.bora.dopa.go.th/api/v2/oauth2/token/',
    userInfoUrl: 'https://imauth.bora.dopa.go.th/api/v2/oauth2/userinfo/',
    clientId: process.env.THAIID_CLIENT_ID,
    apiKey: process.env.THAIID_API_KEY,
    redirectUri: process.env.NEXT_PUBLIC_BASE_URL + '/stn-eoc/api/auth/citizen-thaiid/callback',
};

export async function GET(request) {
    try {
        const { searchParams } = new URL(request.url);
        const code = searchParams.get('code');
        const state = searchParams.get('state');
        const error = searchParams.get('error');

        // Check for errors from ThaiID
        if (error) {
            console.error('ThaiID error:', error);
            return NextResponse.redirect(
                new URL('/public/report-incident?error=thaiid_denied', request.url)
            );
        }

        // Verify state
        const storedState = request.cookies.get('thaiid_state')?.value;
        if (!state || state !== storedState) {
            return NextResponse.redirect(
                new URL('/public/report-incident?error=invalid_state', request.url)
            );
        }

        if (!code) {
            return NextResponse.redirect(
                new URL('/public/report-incident?error=no_code', request.url)
            );
        }

        // Exchange code for token
        const tokenResponse = await fetch(THAIID_CONFIG.tokenUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
                'API_KEY': THAIID_CONFIG.apiKey,
            },
            body: new URLSearchParams({
                grant_type: 'authorization_code',
                code: code,
                redirect_uri: THAIID_CONFIG.redirectUri,
                client_id: THAIID_CONFIG.clientId,
            }),
        });

        if (!tokenResponse.ok) {
            throw new Error('Failed to get token from ThaiID');
        }

        const tokenData = await tokenResponse.json();
        const accessToken = tokenData.access_token;

        // Get user info
        const userInfoResponse = await fetch(THAIID_CONFIG.userInfoUrl, {
            headers: {
                'Authorization': `Bearer ${accessToken}`,
                'API_KEY': THAIID_CONFIG.apiKey,
            },
        });

        if (!userInfoResponse.ok) {
            throw new Error('Failed to get user info from ThaiID');
        }

        const userInfo = await userInfoResponse.json();

        // Redirect back to report form
        const response = NextResponse.redirect(
            new URL('/public/report-incident?thaiid=success', request.url)
        );

        // Create citizen session
        setCitizenSessionCookie(response, {
            pid: userInfo.sub, // National ID
            given_name: userInfo.given_name,
            family_name: userInfo.family_name,
        });

        // Clear state cookie
        response.cookies.delete('thaiid_state');

        return response;
    } catch (error) {
        console.error('ThaiID callback error:', error);
        return NextResponse.redirect(
            new URL('/public/report-incident?error=thaiid_callback_failed', request.url)
        );
    }
}
