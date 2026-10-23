"use client";
import Header from "@/components/Header";
import Navbar from "@/components/Navbar";
import Sidebar from "@/components/Sidebar";
import EventBar from "@/components/admin/EventBar";
import Footer from "@/components/Footer";
import OfflineSyncBar from "@/components/admin/OfflineSyncBar";
import WaterAlertWatcher from "@/components/admin/WaterAlertWatcher";
import HelpRequestWatcher from "@/components/admin/HelpRequestWatcher";
import StackTableLabels from "@/components/common/StackTableLabels";
import StaffGeoConsent from "@/components/StaffGeoConsent";

import { useAuth } from "@/context/AuthContext";

export default function EOCLayout({ children }) {
    const { user } = useAuth();

    // Citizens don't get sidebar - they only have access to public features
    // ประชาชนไม่มีเมนูหลังบ้าน / เจ้าหน้าที่ทุกบทบาท (รวมผู้ดูแลระบบ) เห็นเมนูเดียวกันทุกหน้า
    const showSidebar = user?.role !== 'citizen';

    return (
        <div className="flex flex-col min-h-screen">
            <div className="print:hidden"><Header /><Navbar sidebarMenu={showSidebar} /></div>
            <div className="flex flex-1 relative">
                {showSidebar && <div className="contents print:hidden"><Sidebar /></div>}
                <main data-ui-rounded className="flex-1 bg-[#edf5fc] overflow-auto w-full lg:w-auto print:overflow-visible print:bg-white">
                    {/* <Breadcrumb /> */}
                    {/* ความกว้าง/ระยะขอบของทุกหน้าเจ้าหน้าที่กำหนดที่นี่ที่เดียว (หน้าไม่ต้องใส่ padding/max-width ซ้ำ)
                        มือถือเหลือขอบข้างแคบ ๆ ให้เนื้อหากว้างเต็มที่ · จอกว้างมากจำกัดไว้ไม่ให้บรรทัดยาวเกินอ่าน */}
                    <div className="mx-auto w-full max-w-screen-2xl px-2 py-3 sm:px-4 sm:py-4 lg:px-6 lg:py-5 print:max-w-none print:p-0">
                        {showSidebar && <div className="print:hidden"><EventBar /></div>}
                        {showSidebar && <OfflineSyncBar />}
                        {children}
                    </div>
                </main>
            </div>
            <div className="print:hidden"><Footer /></div>
            {/* แจ้งเตือนระดับน้ำ (popup + เสียง) เฉพาะเจ้าหน้าที่ที่เข้าสู่ระบบ */}
            {showSidebar && user ? <WaterAlertWatcher /> : null}
            {showSidebar && user ? <HelpRequestWatcher /> : null}
            {/* ตาราง class="stack-mobile" แสดงเป็นการ์ดบนมือถือ */}
            <StackTableLabels />
            {/* ขอตำแหน่ง GPS เพื่อความปลอดภัย (เจ้าหน้าที่ ไม่บังคับ) */}
            {showSidebar && user ? <StaffGeoConsent /> : null}
        </div>
    );
}
