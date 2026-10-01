"use client";

// ปุ่มและแผงแบบ Windy ที่ใช้ร่วมกันระหว่างหน้าแผนที่สถานการณ์และหน้าสภาพอากาศ

export const GLASS = "bg-slate-900/80 text-white shadow-xl ring-1 ring-white/10 backdrop-blur-md";

export function SidebarItem({ label, icon: Icon, tone, active, onClick, title, href }) {
  const content = (
    <>
      <span
        className={`max-w-[190px] truncate rounded-full px-3 py-1 text-[13px] font-bold transition ${
          active ? "bg-[#0b4c86] text-white shadow-md" : "bg-slate-900/70 text-white/90 group-hover:bg-slate-900/90"
        }`}
      >
        {label}
      </span>
      <span
        className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gradient-to-br ${tone} shadow-md transition ${
          active ? "ring-2 ring-white ring-offset-2 ring-offset-slate-900/40" : "opacity-60 grayscale-[35%] group-hover:opacity-100"
        }`}
      >
        <Icon className="h-[18px] w-[18px] text-white drop-shadow" aria-hidden="true" />
      </span>
    </>
  );

  if (href) {
    return (
      <a href={href} title={title || label} className="group flex w-full items-center justify-end gap-2 text-right">
        {content}
      </a>
    );
  }

  return (
    <button
      type="button"
      onClick={onClick}
      title={title || label}
      aria-pressed={active}
      className="group flex w-full items-center justify-end gap-2 text-right"
    >
      {content}
    </button>
  );
}

export function SectionTitle({ children }) {
  return <p className="mb-1.5 mt-3 pr-1 text-right text-[11px] font-black uppercase tracking-wide text-white/70 drop-shadow first:mt-0">{children}</p>;
}

export function MenuToggle({ open, onToggle, label = "ชั้นข้อมูล", controls }) {
  return (
    <button
      type="button"
      onClick={onToggle}
      className="pointer-events-auto flex items-center gap-2"
      aria-expanded={open}
      aria-controls={controls}
    >
      <span className="rounded-full bg-slate-900/70 px-3 py-1 text-sm font-black text-white shadow">{label}</span>
      <span className="flex h-11 w-11 items-center justify-center rounded-full bg-[#b91c1c] text-white shadow-lg ring-2 ring-white/80">
        {open ? (
          <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2.5" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18" /></svg>
        ) : (
          <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2.5" aria-hidden="true"><path d="M4 7h16M4 12h16M4 17h16" /></svg>
        )}
      </span>
    </button>
  );
}

export function WindyFrame({ src }) {
  return (
    <iframe
      key={src}
      title="แผนที่พยากรณ์อากาศ Windy"
      src={src}
      className="absolute inset-0 h-full w-full border-0"
      allow="fullscreen"
      referrerPolicy="strict-origin-when-cross-origin"
    />
  );
}
