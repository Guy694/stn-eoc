"use client";
import { useState, useRef, useEffect } from 'react';

export default function AIChatbot() {
    const [isOpen, setIsOpen] = useState(false);
    const [messages, setMessages] = useState([]);
    const [inputMessage, setInputMessage] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const messagesEndRef = useRef(null);

    // Sample questions
    const sampleQuestions = [
        "สตูลประกาศเป็นพื้นที่ภัยพิบัติหรือยัง?",
        "แสดงข้อมูล EOC ตอนนี้",
        "มีกี่ตำบลในจังหวัดสตูล?"
    ];

    // Scroll to bottom when new messages arrive
    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages]);

    // Load conversation history from localStorage
    useEffect(() => {
        const saved = localStorage.getItem('chatbot_history');
        if (saved) {
            try {
                setMessages(JSON.parse(saved));
            } catch (e) {
                console.error('Failed to load chat history:', e);
            }
        }
    }, []);

    // Save conversation history to localStorage
    useEffect(() => {
        if (messages.length > 0) {
            localStorage.setItem('chatbot_history', JSON.stringify(messages));
        }
    }, [messages]);

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
                    content: `❌ เกิดข้อผิดพลาด: ${data.message || data.error}`,
                    timestamp: new Date().toISOString(),
                    isError: true
                };
                setMessages(prev => [...prev, errorMessage]);
            }
        } catch (error) {
            console.error('Chatbot error:', error);
            const errorMessage = {
                role: 'assistant',
                content: '❌ ไม่สามารถเชื่อมต่อกับ AI ได้ กรุณาลองใหม่อีกครั้ง',
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
        localStorage.removeItem('chatbot_history');
    };

    return (
        <>
            {/* Speech Bubble Tooltip - "Ask Me" */}
            {!isOpen && (
                <div className="fixed bottom-20 right-24 z-40 animate-float-subtle">
                    <div className="relative bg-white rounded-2xl shadow-xl px-4 py-3 border-2 border-green-500">
                        <div className="flex items-center gap-2">
                            <svg className="w-5 h-5 text-green-600 animate-wiggle" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                            </svg>
                            <p className="text-green-700 font-semibold text-sm whitespace-nowrap">
                                ถามฉันสิ! 💬
                            </p>
                        </div>
                        {/* Speech bubble arrow */}
                        <div className="absolute -right-2 bottom-4 w-4 h-4 bg-white border-r-2 border-b border-green-500 transform rotate-45"></div>
                    </div>
                </div>
            )}

            {/* Floating Bubble Button */}
            <button
                onClick={() => setIsOpen(!isOpen)}
                className={`fixed bottom-6 right-6 w-16 h-16 rounded-full shadow-2xl flex items-center justify-center transition-all duration-300 z-50 group ${isOpen
                    ? 'bg-red-600 hover:bg-red-700'
                    : 'bg-gradient-to-br from-green-600 to-green-700 hover:from-green-700 hover:to-green-800 hover:scale-110'
                    }`}
                aria-label={isOpen ? 'ปิด chatbot' : 'เปิด chatbot'}
            >
                {isOpen ? (
                    <svg className="w-8 h-8 text-white transition-transform duration-300 rotate-90" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                ) : (
                    <div className="relative">
                        {/* Robot Head */}
                        <svg className="w-9 h-9 text-white transition-transform duration-300 group-hover:scale-110" viewBox="0 0 64 64" fill="none">
                            {/* Antenna */}
                            <line x1="32" y1="8" x2="32" y2="16" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
                            <circle cx="32" cy="6" r="3" fill="currentColor" className="animate-pulse-glow" />

                            {/* Head */}
                            <rect x="16" y="16" width="32" height="28" rx="6" fill="currentColor" stroke="currentColor" strokeWidth="2" />

                            {/* Eyes */}
                            <circle cx="24" cy="28" r="4" fill="#10b981" className="animate-blink-eye" />
                            <circle cx="40" cy="28" r="4" fill="#10b981" className="animate-blink-eye" />

                            {/* Eye highlights */}
                            <circle cx="25" cy="27" r="1.5" fill="white" className="animate-blink-eye" />
                            <circle cx="41" cy="27" r="1.5" fill="white" className="animate-blink-eye" />

                            {/* Mouth */}
                            <path d="M 24 36 Q 32 40 40 36" stroke="#10b981" strokeWidth="2.5" strokeLinecap="round" fill="none" />

                            {/* Ears/Side panels */}
                            <rect x="12" y="24" width="4" height="12" rx="2" fill="currentColor" />
                            <rect x="48" y="24" width="4" height="12" rx="2" fill="currentColor" />

                            {/* Ear details */}
                            <circle cx="14" cy="30" r="1" fill="#10b981" />
                            <circle cx="50" cy="30" r="1" fill="#10b981" />
                        </svg>

                        {/* Pulse ring animation */}
                        <div className="absolute inset-0 rounded-full border-2 border-white/30 animate-ping-slow"></div>
                    </div>
                )}
            </button>

            {/* Chat Interface */}
            {isOpen && (
                <div className="fixed bottom-24 right-6 w-96 max-w-[calc(100vw-3rem)] h-[600px] max-h-[calc(100vh-8rem)] bg-white rounded-2xl shadow-2xl flex flex-col z-50 border border-gray-200">
                    {/* Header */}
                    <div className="bg-gradient-to-r from-green-600 to-green-700 text-white p-4 rounded-t-2xl flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 bg-white/20 rounded-full flex items-center justify-center">
                                <svg className="w-6 h-6 text-white" viewBox="0 0 64 64" fill="none">
                                    {/* Antenna */}
                                    <line x1="32" y1="8" x2="32" y2="16" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
                                    <circle cx="32" cy="6" r="3" fill="currentColor" />

                                    {/* Head */}
                                    <rect x="16" y="16" width="32" height="28" rx="6" fill="currentColor" stroke="currentColor" strokeWidth="2" />

                                    {/* Eyes */}
                                    <circle cx="24" cy="28" r="4" fill="#10b981" />
                                    <circle cx="40" cy="28" r="4" fill="#10b981" />

                                    {/* Eye highlights */}
                                    <circle cx="25" cy="27" r="1.5" fill="white" />
                                    <circle cx="41" cy="27" r="1.5" fill="white" />

                                    {/* Mouth */}
                                    <path d="M 24 36 Q 32 40 40 36" stroke="#10b981" strokeWidth="2.5" strokeLinecap="round" fill="none" />

                                    {/* Ears/Side panels */}
                                    <rect x="12" y="24" width="4" height="12" rx="2" fill="currentColor" />
                                    <rect x="48" y="24" width="4" height="12" rx="2" fill="currentColor" />

                                    {/* Ear details */}
                                    <circle cx="14" cy="30" r="1" fill="#10b981" />
                                    <circle cx="50" cy="30" r="1" fill="#10b981" />
                                </svg>
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
                            🗑️
                        </button>
                    </div>

                    {/* Messages Area */}
                    <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-gray-50">
                        {messages.length === 0 && (
                            <div className="text-center py-8">
                                <div className="text-6xl mb-4">👋</div>
                                <p className="text-gray-600 mb-4">สวัสดีครับ! ผมสามารถช่วยตอบคำถามเกี่ยวกับข้อมูลในระบบ EOC ได้</p>
                                <div className="space-y-2">
                                    <p className="text-sm text-gray-500 font-semibold">ตัวอย่างคำถาม:</p>
                                    {sampleQuestions.map((q, idx) => (
                                        <button
                                            key={idx}
                                            onClick={() => sendMessage(q)}
                                            className="block w-full text-left text-sm bg-white hover:bg-emerald-50 text-emerald-900 px-3 py-2 rounded-lg border border-gray-200 hover:border-emerald-300 transition-colors"
                                        >
                                            💬 {q}
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
                                <span>📤</span>
                            </button>
                        </div>
                        <p className="text-xs text-gray-500 mt-2 text-center">
                            💡 ลองถามเกี่ยวกับข้อมูล EOC, ผู้ป่วย, น้ำท่วม, หรืออุบัติเหตุ
                        </p>
                    </div>
                </div>
            )}
        </>
    );
}
