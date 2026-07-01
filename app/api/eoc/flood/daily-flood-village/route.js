import { NextResponse } from 'next/server';
import { publicInternalError } from '@/lib/apiResponse';

// ข้อมูลจำลองสำหรับทดสอบ (ใช้จนกว่าจะมีตาราง daily_village_flood_status)
const mockFloodData = {
    '2025-12-01': [
        { villcode: '9101010701', level: 'severe' },
        { villcode: '9101010702', level: 'severe' },
        { villcode: '9101010801', level: 'moderate' },
        { villcode: '9101011001', level: 'moderate' },
        { villcode: '9101011101', level: 'mild' },
        { villcode: '9101011201', level: 'mild' },
        { villcode: '9101020101', level: 'severe' },
        { villcode: '9101020201', level: 'moderate' },
    ],
    '2025-12-02': [
        { villcode: '9101010701', level: 'severe' },
        { villcode: '9101010702', level: 'moderate' },
        { villcode: '9101010801', level: 'moderate' },
        { villcode: '9101011001', level: 'mild' },
        { villcode: '9101011101', level: 'mild' },
    ],
    '2025-12-03': [
        { villcode: '9101010701', level: 'moderate' },
        { villcode: '9101010702', level: 'moderate' },
        { villcode: '9101010801', level: 'mild' },
        { villcode: '9101011001', level: 'mild' },
    ],
    '2025-12-11': [
        { villcode: '9101010701', level: 'mild' },
        { villcode: '9101010702', level: 'mild' },
    ]
};

// ข้อมูลหมู่บ้านจำลอง
const mockVillages = [
    { villcode: '9101010701', name: 'บ้านควนสตอ', district: 'เมืองสตูล', population: 450 },
    { villcode: '9101010702', name: 'บ้านคลองขุด', district: 'เมืองสตูล', population: 380 },
    { villcode: '9101010801', name: 'บ้านปูยู', district: 'เมืองสตูล', population: 520 },
    { villcode: '9101011001', name: 'บ้านควนโพธิ์', district: 'เมืองสตูล', population: 310 },
    { villcode: '9101011101', name: 'บ้านท่าเสม็ด', district: 'เมืองสตูล', population: 290 },
    { villcode: '9101011201', name: 'บ้านควนสตาร์', district: 'เมืองสตูล', population: 410 },
    { villcode: '9101020101', name: 'บ้านควนขัน', district: 'เมืองสตูล', population: 350 },
    { villcode: '9101020201', name: 'บ้านทุ่งนุ้ย', district: 'เมืองสตูล', population: 280 },
];

// API สำหรับดึงข้อมูลพื้นที่น้ำท่วมรายวัน (ระดับหมู่บ้าน)
export async function GET(request) {
    try {
        const { searchParams } = new URL(request.url);
        const dateParam = searchParams.get('date');

        if (!dateParam) {
            return NextResponse.json(
                { error: 'Date parameter is required' },
                { status: 400 }
            );
        }

        // ใช้ข้อมูลจำลอง
        const floodData = mockFloodData[dateParam] || [];
        const floodDataMap = {};
        floodData.forEach(f => {
            floodDataMap[f.villcode] = f.level;
        });

        // รวมข้อมูลน้ำท่วม
        const result = mockVillages.map(v => ({
            villcode: v.villcode,
            name: v.name,
            district: v.district,
            level: floodDataMap[v.villcode] || 'safe',
            population: v.population || 0
        }));

        // คำนวณสถิติสรุป
        const summary = {
            totalAffected: 0,
            severeCount: 0,
            moderateCount: 0,
            mildCount: 0,
            totalPopulation: 0
        };

        result.forEach(v => {
            if (v.level !== 'safe') {
                summary.totalAffected++;
                summary.totalPopulation += v.population;

                if (v.level === 'severe') summary.severeCount++;
                else if (v.level === 'moderate') summary.moderateCount++;
                else if (v.level === 'mild') summary.mildCount++;
            }
        });

        return NextResponse.json({
            date: dateParam,
            villages: result,
            summary: summary
        });

    } catch (error) {
        console.error('Error fetching daily flood village data:', error);
        return publicInternalError('เกิดข้อผิดพลาดในการดึงข้อมูลน้ำท่วมรายหมู่บ้าน');
    }
}
