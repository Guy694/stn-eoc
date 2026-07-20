"use client";
import EOCLayout from "@/components/layouts/EOCLayout";
import AppIcon from "@/components/icons/AppIcon";

export default function AccidentEOCPage() {
    return (
        <EOCLayout>
            <div className="flex items-center justify-center min-h-[70vh]">
                <div className="text-center p-8 bg-white rounded-lg shadow-lg max-w-md">
                    <div className="text-6xl mb-6"><AppIcon icon="route" className="inline-block h-[1em] w-[1em] shrink-0 align-[-0.125em]" /></div>
                    <h1 className="text-3xl font-bold text-gray-800 mb-4">
                        กำลังพัฒนาระบบ
                    </h1>
                    <p className="text-gray-600 text-lg mb-2">
                        ระบบติดตามอุบัติเหตุช่วงเทศกาลอยู่ระหว่างการพัฒนา
                    </p>
                    <p className="text-gray-500">
                        ขออภัยในความไม่สะดวก กรุณารอใช้งานในเร็วๆ นี้
                    </p>
                </div>
            </div>
        </EOCLayout>
    );
}


