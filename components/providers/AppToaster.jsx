"use client";

import { Toaster } from "sonner";

// จุดแสดงผลการทำงานเดียวของทั้งระบบ (เพิ่ม/แก้ไข/ลบ/บันทึก/ผิดพลาด) — มุมขวาบน · เรียกผ่าน lib/notify
export default function AppToaster() {
    return (
        <Toaster
            position="top-right"
            richColors
            closeButton
            visibleToasts={4}
            offset={16}
            mobileOffset={{ top: 12, left: 12, right: 12 }}
            style={{ fontFamily: "var(--font-kanit)", zIndex: 2147483000 }}
            toastOptions={{
                duration: 4000,
                style: { fontFamily: "var(--font-kanit)", fontSize: "0.95rem" }
            }}
        />
    );
}
