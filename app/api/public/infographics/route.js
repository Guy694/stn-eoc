import { NextResponse } from 'next/server';
import { readdir } from 'fs/promises';
import path from 'path';

export async function GET(request) {
    try {
        const { searchParams } = new URL(request.url);
        const eocType = searchParams.get('eocType');

        if (!eocType || !['flood', 'drought', 'tsunami', 'earthquake', 'disease'].includes(eocType)) {
            return NextResponse.json({
                success: false,
                message: 'ประเภท EOC ไม่ถูกต้อง'
            }, { status: 400 });
        }

        const dirPath = path.join(process.cwd(), 'public', 'infographics', eocType);

        try {
            const fileList = await readdir(dirPath);
            // Filter and map to full paths
            const infographics = fileList
                .filter(file => /\.(jpg|jpeg|png)$/i.test(file))
                .sort()
                .map((file, index) => ({
                    id: index + 1,
                    image: `/infographics/${eocType}/${file}`,
                    alt: `Infographic ${index + 1} - ${eocType}`
                }));

            return NextResponse.json({
                success: true,
                data: infographics
            });
        } catch (error) {
            // Directory doesn't exist yet, return empty array
            return NextResponse.json({
                success: true,
                data: []
            });
        }

    } catch (error) {
        console.error('Get infographics error:', error);
        return NextResponse.json({
            success: false,
            message: 'เกิดข้อผิดพลาด: ' + error.message
        }, { status: 500 });
    }
}
