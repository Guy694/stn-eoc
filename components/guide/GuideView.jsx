"use client";

// แสดงคู่มือจากข้อมูลใน lib/guides — สารบัญติดข้าง (จอใหญ่) ค้นหาในคู่มือ และพิมพ์/บันทึก PDF ได้
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { AlertTriangle, ArrowRight, BookOpen, Info, Printer, Search } from "lucide-react";
import { filterSections } from "@/lib/guides";

const AUDIENCES = [
  { key: "citizen", label: "ประชาชน", href: "/public/help/citizen-guide" },
  { key: "officer", label: "เจ้าหน้าที่", href: "/eoc/guide" },
  { key: "admin", label: "ผู้ดูแลระบบ", href: "/eoc/guide/admin" }
];

function Steps({ items }) {
  return (
    <ol className="space-y-2">
      {items.map((item, index) => (
        <li key={item} className="flex gap-3">
          <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[#0b4c86] text-xs font-bold text-white" aria-hidden="true">{index + 1}</span>
          <span className="min-w-0 leading-relaxed text-slate-800">{item}</span>
        </li>
      ))}
    </ol>
  );
}

function Bullets({ items }) {
  return (
    <ul className="space-y-1.5">
      {items.map((item) => (
        <li key={item} className="flex gap-2.5 leading-relaxed text-slate-800">
          <span className="mt-[9px] h-1.5 w-1.5 shrink-0 rounded-full bg-[#0b4c86]" aria-hidden="true" />
          <span className="min-w-0">{item}</span>
        </li>
      ))}
    </ul>
  );
}

function Block({ block }) {
  if (block.kind === "note" || block.kind === "warn") {
    const warn = block.kind === "warn";
    const Icon = warn ? AlertTriangle : Info;
    return (
      <p className={`flex gap-2.5 rounded-lg px-3 py-2.5 text-sm leading-relaxed ${warn ? "bg-amber-50 text-amber-950 ring-1 ring-amber-200" : "bg-[#edf5fc] text-[#083865]"}`}>
        <Icon className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
        <span>{block.text}</span>
      </p>
    );
  }
  if (block.kind === "faq") {
    return (
      <details className="group rounded-2xl border border-slate-200 bg-white px-3 py-2 open:bg-slate-50/60">
        <summary className="cursor-pointer list-none font-semibold text-slate-900 marker:hidden">
          <span className="mr-1.5 text-[#0b4c86] transition group-open:rotate-90 inline-block">›</span>{block.q}
        </summary>
        <p className="mt-1.5 pl-4 leading-relaxed text-slate-700">{block.a}</p>
      </details>
    );
  }
  if (block.kind === "table") {
    return (
      <div className="overflow-x-auto rounded-lg border border-slate-200">
        <table className="w-full min-w-[480px] border-collapse text-sm">
          <thead className="bg-[#083865] text-left text-white">
            <tr>{block.head.map((cell) => <th key={cell} scope="col" className="px-3 py-2 font-semibold">{cell}</th>)}</tr>
          </thead>
          <tbody>
            {block.rows.map((row, index) => (
              <tr key={row[0]} className={index % 2 ? "bg-slate-50" : "bg-white"}>
                {row.map((cell, cellIndex) => <td key={cell} className={`px-3 py-2 align-top ${cellIndex ? "text-slate-700" : "font-semibold text-slate-900"}`}>{cell}</td>)}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  }
  return (
    <div>
      {block.title ? <h3 className="mb-2 text-sm font-bold text-[#083865]">{block.title}</h3> : null}
      {block.kind === "steps" ? <Steps items={block.items} /> : <Bullets items={block.items} />}
    </div>
  );
}

export default function GuideView({ guide, current, showAdminLink = false, linkPrefix = "" }) {
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(guide.sections[0]?.id);
  const sections = useMemo(() => filterSections(guide.sections, query), [guide.sections, query]);

  // ไฮไลต์หัวข้อในสารบัญตามตำแหน่งที่อ่านอยู่
  useEffect(() => {
    const elements = guide.sections.map((section) => document.getElementById(section.id)).filter(Boolean);
    if (!elements.length || typeof IntersectionObserver === "undefined") return undefined;
    const observer = new IntersectionObserver((entries) => {
      const visible = entries.filter((entry) => entry.isIntersecting).sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)[0];
      if (visible) setActive(visible.target.id);
    }, { rootMargin: "-80px 0px -60% 0px" });
    elements.forEach((element) => observer.observe(element));
    return () => observer.disconnect();
  }, [guide.sections, sections.length]);

  const audiences = AUDIENCES.filter((item) => item.key !== "admin" || showAdminLink || current === "admin");

  return (
    <div className="mx-auto max-w-6xl space-y-5 print:max-w-none">
      <style>{"@media print { @page { size: A4; margin: 14mm; } details { break-inside: avoid; } details > p { display: block !important; } }"}</style>
      <header className="space-y-3">
        <nav aria-label="เลือกคู่มือ" className="flex flex-wrap gap-1.5 print:hidden">
          {audiences.map((item) => (
            <Link key={item.key} href={item.href} aria-current={item.key === current ? "page" : undefined}
              className={`rounded-full px-3 py-1 text-sm font-semibold transition ${item.key === current ? "bg-[#0b4c86] text-white" : "bg-white text-slate-700 ring-1 ring-slate-200 hover:ring-[#0b4c86]"}`}>
              คู่มือ{item.label}
            </Link>
          ))}
        </nav>
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div className="min-w-0">
            <h1 className="flex items-center gap-2 text-2xl font-black text-slate-900 sm:text-[1.8rem]"><BookOpen className="h-7 w-7 text-[#0b4c86]" aria-hidden="true" />{guide.title}</h1>
            <p className="mt-1 max-w-3xl text-sm leading-relaxed text-slate-600">{guide.intro}</p>
          </div>
          <button type="button" onClick={() => window.print()} className="inline-flex min-h-10 items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-4 text-sm font-bold text-slate-700 hover:bg-slate-50 print:hidden">
            <Printer className="h-4 w-4" aria-hidden="true" />พิมพ์ / บันทึก PDF
          </button>
        </div>
        <label className="relative block max-w-xl print:hidden">
          <span className="sr-only">ค้นหาในคู่มือ</span>
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" aria-hidden="true" />
          <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="ค้นหาในคู่มือ เช่น ติดตาม, ธงเหลือง, ออกซิเจน"
            className="w-full rounded-lg border border-slate-300 bg-white py-2.5 pl-9 pr-3 text-base text-slate-900 outline-none focus:border-[#0b4c86] focus:ring-2 focus:ring-[#0b4c86]/15" />
        </label>
      </header>

      <div className="grid gap-6 lg:grid-cols-[15rem_minmax(0,1fr)]">
        <nav aria-label="สารบัญ" className="hidden print:hidden lg:block">
          <ol className="sticky top-4 space-y-0.5 border-l-2 border-slate-200">
            {guide.sections.map((section) => {
              const shown = sections.includes(section);
              return (
                <li key={section.id}>
                  <a href={`#${section.id}`} aria-current={active === section.id ? "true" : undefined}
                    className={`-ml-0.5 block border-l-2 py-1.5 pl-3 text-sm leading-snug transition ${active === section.id ? "border-[#0b4c86] font-bold text-[#0b4c86]" : "border-transparent text-slate-600 hover:text-slate-900"} ${shown ? "" : "opacity-35"}`}>
                    {section.title}
                  </a>
                </li>
              );
            })}
          </ol>
        </nav>

        <div className="min-w-0 space-y-4">
          {sections.length ? sections.map((section) => (
            <section key={section.id} id={section.id} aria-labelledby={`${section.id}-title`} className="scroll-mt-20 rounded-xl border border-slate-200 bg-white p-4 sm:p-5 print:break-inside-avoid print:border-slate-300">
              <div className="mb-3 flex flex-wrap items-start justify-between gap-2">
                <div className="min-w-0">
                  <h2 id={`${section.id}-title`} className="text-lg font-black text-slate-900">{section.title}</h2>
                  {section.summary ? <p className="mt-0.5 text-sm text-slate-600">{section.summary}</p> : null}
                </div>
                {section.href ? (
                  <Link href={`${linkPrefix}${section.href}`} className="inline-flex shrink-0 items-center gap-1 rounded-lg bg-[#edf5fc] px-3 py-1.5 text-sm font-bold text-[#0b4c86] hover:bg-[#dbeaf7] print:hidden">
                    ไปที่หน้านี้<ArrowRight className="h-4 w-4" aria-hidden="true" />
                  </Link>
                ) : null}
              </div>
              <div className="space-y-4 text-[15px]">
                {section.blocks.map((block, index) => <Block key={`${section.id}-${index}`} block={block} />)}
              </div>
            </section>
          )) : (
            <p className="rounded-xl border border-dashed border-slate-300 bg-white px-6 py-10 text-center text-sm text-slate-600">ไม่พบหัวข้อที่ตรงกับ “{query}” ลองคำอื่น หรือล้างคำค้นหา</p>
          )}
        </div>
      </div>
    </div>
  );
}
