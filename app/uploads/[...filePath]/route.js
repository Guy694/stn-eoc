import fs from 'fs/promises';
import path from 'path';
import { NextResponse } from 'next/server';
import { getUploadBaseDir, isSafeFilename, resolveInside } from '@/lib/fileUpload';

const CONTENT_TYPES = {
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.png': 'image/png',
    '.webp': 'image/webp',
    '.pdf': 'application/pdf'
};

const ALLOWED_ROOT_DIRS = new Set(['announcements', 'incidents', 'eoc-orders']);

function isSafeUploadPath(filePath) {
    return Array.isArray(filePath)
        && filePath.length >= 2
        && ALLOWED_ROOT_DIRS.has(filePath[0])
        && filePath.every((segment) => isSafeFilename(segment));
}

function normalizeUploadPath(filePath) {
    if (!Array.isArray(filePath)) return filePath;

    const normalized = [...filePath].filter(Boolean);

    if (normalized[0] === 'stn-eoc') {
        normalized.shift();
    }

    if (normalized[0] === 'uploads') {
        normalized.shift();
    }

    return normalized;
}

function getContentType(filePath) {
    const extension = path.extname(filePath).toLowerCase();
    return CONTENT_TYPES[extension] || 'application/octet-stream';
}

function buildFileResponse(body, absolutePath, extraHeaders = {}) {
    return new NextResponse(body, {
        headers: {
            'Content-Type': getContentType(absolutePath),
            'Cache-Control': 'public, max-age=31536000, immutable',
            ...extraHeaders
        }
    });
}

async function resolveUploadPath(paramsInput) {
    const params = await paramsInput;
    const { filePath } = params;
    const normalizedPath = normalizeUploadPath(filePath);

    if (!isSafeUploadPath(normalizedPath)) {
        return { error: NextResponse.json({ success: false, message: 'Invalid upload path' }, { status: 400 }) };
    }

    const uploadBaseDir = getUploadBaseDir();
    return { absolutePath: resolveInside(uploadBaseDir, ...normalizedPath) };
}

export async function GET(request, { params }) {
    try {
        const { absolutePath, error } = await resolveUploadPath(params);
        if (error) return error;

        const fileBuffer = await fs.readFile(absolutePath);
        return buildFileResponse(fileBuffer, absolutePath);
    } catch (error) {
        if (error?.code === 'ENOENT') {
            return NextResponse.json({ success: false, message: 'File not found' }, { status: 404 });
        }

        console.error('Upload file serving error:', error);
        return NextResponse.json({ success: false, message: 'Cannot read uploaded file' }, { status: 500 });
    }
}

export async function HEAD(request, { params }) {
    try {
        const { absolutePath, error } = await resolveUploadPath(params);
        if (error) return error;

        const stats = await fs.stat(absolutePath);
        return buildFileResponse(null, absolutePath, {
            'Content-Length': String(stats.size)
        });
    } catch (error) {
        if (error?.code === 'ENOENT') {
            return new NextResponse(null, {
                status: 404,
                headers: {
                    'Cache-Control': 'no-store'
                }
            });
        }

        console.error('Upload file head error:', error);
        return new NextResponse(null, {
            status: 500,
            headers: {
                'Cache-Control': 'no-store'
            }
        });
    }
}
