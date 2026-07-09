import { NextResponse } from 'next/server';
import { setCitizenSessionCookie } from '@/lib/citizenAuth';
import { applyNoStoreHeaders, getThaiIdAppBaseUrl, getThaiIdConfigError, getThaiIdOAuthConfig } from '@/lib/thaiIdConfig';

const CITIZEN_CALLBACK_PATH = '/api/auth/citizen-thaiid/callback';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

function reportIncidentUrl(request, queryString = '') {
    return `${getThaiIdAppBaseUrl(request)}/public/report-incident${queryString}`;
}

export async function GET(request) {
    try {
        const { searchParams } = new URL(request.url);
        const code = searchParams.get('code');
        const state = searchParams.get('state');
        const error = searchParams.get('error');
        const config = getThaiIdOAuthConfig(request, CITIZEN_CALLBACK_PATH);
        const configError = getThaiIdConfigError(config);

        if (configError) {
            throw new Error(configError);
        }

        // Check for errors from ThaiID
        if (error) {
            console.error('ThaiID error:', error);
            return applyNoStoreHeaders(NextResponse.redirect(
                reportIncidentUrl(request, '?error=thaiid_denied')
            ));
        }

        // Verify state
        const storedState = request.cookies.get('thaiid_state')?.value;
        if (!state || state !== storedState) {
            return applyNoStoreHeaders(NextResponse.redirect(
                reportIncidentUrl(request, '?error=invalid_state')
            ));
        }

        if (!code) {
            return applyNoStoreHeaders(NextResponse.redirect(
                reportIncidentUrl(request, '?error=no_code')
            ));
        }

        // Exchange code for token
        const tokenBody = new URLSearchParams({
            grant_type: 'authorization_code',
            code: code,
            redirect_uri: config.redirectUri,
            client_id: config.clientId,
        });

        if (config.clientSecret) {
            tokenBody.set('client_secret', config.clientSecret);
        }

        const tokenResponse = await fetch(config.tokenUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
                'API_KEY': config.apiKey,
            },
            body: tokenBody,
        });

        if (!tokenResponse.ok) {
            throw new Error('Failed to get token from ThaiID');
        }

        const tokenData = await tokenResponse.json();
        const accessToken = tokenData.access_token;

        // Get user info
        const userInfoResponse = await fetch(config.userInfoUrl, {
            headers: {
                'Authorization': `Bearer ${accessToken}`,
                'API_KEY': config.apiKey,
            },
        });

        if (!userInfoResponse.ok) {
            throw new Error('Failed to get user info from ThaiID');
        }

        const userInfo = await userInfoResponse.json();

        // Redirect back to report form
        const response = NextResponse.redirect(
            reportIncidentUrl(request, '?thaiid=success')
        );

        // Create citizen session
        setCitizenSessionCookie(response, {
            pid: userInfo.pid || userInfo.sub, // National ID
            given_name: userInfo.given_name,
            family_name: userInfo.family_name,
        });

        // Clear state cookie
        response.cookies.delete('thaiid_state');

        return applyNoStoreHeaders(response);
    } catch (error) {
        console.error('ThaiID callback error:', error);
        return applyNoStoreHeaders(NextResponse.redirect(
            reportIncidentUrl(request, '?error=thaiid_callback_failed')
        ));
    }
}
