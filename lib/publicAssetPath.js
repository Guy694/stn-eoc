const DEFAULT_BASE_PATH = '/stn-eoc';

export function getAppBasePath() {
    const basePath = process.env.NEXT_PUBLIC_BASE_PATH || DEFAULT_BASE_PATH;
    if (!basePath || basePath === '/') return '';
    return basePath.startsWith('/') ? basePath.replace(/\/$/, '') : `/${basePath.replace(/\/$/, '')}`;
}

export function getPublicAssetPath(assetPath) {
    if (!assetPath) return null;
    if (typeof assetPath !== 'string') return null;

    const trimmedPath = assetPath.trim();
    if (!trimmedPath) return null;
    if (trimmedPath.startsWith('http') || trimmedPath.startsWith('data:') || trimmedPath.startsWith('blob:')) {
        return trimmedPath;
    }

    const normalizedPath = trimmedPath.startsWith('/') ? trimmedPath : `/${trimmedPath}`;
    const basePath = getAppBasePath();

    if (!basePath || normalizedPath === basePath || normalizedPath.startsWith(`${basePath}/`)) {
        return normalizedPath;
    }

    return `${basePath}${normalizedPath}`;
}
