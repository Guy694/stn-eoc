import { NextResponse } from 'next/server';
import { getCitizenSession, clearCitizenSession } from '@/lib/citizenAuth';

// GET - Check session
export async function GET() {
    try {
        const session = getCitizenSession();

        if (!session) {
            return NextResponse.json({ authenticated: false }, { status: 401 });
        }

        return NextResponse.json({
            authenticated: true,
            user: {
                firstName: session.firstName,
                lastName: session.lastName,
                pid: session.pid,
            }
        });
    } catch (error) {
        console.error('Session check error:', error);
        return NextResponse.json({ authenticated: false }, { status: 500 });
    }
}

// DELETE - Logout
export async function DELETE() {
    try {
        clearCitizenSession();
        return NextResponse.json({ success: true });
    } catch (error) {
        console.error('Logout error:', error);
        return NextResponse.json({ success: false }, { status: 500 });
    }
}
