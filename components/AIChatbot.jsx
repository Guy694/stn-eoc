"use client";
import { useState, useRef, useEffect } from 'react';
import Link from 'next/link';
import AppIcon from './icons/AppIcon';

const CHATBOT_HISTORY_KEY = 'chatbot_history';
const CHATBOT_LAUNCHER_HIDDEN_KEY = 'chatbot_launcher_hidden';

export default function AIChatbot() {
    const [isOpen, setIsOpen] = useState(false);
    const [isLauncherHidden, setIsLauncherHidden] = useState(false);
    const [messages, setMessages] = useState([]);
    const [inputMessage, setInputMessage] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const messagesEndRef = useRef(null);

    // Sample questions
    const sampleQuestions = [
        "น้ำท่วมควรเตรียมตัวอย่างไร?",
        "ช่วงฝนตกหนักควรเฝ้าระวังอะไรบ้าง?",
        "ตอนนี้อยู่อำเภอเมือง จะไปอำเภอละงูได้หรือไม่?"
    ];
    const emergencyNumbers = [
        { number: '1669', label: 'แพทย์ฉุกเฉิน' },
        { number: '1784', label: 'ปภ.' },
        { number: '191', label: 'ตำรวจ' },
        { number: '199', label: 'ดับเพลิง' }
    ];

    // Scroll to bottom when new messages arrive
    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages]);

    // Load conversation history from localStorage
    useEffect(() => {
        const saved = localStorage.getItem(CHATBOT_HISTORY_KEY);
        if (saved) {
            try {
                setMessages(JSON.parse(saved));
            } catch (e) {
                console.error('Failed to load chat history:', e);
            }
        }
        setIsLauncherHidden(localStorage.getItem(CHATBOT_LAUNCHER_HIDDEN_KEY) === 'true');
    }, []);

    // Save conversation history to localStorage
    useEffect(() => {
        if (messages.length > 0) {
            localStorage.setItem(CHATBOT_HISTORY_KEY, JSON.stringify(messages));
        }
    }, [messages]);

    // Allow other public UI controls to open the assistant directly.
    useEffect(() => {
        const handleOpen = () => {
            setIsLauncherHidden(false);
            localStorage.setItem(CHATBOT_LAUNCHER_HIDDEN_KEY, 'false');
            setIsOpen(true);
        };
        window.addEventListener('eoc-assistant:open', handleOpen);
        return () => window.removeEventListener('eoc-assistant:open', handleOpen);
    }, []);

    const hideLauncher = () => {
        setIsOpen(false);
        setIsLauncherHidden(true);
        localStorage.setItem(CHATBOT_LAUNCHER_HIDDEN_KEY, 'true');
    };

    const sendMessage = async (text = inputMessage) => {
        if (!text.trim() || isLoading) return;

        const userMessage = {
            role: 'user',
            content: text,
            timestamp: new Date().toISOString()
        };

        setMessages(prev => [...prev, userMessage]);
        setInputMessage('');
        setIsLoading(true);

        try {
            const response = await fetch('/stn-eoc/api/chatbot/query', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    message: text,
                    conversationHistory: messages.slice(-5) // Send last 5 messages for context
                }),
            });

            const data = await response.json();

            if (data.success) {
                const aiMessage = {
                    role: 'assistant',
                    content: data.data.answer,
                    sql: data.data.sql,
                    resultCount: data.data.resultCount,
                    timestamp: new Date().toISOString()
                };
                setMessages(prev => [...prev, aiMessage]);
            } else {
                const errorMessage = {
                    role: 'assistant',
                    content: `เกิดข้อผิดพลาด: ${data.message || data.error}`,
                    timestamp: new Date().toISOString(),
                    isError: true
                };
                setMessages(prev => [...prev, errorMessage]);
            }
        } catch (error) {
            console.error('Chatbot error:', error);
            const errorMessage = {
                role: 'assistant',
                content: 'ไม่สามารถเชื่อมต่อกับ AI ได้ กรุณาลองใหม่อีกครั้ง',
                timestamp: new Date().toISOString(),
                isError: true
            };
            setMessages(prev => [...prev, errorMessage]);
        } finally {
            setIsLoading(false);
        }
    };

    const handleKeyPress = (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            sendMessage();
        }
    };

    const clearHistory = () => {
        setMessages([]);
        localStorage.removeItem(CHATBOT_HISTORY_KEY);
    };

    return (
        <>
            {/* Speech Bubble Tooltip - "Ask Me" */}
            {!isOpen && !isLauncherHidden && (
                <div className="fixed bottom-20 right-24 z-[1100] animate-float-subtle">
                    <div className="relative bg-white rounded-2xl shadow-xl px-4 py-3 border-2 border-green-500">
                        <div className="flex items-center gap-2">
                            <AppIcon icon="message" className="h-5 w-5 text-green-600 animate-wiggle" />
                            <p className="text-green-700 font-semibold text-sm whitespace-nowrap">
                                ถามฉันสิ!
                            </p>
                        </div>
                        {/* Speech bubble arrow */}
                        <div className="absolute -right-2 bottom-4 w-4 h-4 bg-white border-r-2 border-b border-green-500 transform rotate-45"></div>
                    </div>
                </div>
            )}

            {/* Floating Bubble Button */}
            {!isLauncherHidden && (
                <div className="fixed bottom-24 right-6 lg:bottom-6 z-[1100]">
                    {!isOpen && (
                        <button
                            type="button"
                            onClick={hideLauncher}
                            className="absolute -right-1 -top-1 z-10 flex h-6 w-6 items-center justify-center rounded-full border border-white bg-slate-800 text-sm font-black leading-none text-white shadow-lg transition-colors hover:bg-slate-950"
                            aria-label="ซ่อน EOC Assistant"
                            title="ซ่อน EOC Assistant"
                        >
                            <AppIcon icon="x" className="h-4 w-4" />
                        </button>
                    )}
                    <button
                        onClick={() => setIsOpen(!isOpen)}
                        className={`w-16 h-16 rounded-full shadow-2xl flex items-center justify-center transition-all duration-300 group ${isOpen
                            ? 'bg-red-600 hover:bg-red-700'
                            : 'bg-gradient-to-br from-green-600 to-green-700 hover:from-green-700 hover:to-green-800 hover:scale-110'
                            }`}
                        aria-label={isOpen ? 'ปิด chatbot' : 'เปิด chatbot'}
                    >
                        {isOpen ? (
                            <AppIcon icon="x" className="h-8 w-8 text-white transition-transform duration-300 rotate-90" />
                        ) : (
                            <div className="relative">
                                <AppIcon icon="bot" className="h-9 w-9 text-white transition-transform duration-300 group-hover:scale-110" />
                                <div className="absolute inset-0 rounded-full border-2 border-white/30 animate-ping-slow"></div>
                            </div>
                        )}
                    </button>
                </div>
            )}

            {/* Chat Interface */}
            {isOpen && (
                <div className="fixed bottom-40 right-6 lg:bottom-24 w-96 max-w-[calc(100vw-3rem)] h-[600px] max-h-[calc(100vh-8rem)] bg-white rounded-2xl shadow-2xl flex flex-col z-[1100] border border-gray-200">
                    {/* Header */}
                    <div className="bg-gradient-to-r from-green-600 to-green-700 text-white p-4 rounded-t-2xl flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 bg-white/20 rounded-full flex items-center justify-center">
                                <AppIcon icon="bot" className="h-6 w-6 text-white" />
                            </div>
                            <div>
                                <h3 className="font-bold text-lg">EOC Assistant</h3>
                                <p className="text-xs text-green-100">ผู้ช่วยตอบคำถามข้อมูล EOC</p>
                            </div>
                        </div>
                        <button
                            onClick={clearHistory}
                            className="text-white/80 hover:text-white text-sm px-2 py-1 rounded hover:bg-white/10 transition-colors"
                            title="ล้างประวัติการสนทนา"
                        >
                            <AppIcon icon="trash" className="h-5 w-5" />
                        </button>
                    </div>

                    {/* Messages Area */}
                    <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-gray-50">
                        {messages.length === 0 && (
                            <div className="text-center py-8">
                                <AppIcon icon="message" className="mx-auto mb-4 h-14 w-14 text-emerald-600" />
                                <p className="text-gray-600 mb-4">สวัสดีครับ! ผมช่วยตอบข้อมูล EOC โรค น้ำท่วม และสภาพฟ้าฝนได้</p>
                                <div className="mb-4 grid gap-2">
                                    <Link
                                        href="/public/report-incident"
                                        className="rounded-xl bg-red-600 px-4 py-3 text-sm font-black text-white shadow-sm transition hover:bg-red-700"
                                    >
                                        แจ้งขอความช่วยเหลือ
                                    </Link>
                                    <div className="rounded-xl border border-red-100 bg-red-50 p-3 text-left">
                                        <p className="mb-2 text-sm font-black text-red-900">เบอร์โทรฉุกเฉิน</p>
                                        <div className="grid grid-cols-2 gap-2">
                                            {emergencyNumbers.map((item) => (
                                                <a
                                                    key={item.number}
                                                    href={`tel:${item.number}`}
                                                    className="rounded-lg bg-white px-2 py-2 text-center text-xs font-bold text-red-800 shadow-sm hover:bg-red-100"
                                                >
                                                    <span className="block text-lg font-black">{item.number}</span>
                                                    {item.label}
                                                </a>
                                            ))}
                                        </div>
                                    </div>
                                </div>
                                <div className="space-y-2">
                                    <p className="text-sm text-gray-500 font-semibold">ตัวอย่างคำถาม:</p>
                                    {sampleQuestions.map((q, idx) => (
                                        <button
                                            key={idx}
                                            onClick={() => sendMessage(q)}
                                            className="block w-full text-left text-sm bg-white hover:bg-emerald-50 text-emerald-900 px-3 py-2 rounded-lg border border-gray-200 hover:border-emerald-300 transition-colors"
                                        >
                                            <span className="inline-flex items-center gap-2">
                                                <AppIcon icon="message" className="h-4 w-4" />
                                                {q}
                                            </span>
                                        </button>
                                    ))}
                                </div>
                            </div>
                        )}

                        {messages.map((msg, idx) => (
                            <div
                                key={idx}
                                className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
                            >
                                <div
                                    className={`max-w-[80%] rounded-2xl px-4 py-3 ${msg.role === 'user'
                                        ? 'bg-green-600 text-white rounded-br-none'
                                        : msg.isError
                                            ? 'bg-red-50 text-red-800 border border-red-200 rounded-bl-none'
                                            : 'bg-white text-gray-800 border border-gray-200 rounded-bl-none shadow-sm'
                                        }`}
                                >
                                    <div className="whitespace-pre-wrap break-words">{msg.content}</div>
                                    <div className="text-xs opacity-60 mt-1">
                                        {new Date(msg.timestamp).toLocaleTimeString('th-TH', {
                                            hour: '2-digit',
                                            minute: '2-digit'
                                        })}
                                    </div>
                                </div>
                            </div>
                        ))}

                        {isLoading && (
                            <div className="flex justify-start">
                                <div className="bg-white text-gray-800 border border-gray-200 rounded-2xl rounded-bl-none px-4 py-3 shadow-sm">
                                    <div className="flex items-center gap-2">
                                        <div className="flex gap-1">
                                            <div className="w-2 h-2 bg-green-600 rounded-full animate-pulse" style={{ animationDelay: '0ms' }}></div>
                                            <div className="w-2 h-2 bg-green-600 rounded-full animate-pulse" style={{ animationDelay: '150ms' }}></div>
                                            <div className="w-2 h-2 bg-green-600 rounded-full animate-pulse" style={{ animationDelay: '300ms' }}></div>
                                        </div>
                                        <span className="text-sm text-gray-600">กำลังคิด...</span>
                                    </div>
                                </div>
                            </div>
                        )}

                        <div ref={messagesEndRef} />
                    </div>

                    {/* Input Area */}
                    <div className="p-4 bg-white border-t border-gray-200 rounded-b-2xl">
                        <div className="flex gap-2">
                            <input
                                type="text"
                                value={inputMessage}
                                onChange={(e) => setInputMessage(e.target.value)}
                                onKeyPress={handleKeyPress}
                                placeholder="พิมพ์คำถามของคุณ..."
                                disabled={isLoading}
                                className="text-gray-600 flex-1 px-4 py-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent disabled:bg-gray-100 disabled:cursor-not-allowed"
                            />
                            <button
                                onClick={() => sendMessage()}
                                disabled={!inputMessage.trim() || isLoading}
                                className="bg-green-600 hover:bg-green-700 text-white px-6 py-3 rounded-xl font-semibold transition-colors disabled:bg-green-100 disabled:text-green-900 disabled:cursor-not-allowed flex items-center gap-2"
                            >
                                <span>ส่ง</span>
                                <AppIcon icon="send" className="h-4 w-4" />
                            </button>
                        </div>
                        <p className="mt-2 flex items-center justify-center gap-1 text-xs text-gray-500">
                            <AppIcon icon="lightbulb" className="h-3.5 w-3.5" />
                            <span>ลองถามเกี่ยวกับข้อมูล EOC, โรค/การระบาด, อุทกภัยน้ำท่วม, ฟ้าฝน หรือเส้นทาง</span>
                        </p>
                    </div>
                </div>
            )}
        </>
    );
}
