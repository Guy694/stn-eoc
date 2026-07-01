import crypto from 'crypto';
import path from 'path';

export const DEFAULT_IMAGE_TYPES = new Map([
    ['image/jpeg', 'jpg'],
    ['image/jpg', 'jpg'],
    ['image/png', 'png'],
    ['image/webp', 'webp']
]);

export function createRandomFilename(extension, prefix = '') {
    const safePrefix = prefix ? `${prefix.replace(/[^a-zA-Z0-9_-]/g, '')}-` : '';
    return `${safePrefix}${Date.now()}-${crypto.randomBytes(12).toString('hex')}.${extension}`;
}

export function isSafeFilename(filename) {
    return typeof filename === 'string'
        && filename.length > 0
        && filename.length <= 180
        && !filename.startsWith('.')
        && /^[a-zA-Z0-9._-]+$/.test(filename)
        && !filename.includes('..');
}

export function resolveInside(baseDir, ...segments) {
    const resolvedBase = path.resolve(baseDir);
    const resolvedPath = path.resolve(resolvedBase, ...segments);

    if (resolvedPath !== resolvedBase && !resolvedPath.startsWith(`${resolvedBase}${path.sep}`)) {
        throw new Error('Invalid file path');
    }

    return resolvedPath;
}

export function hasValidImageSignature(buffer, mimeType) {
    if (!Buffer.isBuffer(buffer) || buffer.length < 12) return false;

    if (mimeType === 'image/png') {
        return buffer.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]));
    }

    if (mimeType === 'image/jpeg' || mimeType === 'image/jpg') {
        return buffer[0] === 0xFF && buffer[1] === 0xD8 && buffer[2] === 0xFF;
    }

    if (mimeType === 'image/webp') {
        return buffer.toString('ascii', 0, 4) === 'RIFF' && buffer.toString('ascii', 8, 12) === 'WEBP';
    }

    return false;
}

export async function validateImageFile(file, {
    maxSizeBytes,
    allowedTypes = DEFAULT_IMAGE_TYPES
}) {
    if (!file || typeof file.arrayBuffer !== 'function' || !file.size) {
        return { ok: false, error: 'ไม่มีไฟล์รูปภาพ' };
    }

    if (file.size > maxSizeBytes) {
        return { ok: false, error: `ไฟล์รูปภาพต้องมีขนาดไม่เกิน ${Math.floor(maxSizeBytes / 1024 / 1024)}MB` };
    }

    const extension = allowedTypes.get(file.type);
    if (!extension) {
        return { ok: false, error: 'รองรับเฉพาะไฟล์รูปภาพ JPG, PNG หรือ WebP' };
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    if (!hasValidImageSignature(buffer, file.type)) {
        return { ok: false, error: 'ไฟล์รูปภาพไม่ถูกต้องหรือชนิดไฟล์ไม่ตรงกับเนื้อหา' };
    }

    return { ok: true, buffer, extension };
}
