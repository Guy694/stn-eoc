"use client";

import Image from "next/image";
import AIChatbot from "@/components/AIChatbot";
import Footer from "@/components/Footer";
import PublicTopNavigation from "@/components/public/PublicTopNavigation";

function formatThaiDate() {
  try {
    return new Date().toLocaleDateString("th-TH", {
      day: "numeric",
      month: "long",
      year: "numeric"
    });
  } catch {
    return "-";
  }
}

function formatThaiTime() {
  try {
    return new Date().toLocaleTimeString("th-TH", {
      hour: "2-digit",
      minute: "2-digit"
    });
  } catch {
    return "-";
  }
}

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
  const statusKey = eocStatus || (eocIsOpen ? "open" : "watch");
  const statusMeta = {
    // ใช้ภาษาที่ประชาชนเข้าใจแทนคำว่า "เปิด/ปิด EOC"
    open: {
      title: "มีเหตุการณ์ที่ต้องติดตาม",
      className: "border-amber-300 bg-amber-600"
    },
    closed: {
      title: "สถานการณ์ปกติ",
      className: "border-emerald-300 bg-emerald-700"
    },
    watch: {
      title: "เฝ้าระวัง",
      className: "border-sky-300 bg-sky-700"
    }
  }[statusKey] || {
    title: eocIsOpen ? "มีเหตุการณ์ที่ต้องติดตาม" : "เฝ้าระวัง",
    className: eocIsOpen ? "border-emerald-300 bg-emerald-600" : "border-sky-300 bg-sky-700"
  };

  return (
    <div className="min-h-screen bg-[#edf5fc] text-slate-900">
      <header className="border-b border-blue-950/20 bg-[#083865] text-white shadow-lg">
        <div className="flex min-h-[70px] items-center gap-3 px-3 py-2 sm:min-h-[78px] sm:px-4 lg:min-h-[86px] lg:gap-5 lg:px-5 lg:py-0">
          <div className="flex min-w-0 flex-1 items-center gap-3 lg:gap-4">
            <Image src="/stn-eoc/img/logo.png" alt="Satun EOC" width={62} height={62} className="h-10 w-10 rounded-full bg-white p-1 shadow-md sm:h-12 sm:w-12 lg:h-[62px] lg:w-[62px] lg:p-1.5" priority />
            <div className="min-w-0">
              <h1 className="truncate text-sm font-black leading-5 sm:text-base lg:text-2xl lg:leading-7">ระบบศูนย์ปฏิบัติการภาวะฉุกเฉิน ด้านการแพทย์และสาธารณสุข จังหวัดสตูล</h1>
              <p className="truncate text-[11px] font-semibold text-blue-100 sm:text-xs lg:text-base">Satun Provincial Emergency Operations Center (Satun Geo-EOC)</p>
            </div>
          </div>

        

          <div className="hidden items-center gap-5 text-sm text-blue-50 lg:flex">
            <div>
              <div className="font-bold text-white">วันที่ {formatThaiDate()}</div>
              <div>เวลา {formatThaiTime()} น.</div>
            </div>
          </div>

          <div className={`ml-auto shrink-0 rounded-xl border px-3 py-2 text-center shadow-sm sm:px-4 lg:rounded-2xl lg:px-6 lg:py-3 ${statusMeta.className}`}>
            <div className="text-sm font-black leading-none sm:text-base lg:text-xl">{statusMeta.title}</div>
            <div className="mt-0.5 text-[10px] text-white/85 sm:text-[11px] lg:mt-1 lg:text-xs">{eocLabel || "สถานะศูนย์"}</div>
          </div>
        </div>
      </header>

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
