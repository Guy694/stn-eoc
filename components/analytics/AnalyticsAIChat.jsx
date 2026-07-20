"use client";

import { useEffect, useRef, useState } from "react";
import { Bot, LoaderCircle, Send, Trash2, UserRound } from "lucide-react";

const HISTORY_KEY = "analytics_ai_history";
const SUGGESTIONS = [
    "สรุปสถานการณ์ EOC ปัจจุบันและสิ่งที่ควรทำต่อ",
    "ทีมใดควรเสริมกำลังคนก่อน เพราะอะไร",
    "มีเวชภัณฑ์ใดที่ควรเร่งจัดหา",
    "แนวโน้มโรคในแต่ละอำเภอเป็นอย่างไร"
];

export default function AnalyticsAIChat() {
    const [messages, setMessages] = useState([]);
    const [input, setInput] = useState("");
    const [loading, setLoading] = useState(false);
    const endRef = useRef(null);

    useEffect(() => {
        try {
            const saved = localStorage.getItem(HISTORY_KEY);
            if (saved) setMessages(JSON.parse(saved));
        } catch {
            localStorage.removeItem(HISTORY_KEY);
        }
    }, []);

    useEffect(() => {
        localStorage.setItem(HISTORY_KEY, JSON.stringify(messages.slice(-30)));
        endRef.current?.scrollIntoView({ behavior: "smooth" });
    }, [messages]);

    const ask = async (question = input) => {
        const text = question.trim();
        if (!text || loading) return;
        const nextMessages = [...messages, { role: "user", content: text }];
        setMessages(nextMessages);
        setInput("");
        setLoading(true);

        try {
            const response = await fetch("/stn-eoc/api/chatbot/query", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    message: text,
                    conversationHistory: nextMessages.slice(-6)
                })
            });
            const payload = await response.json();
            if (!response.ok || !payload.success) throw new Error(payload.message || payload.error || "AI ไม่สามารถตอบคำถามได้");
            setMessages((current) => [...current, { role: "assistant", content: payload.data.answer }]);
        } catch (error) {
            setMessages((current) => [...current, { role: "assistant", content: error.message, error: true }]);
        } finally {
            setLoading(false);
        }
    };

    return (
        <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
            <header className="flex items-center justify-between border-b border-slate-200 bg-slate-900 px-5 py-4 text-white">
                <div className="flex items-center gap-3">
                    <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-500/20 text-emerald-300">
                        <Bot className="h-5 w-5" />
                    </span>
                    <div>
                        <h2 className="font-bold">AI วิเคราะห์ข้อมูล EOC</h2>
                        <p className="text-xs text-slate-300">ถามข้อมูลภาพรวม ทีม เวชภัณฑ์ และโรคระบาด</p>
                    </div>
                </div>
                <button
                    type="button"
                    onClick={() => setMessages([])}
                    className="rounded-lg p-2 text-slate-300 transition hover:bg-white/10 hover:text-white"
                    aria-label="ล้างประวัติสนทนา"
                >
                    <Trash2 className="h-4 w-4" />
                </button>
            </header>

            <div className="h-[430px] space-y-4 overflow-y-auto bg-slate-50 p-4 sm:p-5">
                {!messages.length && (
                    <div className="rounded-xl border border-emerald-100 bg-emerald-50 p-4">
                        <p className="font-semibold text-emerald-900">เริ่มวิเคราะห์ด้วยคำถามตัวอย่าง</p>
                        <div className="mt-3 grid gap-2 sm:grid-cols-2">
                            {SUGGESTIONS.map((suggestion) => (
                                <button
                                    key={suggestion}
                                    type="button"
                                    onClick={() => ask(suggestion)}
                                    className="rounded-lg border border-emerald-200 bg-white px-3 py-2 text-left text-sm text-emerald-800 transition hover:border-emerald-400 hover:bg-emerald-100"
                                >
                                    {suggestion}
                                </button>
                            ))}
                        </div>
                    </div>
                )}

                {messages.map((message, index) => (
                    <div key={`${message.role}-${index}`} className={`flex gap-3 ${message.role === "user" ? "justify-end" : "justify-start"}`}>
                        {message.role === "assistant" && <Bot className="mt-2 h-5 w-5 shrink-0 text-emerald-600" />}
                        <div className={`max-w-[85%] whitespace-pre-wrap rounded-2xl px-4 py-3 text-sm leading-6 ${message.role === "user"
                            ? "bg-slate-900 text-white"
                            : message.error ? "border border-red-200 bg-red-50 text-red-700" : "border border-slate-200 bg-white text-slate-700"
                            }`}>
                            {message.content}
                        </div>
                        {message.role === "user" && <UserRound className="mt-2 h-5 w-5 shrink-0 text-slate-500" />}
                    </div>
                ))}
                {loading && (
                    <div className="flex items-center gap-2 text-sm text-slate-500">
                        <LoaderCircle className="h-4 w-4 animate-spin" /> กำลังวิเคราะห์ข้อมูล...
                    </div>
                )}
                <div ref={endRef} />
            </div>

            <form
                className="flex gap-2 border-t border-slate-200 p-4"
                onSubmit={(event) => {
                    event.preventDefault();
                    ask();
                }}
            >
                <textarea
                    value={input}
                    onChange={(event) => setInput(event.target.value)}
                    onKeyDown={(event) => {
                        if (event.key === "Enter" && !event.shiftKey) {
                            event.preventDefault();
                            ask();
                        }
                    }}
                    rows={2}
                    placeholder="ถามคำถามเกี่ยวกับข้อมูล EOC..."
                    className="min-h-12 flex-1 resize-none rounded-xl border border-slate-300 px-3 py-2 text-sm text-slate-800 outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
                />
                <button
                    type="submit"
                    disabled={loading || !input.trim()}
                    className="flex h-12 w-12 items-center justify-center rounded-xl bg-emerald-600 text-white transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-50"
                    aria-label="ส่งคำถาม"
                >
                    <Send className="h-5 w-5" />
                </button>
            </form>
        </section>
    );
}
