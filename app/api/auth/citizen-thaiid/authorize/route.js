import { NextResponse } from 'next/server';
import crypto from 'crypto';
import { applyNoStoreHeaders, getThaiIdAppBaseUrl, getThaiIdConfigError, getThaiIdOAuthConfig, getThaiIdScope, getThaiIdVerifyType } from '@/lib/thaiIdConfig';

const CITIZEN_CALLBACK_PATH = '/api/auth/citizen-thaiid/callback';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET(request) {
    try {
        // Generate state for CSRF protection
        const state = crypto.randomBytes(32).toString('hex');
        const config = getThaiIdOAuthConfig(request, CITIZEN_CALLBACK_PATH);
        const configError = getThaiIdConfigError(config);

        if (configError) {
            throw new Error(configError);
        }

        // Build authorization URL
        const params = new URLSearchParams({
            response_type: 'code',
            client_id: config.clientId,
            redirect_uri: config.redirectUri,
            scope: getThaiIdScope('citizen'),
            verify_type: getThaiIdVerifyType(),
            state: state,
        });

        const authorizeUrl = `${config.authorizeUrl}?${params.toString()}`;

        // Store state in cookie for verification
        const response = NextResponse.redirect(authorizeUrl);
        response.cookies.set('thaiid_state', state, {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'lax',
            maxAge: 600, // 10 minutes
            path: '/'
        });

        return applyNoStoreHeaders(response);
    } catch (error) {
        console.error('ThaiD authorize error:', error);
        return applyNoStoreHeaders(NextResponse.redirect(
            `${getThaiIdAppBaseUrl(request)}/public/report-incident?error=thaiid_auth_failed`
        ));
    }
}
