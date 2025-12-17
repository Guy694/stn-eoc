'use client';
import EOCLayout from "@/components/layouts/EOCLayout";

export default function EarthquakePage() {
    return (
        <EOCLayout>
            <div className="container mx-auto">
                <h1 className="text-3xl font-bold mb-6">แผนที่เตือนภัยแผ่นดินไหว</h1>
                <div className="bg-white rounded-lg shadow p-6">
                    <p className="text-gray-600">กำลังพัฒนา...</p>
                </div>
            </div>
        </EOCLayout>
    );
}
