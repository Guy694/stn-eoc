"use client";

// แสดงคู่มือจากข้อมูลใน lib/guides
// - หัวหน้าน้ำเงินแบบเดียวกับทั้งระบบ (ตอนพิมพ์เปลี่ยนเป็นพื้นขาว ตัวหนังสือดำ)
// - ค้นหาในคู่มือ พร้อมไฮไลต์คำที่พบ · สารบัญติดข้าง (จอใหญ่) / แถบสารบัญเลื่อนได้ (มือถือ)
// - พิมพ์/บันทึก PDF ได้ · ปุ่มกลับขึ้นด้านบน
import { Fragment, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { AlertTriangle, ArrowRight, ArrowUp, BookOpen, ChevronRight, Info, Printer, Search, X } from "lucide-react";
import { filterSections } from "@/lib/guides";

const AUDIENCES = [
  { key: "citizen", label: "ประชาชน", href: "/public/help/citizen-guide" },
  { key: "officer", label: "เจ้าหน้าที่", href: "/eoc/guide" },
  { key: "admin", label: "ผู้ดูแลระบบ", href: "/eoc/guide/admin" }
];

/** กล่องที่เลื่อนจริง (หน้าเจ้าหน้าที่เลื่อนใน <main> ไม่ใช่ทั้งหน้าต่าง) */
function scrollParent(element) {
  let node = element?.parentElement;
  while (node && node !== document.body) {
    const style = window.getComputedStyle(node);
    if (/(auto|scroll)/.test(style.overflowY) && node.scrollHeight > node.clientHeight) return node;
    node = node.parentElement;
  }
  return window;
}

const escapeRegExp = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/** ไฮไลต์คำค้นในข้อความ */
function Mark({ text, words }) {
  if (!words.length || !text) return text;
  const pattern = new RegExp(`(${words.map(escapeRegExp).join("|")})`, "gi");
  const parts = String(text).split(pattern);
  return parts.map((part, index) => (index % 2 ? <mark key={index} className="rounded bg-amber-200/80 px-0.5 text-inherit print:bg-transparent">{part}</mark> : <Fragment key={index}>{part}</Fragment>));
}

function Steps({ items, words }) {
  return (
    <ol className="space-y-2.5">
      {items.map((item, index) => (
        <li key={item} className="flex gap-3">
          <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[#0b4c86] text-xs font-semibold text-white print:border print:border-slate-400 print:bg-white print:text-slate-900" aria-hidden="true">{index + 1}</span>
          <span className="min-w-0 leading-relaxed text-slate-800"><Mark text={item} words={words} /></span>
        </li>
      ))}
    </ol>
  );
}

function Bullets({ items, words }) {
  return (
    <ul className="space-y-1.5">
      {items.map((item) => (
        <li key={item} className="flex gap-2.5 leading-relaxed text-slate-800">
          <span className="mt-[9px] h-1.5 w-1.5 shrink-0 rounded-full bg-[#2a9db0]" aria-hidden="true" />
          <span className="min-w-0"><Mark text={item} words={words} /></span>
        </li>
      ))}
    </ul>
  );
}

function Block({ block, words, forceOpen }) {
  if (block.kind === "note" || block.kind === "warn") {
    const warn = block.kind === "warn";
    const Icon = warn ? AlertTriangle : Info;
    return (
      <p className={`flex gap-2.5 rounded-xl px-3.5 py-3 text-sm leading-relaxed ring-1 ${warn ? "bg-amber-50 text-amber-950 ring-amber-200" : "bg-sky-50 text-[#083865] ring-sky-100"}`}>
        <Icon className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
        <span><Mark text={block.text} words={words} /></span>
      </p>
    );
  }
  if (block.kind === "faq") {
    return (
      <details open={forceOpen || undefined} className="group rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 transition open:border-sky-200 open:bg-sky-50/40">
        <summary className="flex cursor-pointer list-none items-start gap-2 font-semibold text-slate-900 marker:hidden [&::-webkit-details-marker]:hidden">
          <ChevronRight className="mt-0.5 h-4 w-4 shrink-0 text-[#0b4c86] transition group-open:rotate-90 motion-reduce:transition-none" aria-hidden="true" />
          <span><Mark text={block.q} words={words} /></span>
        </summary>
        <p className="mt-1.5 pl-6 leading-relaxed text-slate-700"><Mark text={block.a} words={words} /></p>
      </details>
    );
  }
  if (block.kind === "table") {
    return (
      <div className="overflow-x-auto rounded-xl border border-slate-200">
        <table className="w-full min-w-[480px] border-collapse text-sm">
          <thead className="bg-slate-50 text-left text-xs font-semibold text-slate-600">
            <tr>{block.head.map((cell) => <th key={cell} scope="col" className="border-b border-slate-200 px-3 py-2.5">{cell}</th>)}</tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {block.rows.map((row) => (
              <tr key={row[0]}>
                {row.map((cell, cellIndex) => <td key={cell} className={`px-3 py-2.5 align-top ${cellIndex ? "text-slate-700" : "font-semibold text-slate-900"}`}><Mark text={cell} words={words} /></td>)}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  }
  return (
    <div>
      {block.title ? <h3 className="mb-2.5 font-semibold text-[#083865]"><Mark text={block.title} words={words} /></h3> : null}
      {block.kind === "steps" ? <Steps items={block.items} words={words} /> : <Bullets items={block.items} words={words} />}
    </div>
  );
}

export default function GuideView({ guide, current, showAdminLink = false, linkPrefix = "" }) {
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(guide.sections[0]?.id);
  const [showTop, setShowTop] = useState(false);
  const rootRef = useRef(null);
  const scrollerRef = useRef(null);
  const sections = useMemo(() => filterSections(guide.sections, query), [guide.sections, query]);
  const words = useMemo(() => query.trim().split(/\s+/).filter(Boolean), [query]);

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

  // ปุ่มกลับขึ้นด้านบน: แสดงเมื่อเลื่อนลงมาแล้ว
  useEffect(() => {
    const scroller = scrollParent(rootRef.current);
    scrollerRef.current = scroller;
    const position = () => (scroller === window ? window.scrollY : scroller.scrollTop);
    const onScroll = () => setShowTop(position() > 600);
    onScroll();
    scroller.addEventListener("scroll", onScroll, { passive: true });
    return () => scroller.removeEventListener("scroll", onScroll);
  }, []);

  // แถบสารบัญบนมือถือ: เลื่อนชิปของหัวข้อที่อ่านอยู่ให้มองเห็น
  useEffect(() => {
    const chip = document.getElementById(`toc-chip-${active}`);
    chip?.scrollIntoView?.({ block: "nearest", inline: "center" });
  }, [active]);

  const audiences = AUDIENCES.filter((item) => item.key !== "admin" || showAdminLink || current === "admin");
  const searching = words.length > 0;

  return (
    <div ref={rootRef} className="mx-auto max-w-6xl space-y-4 font-[family-name:var(--font-kanit)] print:max-w-none print:space-y-3">
      <style>{"@media print { @page { size: A4; margin: 14mm; } details { break-inside: avoid; } details > p { display: block !important; } }"}</style>

      {/* หัวหน้า: พื้นน้ำเงิน · ตอนพิมพ์เป็นพื้นขาว */}
      <header className="relative overflow-hidden rounded-2xl bg-[#0b4c86] p-5 text-white shadow-[0_18px_36px_-24px_rgba(11,76,134,.9)] sm:p-6 print:rounded-none print:border-b-2 print:border-slate-900 print:bg-white print:p-0 print:pb-3 print:text-slate-900 print:shadow-none">
        <div className="absolute -right-16 -top-20 h-56 w-56 rounded-full bg-white/10 print:hidden" aria-hidden="true" />
        <div className="absolute -bottom-24 right-40 h-48 w-48 rounded-full bg-white/5 print:hidden" aria-hidden="true" />
        <div className="relative space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <nav aria-label="เลือกคู่มือ" className="inline-flex flex-wrap gap-1 rounded-xl bg-white/10 p-1 ring-1 ring-white/15 print:hidden">
              {audiences.map((item) => (
                <Link key={item.key} href={item.href} aria-current={item.key === current ? "page" : undefined}
                  className={`rounded-lg px-3 py-1.5 text-sm font-medium transition ${item.key === current ? "bg-white text-[#0b4c86]" : "text-blue-50 hover:bg-white/15"}`}>
                  คู่มือ{item.label}
                </Link>
              ))}
            </nav>
            <button type="button" onClick={() => window.print()} className="inline-flex min-h-10 items-center gap-1.5 rounded-xl bg-white/10 px-3.5 text-sm font-semibold text-white ring-1 ring-white/20 transition hover:bg-white/20 print:hidden">
              <Printer className="h-4 w-4" aria-hidden="true" />พิมพ์ / บันทึก PDF
            </button>
          </div>

          <div className="flex items-start gap-3">
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-white/10 ring-1 ring-white/20 print:hidden"><BookOpen className="h-5 w-5" aria-hidden="true" /></span>
            <div className="min-w-0">
              <h1 className="text-xl font-semibold leading-snug sm:text-2xl">{guide.title}</h1>
              <p className="mt-1 max-w-3xl text-sm leading-relaxed text-blue-100 print:text-slate-700">{guide.intro}</p>
            </div>
          </div>

          <div className="print:hidden">
            <label className="relative block max-w-xl">
              <span className="sr-only">ค้นหาในคู่มือ</span>
              <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" aria-hidden="true" />
              <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="ค้นหาในคู่มือ เช่น ติดตาม, ธงเหลือง, Telegram"
                className="w-full rounded-xl border-0 bg-white py-3 pl-10 pr-11 text-base text-slate-900 shadow-[0_10px_24px_-16px_rgba(2,6,23,.6)] outline-none placeholder:text-slate-400 focus:ring-2 focus:ring-sky-300" />
              {query ? (
                <button type="button" onClick={() => setQuery("")} className="absolute right-2 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100" aria-label="ล้างคำค้นหา">
                  <X className="h-4 w-4" aria-hidden="true" />
                </button>
              ) : null}
            </label>
            <p className="mt-2 min-h-5 text-xs text-blue-100" aria-live="polite">
              {searching ? `พบ ${sections.length} จาก ${guide.sections.length} หัวข้อ` : `${guide.sections.length} หัวข้อ`}
            </p>
          </div>
        </div>
      </header>

      {/* สารบัญบนมือถือ: เลื่อนซ้าย–ขวา ติดด้านบนขณะอ่าน */}
      <nav aria-label="สารบัญ" className="sticky top-0 z-20 -mx-4 overflow-x-auto border-b border-slate-200/70 bg-white/90 px-4 py-2 backdrop-blur [scrollbar-width:none] lg:hidden print:hidden">
        <ol className="flex w-max gap-1.5">
          {sections.map((section) => (
            <li key={section.id}>
              <a id={`toc-chip-${section.id}`} href={`#${section.id}`} aria-current={active === section.id ? "true" : undefined}
                className={`block whitespace-nowrap rounded-full px-3 py-1.5 text-sm font-medium ring-1 transition ${active === section.id ? "bg-[#0b4c86] text-white ring-[#0b4c86]" : "bg-white text-slate-700 ring-slate-200"}`}>
                {section.title}
              </a>
            </li>
          ))}
        </ol>
      </nav>

      <div className="grid gap-6 lg:grid-cols-[15rem_minmax(0,1fr)]">
        {/* สารบัญจอใหญ่ */}
        <nav aria-label="สารบัญ" className="hidden print:hidden lg:block">
          <div className="sticky top-4 rounded-2xl border border-slate-200 bg-white p-3">
            <p className="px-2 pb-2 text-xs font-semibold text-slate-500">สารบัญ</p>
            <ol className="space-y-0.5">
              {guide.sections.map((section) => {
                const shown = sections.includes(section);
                const isActive = active === section.id;
                return (
                  <li key={section.id}>
                    <a href={`#${section.id}`} aria-current={isActive ? "true" : undefined}
                      className={`block rounded-lg px-2.5 py-1.5 text-sm leading-snug transition ${isActive ? "bg-sky-50 font-semibold text-[#0b4c86]" : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"} ${shown ? "" : "opacity-35"}`}>
                      {section.title}
                    </a>
                  </li>
                );
              })}
            </ol>
          </div>
        </nav>

        <div className="min-w-0 space-y-4">
          {sections.length ? sections.map((section) => (
            <section key={section.id} id={section.id} aria-labelledby={`${section.id}-title`} className="scroll-mt-16 rounded-2xl border border-slate-200 bg-white p-4 sm:p-5 lg:scroll-mt-6 print:break-inside-avoid print:rounded-none print:border-0 print:border-b print:border-slate-300 print:p-0 print:pb-3">
              <div className="mb-4 flex flex-wrap items-start justify-between gap-2 border-b border-slate-100 pb-3 print:border-0 print:pb-0">
                <div className="min-w-0">
                  <h2 id={`${section.id}-title`} className="text-lg font-semibold text-slate-900"><Mark text={section.title} words={words} /></h2>
                  {section.summary ? <p className="mt-0.5 text-sm text-slate-500"><Mark text={section.summary} words={words} /></p> : null}
                </div>
                {section.href ? (
                  <Link href={`${linkPrefix}${section.href}`} className="inline-flex shrink-0 items-center gap-1 rounded-lg bg-sky-50 px-3 py-1.5 text-sm font-semibold text-[#0b4c86] ring-1 ring-sky-100 hover:bg-sky-100 print:hidden">
                    ไปที่หน้านี้<ArrowRight className="h-4 w-4" aria-hidden="true" />
                  </Link>
                ) : null}
              </div>
              <div className="space-y-4 text-[15px]">
                {section.blocks.map((block, index) => <Block key={`${section.id}-${index}`} block={block} words={words} forceOpen={searching} />)}
              </div>
            </section>
          )) : (
            <div className="flex flex-col items-center rounded-2xl border border-slate-200 bg-white px-6 py-10 text-center">
              <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-slate-50 text-slate-400 ring-1 ring-slate-200"><Search className="h-6 w-6" aria-hidden="true" /></span>
              <p className="mt-3 font-semibold text-slate-900">ไม่พบหัวข้อที่ตรงกับ “{query}”</p>
              <p className="mt-1 text-sm text-slate-500">ลองคำที่สั้นลง หรือคำอื่นที่ใกล้เคียง</p>
              <button type="button" onClick={() => setQuery("")} className="mt-4 inline-flex min-h-10 items-center rounded-lg border border-slate-300 bg-white px-4 text-sm font-semibold text-slate-700 hover:bg-slate-50">ล้างคำค้นหา</button>
            </div>
          )}
        </div>
      </div>

      {showTop ? (
        <button type="button" onClick={() => (scrollerRef.current || window).scrollTo({ top: 0, behavior: "smooth" })} aria-label="กลับขึ้นด้านบน"
          className="fixed bottom-24 right-4 z-30 flex h-11 w-11 items-center justify-center rounded-full bg-[#0b4c86] text-white shadow-[0_12px_28px_-12px_rgba(11,76,134,.9)] hover:bg-[#083865] lg:bottom-6 print:hidden">
          <ArrowUp className="h-5 w-5" aria-hidden="true" />
        </button>
      ) : null}
    </div>
  );
}
