'use client';
import EOCLayout from "@/components/layouts/EOCLayout";

export default function DiseasePage() {
    return (
        <EOCLayout>
            <div className="flex items-center justify-center min-h-[70vh]">
                <div className="text-center p-8 bg-white rounded-lg shadow-lg max-w-md">
                    <div className="text-6xl mb-6">🚧</div>
                    <h1 className="text-3xl font-bold text-gray-800 mb-4">
                        กำลังพัฒนาระบบ
                    </h1>
                    <p className="text-gray-600 text-lg mb-2">
                        ระบบติดตามโรคระบาดอยู่ระหว่างการพัฒนา
                    </p>
                    <p className="text-gray-500">
                        ขออภัยในความไม่สะดวก กรุณารอใช้งานในเร็วๆ นี้
                    </p>
                </div>
            </div>
        </EOCLayout>
    );
}


