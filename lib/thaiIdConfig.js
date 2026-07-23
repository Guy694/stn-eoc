const DEFAULT_BASE_PATH = '/stn-eoc';
const THAIID_AUTHORIZE_URL = 'https://imauth.bora.dopa.go.th/api/v2/oauth2/auth/';
const THAIID_TOKEN_URL = 'https://imauth.bora.dopa.go.th/api/v2/oauth2/token/';
const THAIID_USERINFO_URL = 'https://imauth.bora.dopa.go.th/api/v2/oauth2/userinfo/';

function firstEnv(...keys) {
    for (const key of keys) {
        const value = process.env[key];
        if (value && value.trim()) return value.trim();
    }
    return '';
}

export function getAppBasePath() {
    const configured = process.env.NEXT_PUBLIC_BASE_PATH || DEFAULT_BASE_PATH;
    if (!configured || configured === '/') return '';
    return configured.startsWith('/') ? configured.replace(/\/$/, '') : `/${configured.replace(/\/$/, '')}`;
}

function getRequestOrigin(request) {
    const forwardedProto = request.headers.get('x-forwarded-proto')?.split(',')[0]?.trim();
    const forwardedHost = request.headers.get('x-forwarded-host')?.split(',')[0]?.trim();

    if (forwardedHost) {
        return `${forwardedProto || 'https'}://${forwardedHost}`;
    }

    const url = new URL(request.url);
    return url.origin;
}

function toAppCallbackPath(callbackPath) {
    const basePath = getAppBasePath();
    const normalizedCallbackPath = callbackPath.startsWith('/') ? callbackPath : `/${callbackPath}`;

    if (!basePath || normalizedCallbackPath.startsWith(`${basePath}/`)) {
        return normalizedCallbackPath;
    }

    return `${basePath}${normalizedCallbackPath}`;
}

export function resolveThaiIdCallbackUrl(request, callbackPath) {
    const configuredCallback = firstEnv(
        'THAIID_CALLBACK_URL',
        'THAIID_REDIRECT_URI',
        'CALLBACK'
    );
    const appCallbackPath = toAppCallbackPath(callbackPath);

    function normalizeCallbackPath(url) {
        const legacyPath = callbackPath.startsWith('/') ? callbackPath : `/${callbackPath}`;
        const basePath = getAppBasePath();
        const configuredPath = url.pathname.replace(/\/$/, '');
        const configuredPathWithoutBase = basePath && configuredPath.startsWith(`${basePath}/`)
            ? configuredPath.slice(basePath.length)
            : configuredPath;

        if (url.pathname === '/' || url.pathname === '') {
            url.pathname = appCallbackPath;
        } else if (configuredPathWithoutBase === legacyPath) {
            url.pathname = appCallbackPath;
        } else if (configuredPathWithoutBase.startsWith('/api/auth/')) {
            url.pathname = appCallbackPath;
        }

        url.search = '';
        url.hash = '';
        return url;
    }

    if (configuredCallback) {
        const url = new URL(configuredCallback, getRequestOrigin(request));
        return normalizeCallbackPath(url).toString();
    }

    const configuredBaseUrl = firstEnv('NEXT_PUBLIC_BASE_URL', 'NEXT_PUBLIC_API_URL');
    if (configuredBaseUrl) {
        const url = new URL(configuredBaseUrl);
        url.pathname = appCallbackPath;
        url.search = '';
        url.hash = '';
        return url.toString();
    }

    const url = new URL(getRequestOrigin(request));
    url.pathname = appCallbackPath;
    return url.toString();
}

export function getThaiIdAppBaseUrl(request) {
    const configuredUrl = firstEnv(
        'NEXT_PUBLIC_BASE_URL',
        'NEXT_PUBLIC_API_URL',
        'THAIID_CALLBACK_URL',
        'THAIID_REDIRECT_URI',
        'CALLBACK'
    );
    const basePath = getAppBasePath();
    const url = configuredUrl ? new URL(configuredUrl, getRequestOrigin(request)) : new URL(getRequestOrigin(request));

    return `${url.origin}${basePath}`;
}

export function getThaiIdOAuthConfig(request, callbackPath) {
    return {
        authorizeUrl: firstEnv('THAIID_AUTHORIZE_URL') || THAIID_AUTHORIZE_URL,
        tokenUrl: firstEnv('THAIID_TOKEN_URL') || THAIID_TOKEN_URL,
        userInfoUrl: firstEnv('THAIID_USERINFO_URL') || THAIID_USERINFO_URL,
        clientId: firstEnv('THAIID_CLIENT_ID', 'CLIENT_ID'),
        clientSecret: firstEnv('THAIID_CLIENT_SECRET', 'CLIENT_SECRET'),
        apiKey: firstEnv('THAIID_API_KEY', 'APIKEY'),
        redirectUri: resolveThaiIdCallbackUrl(request, callbackPath)
    };
}

export function getThaiIdScope(type = 'officer') {
    if (type === 'citizen') {
        return firstEnv('THAIID_CITIZEN_SCOPE', 'THAIID_SCOPE') || 'pid given_name family_name';
    }

    return firstEnv('THAIID_OFFICER_SCOPE', 'THAIID_SCOPE') || 'pid';
}

export function getThaiIdVerifyType() {
    return firstEnv('THAIID_VERIFY_TYPE') || 'pin';
}

export function getThaiIdConfigError(config, { requireClientSecret = false } = {}) {
    const missing = [];
    if (!config.clientId) missing.push('THAIID_CLIENT_ID หรือ CLIENT_ID');
    if (requireClientSecret && !config.clientSecret) missing.push('THAIID_CLIENT_SECRET หรือ CLIENT_SECRET');
    if (!config.redirectUri) missing.push('THAIID_CALLBACK_URL, THAIID_REDIRECT_URI, CALLBACK หรือ NEXT_PUBLIC_API_URL');

    return missing.length ? `ตั้งค่า ThaiD ไม่ครบ: ${missing.join(', ')}` : null;
}

export function applyNoStoreHeaders(response) {
    response.headers.set('Cache-Control', 'no-store, no-cache, max-age=0, must-revalidate');
    response.headers.set('Pragma', 'no-cache');
    response.headers.set('Expires', '0');
    return response;
}
