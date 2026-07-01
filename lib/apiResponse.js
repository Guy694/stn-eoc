import { NextResponse } from 'next/server';

export function errorMessage(error, fallback = 'เกิดข้อผิดพลาดภายในระบบ') {
    if (process.env.NODE_ENV === 'production') return fallback;
    return error?.message || fallback;
}

export function internalError(error, fallback = 'เกิดข้อผิดพลาดภายในระบบ', status = 500) {
    return NextResponse.json(
        { success: false, message: errorMessage(error, fallback) },
        { status }
    );
}

export function publicInternalError(fallback = 'เกิดข้อผิดพลาดภายในระบบ', status = 500) {
    return NextResponse.json(
        { success: false, message: fallback },
        { status }
    );
}
