import { NextResponse } from 'next/server';
import { readdir } from 'fs/promises';
import path from 'path';
import { cookies } from 'next/headers';

export async function GET(request) {
    try {
        // Check authentication
        const cookieStore = cookies();
        const token = cookieStore.get('token');

        if (!token) {
            return NextResponse.json({
                success: false,
                message: 'ไม่ได้รับอนุญาต'
            }, { status: 401 });
        }

        const eocTypes = ['flood', 'drought', 'tsunami', 'earthquake', 'disease'];
        const files = {};

        for (const eocType of eocTypes) {
            const dirPath = path.join(process.cwd(), 'public', 'infographics', eocType);

            try {
                const fileList = await readdir(dirPath);
                // Filter only image files
                files[eocType] = fileList.filter(file =>
                    /\.(jpg|jpeg|png)$/i.test(file)
                ).sort();
            } catch (error) {
                // Directory doesn't exist yet
                files[eocType] = [];
            }
        }

        return NextResponse.json({
            success: true,
            files
        });

    } catch (error) {
        console.error('List files error:', error);
        return NextResponse.json({
            success: false,
            message: 'เกิดข้อผิดพลาด: ' + error.message
        }, { status: 500 });
    }
}
