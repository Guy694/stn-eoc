import fs from 'fs/promises';
import path from 'path';
import { NextResponse } from 'next/server';
import { getPrivateUploadBaseDir, getUploadBaseDir, isSafeFilename, resolveInside } from '@/lib/fileUpload';
import { getAuthSession } from '@/lib/auth';
import { query } from '@/lib/db';

const CONTENT_TYPES = {
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.png': 'image/png',
    '.webp': 'image/webp',
    '.pdf': 'application/pdf'
};

const ALLOWED_ROOT_DIRS = new Set(['announcements', 'incidents', 'incidents-public', 'eoc-orders']);

// รูปต้นฉบับจากประชาชน: เฉพาะเจ้าหน้าที่ที่เข้าสู่ระบบ
const OFFICER_ONLY_DIRS = new Set(['incidents']);
// สำเนารูปที่เจ้าหน้าที่เลือกเผยแพร่: เปิดได้เฉพาะตอนที่เรื่องยังเผยแพร่อยู่
const PUBLISHED_ONLY_DIRS = new Set(['incidents-public']);

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

function cacheControlFor(root) {
    if (OFFICER_ONLY_DIRS.has(root)) return 'private, no-store';
    if (PUBLISHED_ONLY_DIRS.has(root)) return 'public, max-age=300';
    return 'public, max-age=31536000, immutable';
}

function buildFileResponse(body, absolutePath, root, extraHeaders = {}) {
    return new NextResponse(body, {
        headers: {
            'Content-Type': getContentType(absolutePath),
            'Cache-Control': cacheControlFor(root),
            'X-Content-Type-Options': 'nosniff',
            ...extraHeaders
        }
    });
}

function notFound() {
    return NextResponse.json({ success: false, message: 'File not found' }, { status: 404, headers: { 'Cache-Control': 'no-store' } });
}

async function isPublishedPhoto(relativePath) {
    try {
        const rows = await query(
            `SELECT id FROM public_incident_reports
             WHERE public_photo_path = ?
               AND publish_status = 'published'
               AND report_type IN ('traffic_report', 'problem_point')
               AND (expires_at IS NULL OR expires_at > NOW())
             LIMIT 1`,
            [relativePath]
        );
        return rows.length > 0;
    } catch {
        return false;
    }
}

async function authorize(request, normalizedPath) {
    const root = normalizedPath[0];
    if (OFFICER_ONLY_DIRS.has(root)) {
        const viewer = await getAuthSession(request).catch(() => ({ success: false }));
        return viewer.success;
    }
    if (PUBLISHED_ONLY_DIRS.has(root)) {
        return isPublishedPhoto(`/uploads/${normalizedPath.join('/')}`);
    }
    return true;
}

// รูปจากประชาชนเก็บนอก public (private/uploads) — ไฟล์เก่าที่ยังอยู่ใน public/uploads ยังเปิดได้ (ผ่านการตรวจสิทธิ์เดียวกัน)
async function findFile(normalizedPath) {
    const candidates = [];
    if (OFFICER_ONLY_DIRS.has(normalizedPath[0]) || PUBLISHED_ONLY_DIRS.has(normalizedPath[0])) {
        candidates.push(resolveInside(getPrivateUploadBaseDir(), ...normalizedPath));
    }
    candidates.push(resolveInside(getUploadBaseDir(), ...normalizedPath));

    for (const candidate of candidates) {
        try {
            const stats = await fs.stat(candidate);
            if (stats.isFile()) return { absolutePath: candidate, stats };
        } catch (error) {
            if (error?.code !== 'ENOENT') throw error;
        }
    }
    return null;
}

async function resolveRequest(request, paramsInput) {
    const params = await paramsInput;
    const normalizedPath = normalizeUploadPath(params.filePath);

    if (!isSafeUploadPath(normalizedPath)) {
        return { error: NextResponse.json({ success: false, message: 'Invalid upload path' }, { status: 400 }) };
    }

    // ไม่มีสิทธิ์ตอบ 404 เหมือนไม่มีไฟล์ เพื่อไม่บอกว่าไฟล์นั้นมีอยู่จริง
    if (!(await authorize(request, normalizedPath))) {
        return { error: notFound() };
    }

    const found = await findFile(normalizedPath);
    if (!found) return { error: notFound() };
    return { ...found, root: normalizedPath[0] };
}

export async function GET(request, { params }) {
    try {
        const { absolutePath, root, error } = await resolveRequest(request, params);
        if (error) return error;

        const fileBuffer = await fs.readFile(absolutePath);
        return buildFileResponse(fileBuffer, absolutePath, root);
    } catch (error) {
        console.error('Upload file serving error:', error);
        return NextResponse.json({ success: false, message: 'Cannot read uploaded file' }, { status: 500 });
    }
}

export async function HEAD(request, { params }) {
    try {
        const { absolutePath, root, stats, error } = await resolveRequest(request, params);
        if (error) return new NextResponse(null, { status: error.status, headers: { 'Cache-Control': 'no-store' } });

        return buildFileResponse(null, absolutePath, root, {
            'Content-Length': String(stats.size)
        });
    } catch (error) {
        console.error('Upload file head error:', error);
        return new NextResponse(null, {
            status: 500,
            headers: {
                'Cache-Control': 'no-store'
            }
        });
    }
}
