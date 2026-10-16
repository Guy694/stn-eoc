"use client";

// หัวข้อของหน้านโยบายความเป็นส่วนตัว
// มือถือ: แต่ละหัวข้อเป็นการ์ดของตัวเอง (อ่านทีละเรื่อง ไม่เป็นกำแพงตัวอักษร) · จอใหญ่: เรียงต่อกันในการ์ดเดียว คั่นด้วยเส้น
export function PrivacySection({ id, title, icon: Icon, children }) {
  return (
    <section
      id={id}
      className="scroll-mt-16 rounded-2xl bg-white p-5 shadow-sm ring-1 ring-[#d6e3ea] lg:scroll-mt-6 lg:rounded-none lg:bg-transparent lg:p-0 lg:pt-8 lg:shadow-none lg:ring-0 lg:[&:not(:first-child)]:border-t lg:[&:not(:first-child)]:border-[#d6e3ea] lg:first:pt-0"
    >
      <h2 className="flex items-center gap-2.5 font-[family-name:var(--font-kanit)] text-xl font-semibold leading-snug text-[#0c2f4a] lg:text-2xl">
        {Icon ? (
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[#e3f2f5] text-[#11708a]">
            <Icon className="h-[18px] w-[18px]" aria-hidden="true" />
          </span>
        ) : null}
        {title}
      </h2>
      <div className="mt-3 text-base leading-7 text-slate-700 lg:mt-4 lg:text-[1.02rem] lg:leading-8">{children}</div>
    </section>
  );
}

export function PrivacyBullets({ items }) {
  return (
    <ul className="space-y-1.5">
      {items.map((item) => (
        <li key={item} className="flex gap-3">
          <span className="mt-[0.7rem] h-1.5 w-1.5 shrink-0 rounded-full bg-[#2a9db0] lg:mt-3" aria-hidden="true" />
          <span>{item}</span>
        </li>
      ))}
    </ul>
  );
}
