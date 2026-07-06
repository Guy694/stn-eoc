"use client";

import Link from "next/link";
import Image from "next/image";
import AIChatbot from "@/components/AIChatbot";

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
  showPageHeader = true,
  mainClassName = ""
}) {
  const openAssistant = () => {
    if (typeof window !== "undefined") {
      window.dispatchEvent(new CustomEvent("eoc-assistant:open"));
    }
  };

  const items = [
    { href: "/public", label: "หน้าหลัก", icon: "⌂", key: "home" },
    { href: "/public/disaster-map", label: "แผนที่", icon: "⌖", key: "map" },
    { href: "/public/announcements", label: "ประกาศ", icon: "⚑", key: "announce" },
    { href: "/public/shelters", label: "ศูนย์พักพิง", icon: "⌂", imageSrc: "/stn-eoc/img/shelter.png", key: "shelters" },
    { href: "/public/agencies", label: "หน่วยงาน", icon: "☎", key: "agencies" },
    { href: "#", label: "EOC Assistant", icon: "🤖", key: "assistant", action: openAssistant },
    { href: "/public/help/citizen-guide", label: "คู่มือ", icon: "↓", key: "guide" },
    { href: "/login", label: "เจ้าหน้าที่", icon: "ⓘ", key: "staff" }
  ];
  const statusKey = eocStatus || (eocIsOpen ? "open" : "watch");
  const statusMeta = {
    open: {
      title: "เปิด EOC",
      className: "border-emerald-300 bg-emerald-600"
    },
    closed: {
      title: "ปิด EOC",
      className: "border-slate-300 bg-slate-700"
    },
    watch: {
      title: "เฝ้าระวัง",
      className: "border-sky-300 bg-sky-700"
    }
  }[statusKey] || {
    title: eocIsOpen ? "เปิด EOC" : "เฝ้าระวัง",
    className: eocIsOpen ? "border-emerald-300 bg-emerald-600" : "border-sky-300 bg-sky-700"
  };

  return (
    <div className="min-h-screen bg-[#edf5fc] text-slate-900">
      <header className="border-b border-blue-950/20 bg-[#083865] text-white shadow-lg">
        <div className="flex min-h-[86px] items-center gap-5 px-5 max-lg:flex-wrap max-lg:py-3">
          <div className="flex min-w-0 flex-1 items-center gap-4">
            <Image src="/stn-eoc/img/logo.png" alt="Satun EOC" width={62} height={62} className="h-[62px] w-[62px] rounded-full bg-white p-1.5 shadow-md" priority />
            <div className="min-w-0">
              <h1 className="truncate text-2xl font-black leading-7 max-sm:text-lg">ระบบศูนย์ปฏิบัติการฉุกเฉิน จังหวัดสตูล</h1>
              <p className="truncate text-base font-semibold text-blue-100 max-sm:text-xs">Satun EOC Public Dashboard</p>
            </div>
          </div>

        

          <div className="hidden items-center gap-5 text-sm text-blue-50 lg:flex">
            <div>
              <div className="font-bold text-white">วันที่ {formatThaiDate()}</div>
              <div>เวลา {formatThaiTime()} น.</div>
            </div>
          </div>

          <div className={`ml-auto rounded-2xl border px-6 py-3 text-center shadow-sm ${statusMeta.className}`}>
            <div className="text-xl font-black leading-none">{statusMeta.title}</div>
            <div className="mt-1 text-xs text-white/85">{eocLabel || "สถานะศูนย์"}</div>
          </div>
        </div>
      </header>

      <div className="grid min-h-[calc(100vh-87px)] grid-cols-[98px_minmax(0,1fr)] max-lg:grid-cols-1">
        <aside className="flex flex-col items-center gap-2 bg-[#0b4c86] px-2 py-6 text-white max-lg:hidden">
          {items.map((item) => {
            const isActive = item.key === activeMenu;
            const sharedClassName = `flex w-full flex-col items-center gap-1 rounded-xl px-2 py-3 text-center text-xs font-bold transition ${isActive ? "bg-white text-blue-800 shadow-md" : "text-blue-50 hover:bg-white/10"}`;

            if (item.action) {
              return (
                <button
                  key={item.key}
                  type="button"
                  onClick={item.action}
                  className={sharedClassName}
                >
                  <span className="text-2xl leading-none">{item.icon}</span>
                  <span>{item.label}</span>
                </button>
              );
            }

            return (
              <Link
                key={item.href}
                href={item.href}
                className={sharedClassName}
              >
                {item.imageSrc ? (
                  <Image src={item.imageSrc} alt="" width={26} height={26} className="h-7 w-7 object-contain" />
                ) : (
                  <span className="text-2xl leading-none">{item.icon}</span>
                )}
                <span>{item.label}</span>
              </Link>
            );
          })}
          <div className="mt-auto rounded-xl bg-white/15 p-3 text-center text-xs font-semibold leading-5">
            <div className="mx-auto mb-2 flex h-9 w-9 items-center justify-center rounded-lg bg-white/15 text-xl">◇</div>
            ข้อมูลสาธารณะ
          </div>
        </aside>

        <main className={`min-w-0 p-3 pb-24 lg:pb-3 ${mainClassName}`}>
          {showPageHeader && (
            <section className="mb-3 rounded-xl border border-blue-100 bg-white p-4 shadow-sm">
              <h2 className="text-3xl font-black text-blue-900">{title}</h2>
              <p className="mt-1 text-sm text-slate-600">{subtitle}</p>
            </section>
          )}
          {children}
        </main>

        <nav className="fixed inset-x-0 bottom-0 z-[1000] grid grid-cols-6 border-t border-blue-100 bg-white shadow-[0_-8px_24px_rgba(15,23,42,0.12)] lg:hidden">
          {items.slice(0, 6).map((item) => {
            const isActive = item.key === activeMenu;

            if (item.action) {
              return (
                <button
                  key={item.key}
                  type="button"
                  onClick={item.action}
                  className={`flex flex-col items-center gap-1 px-1 py-2 text-[11px] font-bold ${isActive ? "text-blue-700" : "text-slate-500"}`}
                >
                  <span className={`flex h-8 w-8 items-center justify-center rounded-lg text-lg ${isActive ? "bg-blue-50" : "bg-transparent"}`}>
                    {item.icon}
                  </span>
                  <span className="truncate">{item.label}</span>
                </button>
              );
            }

            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex flex-col items-center gap-1 px-1 py-2 text-[11px] font-bold ${isActive ? "text-blue-700" : "text-slate-500"}`}
              >
                <span className={`flex h-8 w-8 items-center justify-center rounded-lg text-lg ${isActive ? "bg-blue-50" : "bg-transparent"}`}>
                  {item.imageSrc ? (
                    <Image src={item.imageSrc} alt="" width={22} height={22} className="h-6 w-6 object-contain" />
                  ) : (
                    item.icon
                  )}
                </span>
                <span className="truncate">{item.label}</span>
              </Link>
            );
          })}
        </nav>
      </div>

      <AIChatbot />
    </div>
  );
}
