"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import {
  Anchor,
  Bot,
  CloudRain,
  Database,
  Hospital,
  MapPin,
  Phone,
  SearchCheck,
  SendHorizontal,
  ShieldAlert,
  Siren,
  Sparkles,
  Tent,
  Trash2,
  Umbrella,
  Waves,
  X
} from "lucide-react";
import HelpRequestLink from "@/components/public/HelpRequestLink";
import AssistantMascot, { AssistantAvatar } from "@/components/public/AssistantMascot";

// น้องสจ๊วต: ตอบเรื่องสถานการณ์ตอนนี้จากข้อมูลจริง (น้ำ ฝน ความเสี่ยง ศูนย์พักพิง) และความรู้ทั่วไปเรื่องน้ำท่วม/โรค
const HISTORY_KEY = "chatbot_history";
const LAUNCHER_HIDDEN_KEY = "chatbot_launcher_hidden";
const DISTRICT_KEY = "stn-eoc:my-district"; // ใช้ร่วมกับ "พื้นที่ของฉัน" ในหน้าแรก
const MAX_HISTORY = 40;

const DISTRICTS = ["เมืองสตูล", "ควนโดน", "ควนกาหลง", "ท่าแพ", "ละงู", "ทุ่งหว้า", "มะนัง"];

const QUICK_QUESTIONS = [
  { icon: Waves, text: "ระดับน้ำในคลองตอนนี้" },
  { icon: CloudRain, text: "ฝนตอนนี้เป็นยังไง" },
  { icon: Umbrella, text: "พรุ่งนี้ฝนจะตกหนักไหม" },
  { icon: ShieldAlert, text: "วันนี้อำเภอไหนเสี่ยงบ้าง" },
  { icon: Tent, text: "ศูนย์พักพิงที่เปิดอยู่" },
  { icon: Hospital, text: "โรงพยาบาลใกล้ฉันเปิดไหม" },
  { icon: Anchor, text: "น้ำทะเลหนุนวันนี้เป็นยังไง" },
  { icon: Sparkles, text: "ถ้าน้ำกำลังขึ้น ควรเตรียมตัวอย่างไร" },
  { icon: Hospital, text: "มีไข้หลังลุยน้ำ เป็นโรคฉี่หนูไหม" },
  { icon: ShieldAlert, text: "งูเข้าบ้านหรือถูกงูกัดทำยังไง" }
];

const SOURCE_STYLE = {
  database: { label: "ข้อมูลจริงจากระบบ", icon: Database, className: "bg-[#e3f1f4] text-[#11466e]" },
  calculated: { label: "คำนวณจากข้อมูลในระบบ", icon: Database, className: "bg-[#e3f1f4] text-[#11466e]" },
  ai_grounded: { label: "AI ตอบจากข้อมูลของระบบ", icon: Sparkles, className: "bg-[#efeafb] text-[#5b3a9e]" },
  general_guidance: { label: "คำแนะนำทั่วไปจาก AI", icon: Sparkles, className: "bg-slate-100 text-slate-600" },
  knowledge: { label: "คำแนะนำเบื้องต้นจากศูนย์ฯ", icon: Hospital, className: "bg-[#e8f5ec] text-[#166534]" }
};

function readStorage(key, fallback) {
  try {
    const value = window.localStorage.getItem(key);
    return value === null ? fallback : value;
  } catch {
    return fallback;
  }
}

function writeStorage(key, value) {
  try {
    if (value === null) window.localStorage.removeItem(key);
    else window.localStorage.setItem(key, value);
  } catch {
    // โหมดส่วนตัว: ใช้งานต่อได้ แค่ไม่จำ
  }
}

/** แสดงข้อความหลายบรรทัด: บรรทัดที่ขึ้นต้นด้วย • / ตัวเลข เป็นรายการ */
function MessageText({ text }) {
  const lines = String(text || "").split("\n");
  return (
    <div className="space-y-1.5 text-[15px] leading-7">
      {lines.map((line, index) => {
        const trimmed = line.trim();
        if (!trimmed) return <div key={index} className="h-1" aria-hidden="true" />;
        const bullet = trimmed.match(/^(•|\d+\.)\s*(.*)$/);
        if (bullet) {
          return (
            <div key={index} className="flex gap-2">
              <span className="mt-[0.7rem] h-1.5 w-1.5 shrink-0 rounded-full bg-[#2a9db0]" aria-hidden="true" />
              <span>{bullet[2]}</span>
            </div>
          );
        }
        return <p key={index}>{trimmed}</p>;
      })}
    </div>
  );
}

function ActionLink({ action, onNavigate }) {
  const base = "inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-semibold transition-colors";
  const tone = action.tone === "danger"
    ? "bg-[#c81e1e] text-white hover:bg-[#a51818]"
    : "bg-[#0b4c86] text-white hover:bg-[#083865]";
  if (action.href.startsWith("tel:")) {
    return <a href={action.href} className={`${base} ${tone}`}><Phone className="h-3.5 w-3.5" aria-hidden="true" />{action.label}</a>;
  }
  return <Link href={action.href} onClick={onNavigate} className={`${base} ${tone}`}>{action.label}</Link>;
}

export default function AIChatbot({ showLauncher = true, launcherRaised = false }) {
  const [isOpen, setIsOpen] = useState(false);
  const [launcherHidden, setLauncherHidden] = useState(false);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [district, setDistrict] = useState("");
  const endRef = useRef(null);
  const inputRef = useRef(null);

  useEffect(() => {
    try {
      const saved = JSON.parse(readStorage(HISTORY_KEY, "[]"));
      if (Array.isArray(saved)) setMessages(saved.slice(-MAX_HISTORY));
    } catch {
      // ประวัติเสีย: เริ่มใหม่
    }
    setLauncherHidden(readStorage(LAUNCHER_HIDDEN_KEY, "false") === "true");
    setDistrict(readStorage(DISTRICT_KEY, ""));
  }, []);

  useEffect(() => {
    if (messages.length) writeStorage(HISTORY_KEY, JSON.stringify(messages.slice(-MAX_HISTORY)));
  }, [messages]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages, loading, isOpen]);

  // ปุ่ม "ถามน้องสจ๊วต" ในหน้าอื่นเปิดหน้าต่างนี้ได้
  useEffect(() => {
    const open = () => {
      setLauncherHidden(false);
      writeStorage(LAUNCHER_HIDDEN_KEY, "false");
      setDistrict(readStorage(DISTRICT_KEY, ""));
      setIsOpen(true);
    };
    window.addEventListener("eoc-assistant:open", open);
    return () => window.removeEventListener("eoc-assistant:open", open);
  }, []);

  useEffect(() => {
    if (!isOpen) return undefined;
    const timer = window.setTimeout(() => inputRef.current?.focus(), 50);
    const onKey = (event) => { if (event.key === "Escape") setIsOpen(false); };
    document.addEventListener("keydown", onKey);
    return () => {
      window.clearTimeout(timer);
      document.removeEventListener("keydown", onKey);
    };
  }, [isOpen]);

  const changeDistrict = (value) => {
    setDistrict(value);
    writeStorage(DISTRICT_KEY, value || null);
  };

  const send = useCallback(async (text) => {
    const question = String(text || "").trim();
    if (!question || loading) return;
    const history = messages.slice(-6).map((item) => ({ role: item.role, content: item.content }));
    setMessages((current) => [...current, { role: "user", content: question, timestamp: new Date().toISOString() }]);
    setInput("");
    setLoading(true);
    try {
      const response = await fetch("/stn-eoc/api/chatbot/query", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: question, conversationHistory: history, userDistrict: district || null })
      });
      const json = await response.json().catch(() => ({}));
      if (!response.ok || !json.success) {
        throw new Error(json.message || json.error || "ตอบไม่ได้ในขณะนี้");
      }
      const data = json.data || {};
      setMessages((current) => [...current, {
        role: "assistant",
        content: data.answer,
        sourceType: data.source_type || null,
        sourceLabel: data.source_label || null,
        actions: Array.isArray(data.actions) ? data.actions.slice(0, 3) : [],
        suggestions: Array.isArray(data.suggestions) ? data.suggestions.slice(0, 3) : [],
        timestamp: new Date().toISOString()
      }]);
    } catch (error) {
      setMessages((current) => [...current, {
        role: "assistant",
        content: error.message === "Failed to fetch" ? "เชื่อมต่อไม่ได้ กรุณาลองใหม่อีกครั้งครับ" : `${error.message} กรุณาลองใหม่อีกครั้งครับ`,
        isError: true,
        timestamp: new Date().toISOString()
      }]);
    } finally {
      setLoading(false);
    }
  }, [district, loading, messages]);

  const onKeyDown = (event) => {
    if (event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing) {
      event.preventDefault();
      send(input);
    }
  };

  const clearHistory = () => {
    setMessages([]);
    writeStorage(HISTORY_KEY, null);
  };

  const hideLauncher = () => {
    setIsOpen(false);
    setLauncherHidden(true);
    writeStorage(LAUNCHER_HIDDEN_KEY, "true");
  };

  const lastAssistantIndex = messages.map((item) => item.role).lastIndexOf("assistant");

  return (
    <>
      {showLauncher && !launcherHidden && !isOpen && (
        <AssistantMascot onOpen={() => setIsOpen(true)} onHide={hideLauncher} raised={launcherRaised} />
      )}

      {isOpen && (
        <section
          role="dialog"
          aria-label="น้องสจ๊วต"
          className="eoc-assistant fixed inset-x-2 bottom-2 top-16 z-[1100] flex flex-col overflow-hidden rounded-[1.5rem] bg-[#eef2f1] shadow-[0_30px_60px_-20px_rgba(12,47,74,.55)] ring-1 ring-[#c9dcee] sm:inset-auto sm:bottom-6 sm:right-6 sm:h-[640px] sm:max-h-[calc(100dvh-7rem)] sm:w-[25rem]"
        >
          {/* หัว */}
          <header className="bg-[#0c2f4a] px-4 pb-3 pt-4 text-white">
            <div className="flex items-start justify-between gap-2">
              <div className="flex min-w-0 items-center gap-3">
                <span className="relative grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-white/10">
                  <span className="block h-full w-full overflow-hidden rounded-2xl"><AssistantAvatar /></span>
                  <span className="absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full bg-[#2fd0a8] ring-2 ring-[#0c2f4a]" aria-hidden="true" />
                </span>
                <div className="min-w-0">
                  <h2 className="font-[family-name:var(--font-kanit)] text-lg font-semibold leading-tight">น้องสจ๊วต ผู้ช่วยของคุณ</h2>
                  <p className="truncate text-xs text-[#9fc9d6]">ตอบจากข้อมูลน้ำ ฝน และศูนย์ช่วยเหลือของสตูล</p>
                </div>
              </div>
              <div className="flex shrink-0 items-center">
                {messages.length > 0 && (
                  <button type="button" onClick={clearHistory} className="rounded-full p-2 text-white/70 hover:bg-white/10 hover:text-white" aria-label="ล้างการสนทนา" title="ล้างการสนทนา">
                    <Trash2 className="h-4.5 w-4.5" />
                  </button>
                )}
                <button type="button" onClick={() => setIsOpen(false)} className="rounded-full p-2 text-white/70 hover:bg-white/10 hover:text-white" aria-label="ปิดน้องสจ๊วต">
                  <X className="h-5 w-5" />
                </button>
              </div>
            </div>
            <label className="mt-3 flex items-center gap-2 rounded-full bg-white/10 py-1 pl-3 pr-1 text-sm">
              <MapPin className="h-4 w-4 shrink-0 text-[#9fc9d6]" aria-hidden="true" />
              <span className="shrink-0 text-[#d5e7ec]">พื้นที่ของฉัน</span>
              <select
                value={district}
                onChange={(event) => changeDistrict(event.target.value)}
                className="min-w-0 flex-1 rounded-full bg-transparent py-1 pr-2 font-semibold text-white outline-none [&>option]:text-slate-900"
                aria-label="เลือกอำเภอของฉัน เพื่อให้ผู้ช่วยตอบตามพื้นที่"
              >
                <option value="">ทั้งจังหวัด</option>
                {DISTRICTS.map((name) => <option key={name} value={name}>อ.{name}</option>)}
              </select>
            </label>
          </header>

          {/* ข้อความ */}
          <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-4 py-4 [scrollbar-width:thin]" aria-live="polite">
            {messages.length === 0 && (
              <div>
                <div className="rounded-2xl bg-white p-4">
                  <p className="font-[family-name:var(--font-kanit)] text-lg font-semibold text-[#0c2f4a]">สวัสดีครับ อยากรู้อะไรเกี่ยวกับสตูลตอนนี้</p>
                  <p className="mt-1 text-sm leading-6 text-slate-600">
                    ผมดูระดับน้ำในคลอง ฝนที่วัดได้ ความเสี่ยงรายอำเภอ ศูนย์พักพิง และสถานพยาบาลให้ได้ทันที
                    {district ? ` โดยตอบตามพื้นที่ อ.${district}` : " เลือกพื้นที่ของคุณด้านบนเพื่อให้ตอบตรงจุดขึ้น"}
                  </p>
                </div>
                <p className="mb-2 mt-4 text-sm font-semibold text-slate-600">ถามเรื่องสำคัญตอนนี้</p>
                <div className="grid grid-cols-2 gap-2">
                  {QUICK_QUESTIONS.map(({ icon: Icon, text }) => (
                    <button
                      key={text}
                      type="button"
                      onClick={() => send(text)}
                      className="flex items-start gap-2 rounded-2xl bg-white p-3 text-left text-sm font-semibold leading-snug text-[#0c2f4a] ring-1 ring-transparent transition hover:ring-[#2a9db0]"
                    >
                      <Icon className="mt-0.5 h-4 w-4 shrink-0 text-[#2a9db0]" aria-hidden="true" />
                      {text}
                    </button>
                  ))}
                </div>
                <div className="mt-4 rounded-2xl bg-white p-3">
                  <p className="text-sm font-semibold text-[#b91c1c]">เหตุด่วน ไม่ต้องรอพิมพ์</p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    <a href="tel:1669" className="inline-flex items-center gap-1.5 rounded-full bg-[#c81e1e] px-3 py-1.5 text-sm font-semibold text-white hover:bg-[#a51818]"><Phone className="h-3.5 w-3.5" aria-hidden="true" /> 1669</a>
                    <a href="tel:1784" className="inline-flex items-center gap-1.5 rounded-full bg-[#c81e1e] px-3 py-1.5 text-sm font-semibold text-white hover:bg-[#a51818]"><Phone className="h-3.5 w-3.5" aria-hidden="true" /> 1784</a>
                    <HelpRequestLink
                      className="inline-flex items-center gap-1.5 rounded-full border border-[#c81e1e] px-3 py-1.5 text-sm font-semibold text-[#b91c1c] hover:bg-red-50"
                      disabledClassName="cursor-not-allowed opacity-50"
                    >
                      <Siren className="h-3.5 w-3.5" aria-hidden="true" /> ขอความช่วยเหลือ
                    </HelpRequestLink>
                    <Link href="/public/track" onClick={() => setIsOpen(false)} className="inline-flex items-center gap-1.5 rounded-full border border-[#0b4c86] px-3 py-1.5 text-sm font-semibold text-[#0b4c86] hover:bg-sky-50">
                      <SearchCheck className="h-3.5 w-3.5" aria-hidden="true" /> ติดตามคำขอ
                    </Link>
                  </div>
                </div>
              </div>
            )}

            {messages.map((message, index) => {
              if (message.role === "user") {
                return (
                  <div key={index} className="flex justify-end">
                    <div className="max-w-[85%] rounded-2xl rounded-br-md bg-[#0b4c86] px-4 py-2.5 text-[15px] leading-7 text-white">{message.content}</div>
                  </div>
                );
              }
              const source = SOURCE_STYLE[message.sourceType];
              const SourceIcon = source?.icon;
              return (
                <div key={index} className="flex gap-2">
                  <span className="mt-1 block h-7 w-7 shrink-0 overflow-hidden rounded-full bg-[#e3f1f4] ring-1 ring-[#c9dcee]" aria-hidden="true"><AssistantAvatar /></span>
                  <div className="min-w-0 max-w-[88%]">
                    <div className={`rounded-2xl rounded-tl-md px-4 py-3 ${message.isError ? "bg-red-50 text-red-900 ring-1 ring-red-200" : "bg-white text-[#15232e]"}`}>
                      <MessageText text={message.content} />
                      {source ? (
                        <p className={`mt-2 inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold ${source.className}`} title={message.sourceLabel || source.label}>
                          <SourceIcon className="h-3 w-3" aria-hidden="true" /> {message.sourceLabel || source.label}
                        </p>
                      ) : null}
                    </div>
                    {message.actions?.length > 0 && (
                      <div className="mt-2 flex flex-wrap gap-1.5">
                        {message.actions.map((action) => <ActionLink key={`${action.href}-${action.label}`} action={action} onNavigate={() => setIsOpen(false)} />)}
                      </div>
                    )}
                    {index === lastAssistantIndex && !loading && message.suggestions?.length > 0 && (
                      <div className="mt-2 flex flex-wrap gap-1.5" aria-label="คำถามที่เกี่ยวข้อง">
                        {message.suggestions.map((text) => (
                          <button key={text} type="button" onClick={() => send(text)} className="rounded-full bg-white px-3 py-1.5 text-sm text-[#11466e] ring-1 ring-[#c9dcee] hover:bg-[#e3f1f4]">
                            {text}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}

            {loading && (
              <div className="flex gap-2" role="status">
                <span className="mt-1 block h-7 w-7 shrink-0 overflow-hidden rounded-full bg-[#e3f1f4] ring-1 ring-[#c9dcee]" aria-hidden="true"><AssistantAvatar /></span>
                <div className="flex items-center gap-2 rounded-2xl rounded-tl-md bg-white px-4 py-3 text-sm text-slate-500">
                  <span className="flex gap-1" aria-hidden="true">
                    <span className="eoc-assistant__dot h-2 w-2 rounded-full bg-[#2a9db0]" />
                    <span className="eoc-assistant__dot h-2 w-2 rounded-full bg-[#2a9db0] [animation-delay:150ms]" />
                    <span className="eoc-assistant__dot h-2 w-2 rounded-full bg-[#2a9db0] [animation-delay:300ms]" />
                  </span>
                  กำลังดูข้อมูลล่าสุด…
                </div>
              </div>
            )}
            <div ref={endRef} />
          </div>

          {/* ช่องพิมพ์ */}
          <form
            onSubmit={(event) => { event.preventDefault(); send(input); }}
            className="border-t border-[#d6e3ea] bg-white px-3 pb-3 pt-2"
          >
            <div className="flex items-end gap-2 rounded-2xl bg-[#f3f7f8] p-1.5 ring-1 ring-[#d6e3ea] focus-within:ring-2 focus-within:ring-[#2a9db0]">
              <textarea
                ref={inputRef}
                value={input}
                onChange={(event) => setInput(event.target.value)}
                onKeyDown={onKeyDown}
                rows={1}
                maxLength={500}
                placeholder="พิมพ์คำถาม เช่น คลองละงูน้ำขึ้นไหม"
                aria-label="พิมพ์คำถามถึงน้องสจ๊วต"
                className="max-h-28 min-h-10 flex-1 resize-none bg-transparent px-2 py-2 text-[15px] text-[#15232e] outline-none placeholder:text-slate-400 [field-sizing:content]"
              />
              <button
                type="submit"
                disabled={!input.trim() || loading}
                className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-[#0b4c86] text-white transition-colors hover:bg-[#083865] disabled:bg-slate-300"
                aria-label="ส่งคำถาม"
              >
                <SendHorizontal className="h-5 w-5" />
              </button>
            </div>
            <p className="mt-1.5 text-center text-[11px] text-slate-500">ไม่ต้องพิมพ์ชื่อหรือเบอร์โทร • คำตอบประเมินอัตโนมัติ ไม่ใช่ประกาศทางราชการ • เหตุฉุกเฉินโทร 1669</p>
          </form>

          <style>{`
            .eoc-assistant { animation: eoc-assistant-in .22s cubic-bezier(.2,.8,.2,1) both; }
            @keyframes eoc-assistant-in { from { transform: translateY(16px); opacity: 0; } }
            .eoc-assistant__dot { animation: eoc-assistant-dot 1s ease-in-out infinite; }
            @keyframes eoc-assistant-dot { 0%, 100% { opacity: .3; } 50% { opacity: 1; } }
            @media (prefers-reduced-motion: reduce) { .eoc-assistant, .eoc-assistant__dot { animation: none; } }
          `}</style>
        </section>
      )}
    </>
  );
}
