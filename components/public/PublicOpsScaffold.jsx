"use client";

import PublicHeader from "@/components/public/PublicHeader";
import AIChatbot from "@/components/AIChatbot";
import Footer from "@/components/Footer";
import PublicTopNavigation from "@/components/public/PublicTopNavigation";

export default function PublicOpsScaffold({
  title,
  subtitle,
  activeMenu,
  eocIsOpen,
  eocStatus,
  eocLabel,
  children,
  showWeatherMenu = false,
  showPageHeader = true,
  mainClassName = ""
}) {
  return (
    <div className="min-h-screen bg-[#edf5fc] text-slate-900">
      <PublicHeader eocStatus={eocStatus} eocLabel={eocLabel} eocIsOpen={eocIsOpen} />

      <PublicTopNavigation activeMenu={activeMenu} showWeatherMenu={showWeatherMenu} />

      <div className="min-h-[calc(100vh-143px)]">
        <main className={`min-w-0 p-3 ${mainClassName}`}>
          {showPageHeader && (
            <section className="mb-3 rounded-xl border border-blue-100 bg-white p-4 shadow-sm">
              <h2 className="text-3xl font-black text-blue-900">{title}</h2>
              <p className="mt-1 text-sm text-slate-600">{subtitle}</p>
            </section>
          )}
          {children}
        </main>

      </div>

      <div>
        <Footer />
      </div>

      {/* เปิดผู้ช่วยได้จากเมนู "ถามผู้ช่วย" / ขอความช่วยเหลือมีปุ่มใน navbar แล้ว จึงไม่ใช้ปุ่มลอย */}
      <AIChatbot showLauncher={false} />
    </div>
  );
}
