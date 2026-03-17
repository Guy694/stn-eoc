"use client";
import { createContext, useContext, useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";

const AuthContext = createContext();

export function AuthProvider({ children }) {
    const [user, setUser] = useState(null);
    const [loading, setLoading] = useState(true);
    const [idleWarning, setIdleWarning] = useState(false);
    const router = useRouter();

    // ตรวจสอบ session ทุก 1 นาที
    useEffect(() => {
        // ตรวจสอบ session ทั้งจาก localStorage และ cookie
        validateSession();

        // ตั้ง interval ตรวจสอบทุก 1 นาที
        const intervalId = setInterval(() => {
            validateSession();
        }, 60000); // 60 วินาที

        return () => clearInterval(intervalId);
    }, []);

    const validateSession = async (skipReload = false) => {
        try {
            // 1. ตรวจสอบจาก cookie ก่อน (สำหรับ ThaiID login)
            const cookieResponse = await fetch('/stn-eoc/api/auth/session/');

            if (cookieResponse.ok) {
                const cookieData = await cookieResponse.json();

                if (cookieData.success && cookieData.user) {
                    // พบ session ใน cookie -> บันทึกลง localStorage เพื่อใช้ต่อ
                    setUser(cookieData.user);
                    localStorage.setItem("user", JSON.stringify(cookieData.user));

                    // สร้าง sessionToken เฉพาะครั้งแรก (ถ้ายังไม่มี)
                    const sessionToken = localStorage.getItem("sessionToken");
                    if (!sessionToken) {
                        const thaiIdToken = `thaiid_${Date.now()}_${Math.random().toString(36).substring(7)}`;
                        localStorage.setItem("sessionToken", thaiIdToken);
                    }

                    setLoading(false);
                    return;
                }
            }

            // 2. ถ้าไม่มีใน cookie ให้ลองตรวจสอบจาก localStorage (สำหรับ username/password login)
            const sessionToken = localStorage.getItem("sessionToken");
            const storedUser = localStorage.getItem("user");

            if (sessionToken && storedUser) {
                // มี session ใน localStorage
                const response = await fetch('/stn-eoc/api/auth/validate/', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ sessionToken })
                });

                if (!response.ok) {
                    // 401 เป็นกรณีปกติเมื่อ session หมดอายุหรือไม่ valid
                    if (response.status === 401) {
                        console.log('Session expired or invalid');
                    } else {
                        console.error('Failed to validate session:', response.status);
                    }
                    localStorage.removeItem('sessionToken');
                    localStorage.removeItem('user');
                    setUser(null);
                    setLoading(false);
                    return;
                }

                const data = await response.json();

                if (data.success && data.user) {
                    setUser(data.user);
                    setLoading(false);

                    // แสดง warning ถ้าเหลือเวลาน้อยกว่า 2 นาที
                    if (data.remainingMinutes !== undefined && data.remainingMinutes <= 2 && data.remainingMinutes > 0) {
                        setIdleWarning(true);
                    } else {
                        setIdleWarning(false);
                    }

                    return;
                } else if (data.sessionExpired || data.idleTimeout) {
                    // Session หมดอายุ - ล้างข้อมูลและ redirect
                    handleSessionExpired(skipReload);
                    return;
                }
            }

            // 3. ไม่พบ session ทั้ง 2 แบบ
            handleSessionExpired(skipReload);

        } catch (error) {
            console.error('Error validating session:', error);
            handleSessionExpired(skipReload);
        } finally {
            setLoading(false);
        }
    };

    const handleSessionExpired = useCallback((skipReload = false) => {
        localStorage.removeItem("sessionToken");
        localStorage.removeItem("user");
        setUser(null);
        setIdleWarning(false);

        // หน้าสาธารณะที่ไม่ต้อง redirect
        const publicPages = ['/', '/login', '/auth/thaiid'];
        const currentPath = typeof window !== 'undefined' ? window.location.pathname : '';
        const isPublicPage = publicPages.some(page => currentPath === page || currentPath.startsWith(page));

        // Redirect ไป login เฉพาะหน้าที่ต้อง authentication
        if (typeof window !== 'undefined' && !isPublicPage) {
            if (!skipReload) {
                router.push('/login?timeout=true');
            }
        }
    }, [router]);

    const login = async (username, password) => {
        try {
            const response = await fetch('/stn-eoc/api/auth/login/', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username, password })
            });

            if (!response.ok) {
                const errorText = await response.text();
                console.error('Login failed:', response.status, errorText);
                return { success: false, message: 'เกิดข้อผิดพลาดในการเข้าสู่ระบบ' };
            }

            const data = await response.json();

            if (data.success && data.user) {
                setUser(data.user);
                localStorage.setItem("sessionToken", data.sessionToken);
                localStorage.setItem("user", JSON.stringify(data.user));
                return { success: true, message: data.message };
            } else {
                return { success: false, message: data.message || 'เข้าสู่ระบบไม่สำเร็จ' };
            }
        } catch (error) {
            console.error('Login error:', error);
            return { success: false, message: 'เกิดข้อผิดพลาดในการเข้าสู่ระบบ' };
        }
    };

    const logout = async () => {
        try {
            const sessionToken = localStorage.getItem("sessionToken");
            if (sessionToken) {
                await fetch('/stn-eoc/api/auth/logout/', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ sessionToken })
                });
            }

            // ลบ cookie ด้วย (สำหรับ ThaiID session)
            document.cookie = 'user_session=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;';

        } catch (error) {
            console.error('Logout error:', error);
        } finally {
            setUser(null);
            localStorage.removeItem("sessionToken");
            localStorage.removeItem("user");

            // Redirect ไปหน้า index
            if (typeof window !== 'undefined') {
                router.push('/');
            }
        }
    };

    const hasAccess = (requiredRole) => {
        if (!user) return false;

        // admin มีสิทธิ์เข้าถึงทุกอย่าง
        if (user.role === 'admin') return true;

        // ตรวจสอบ role ตรงกัน
        if (Array.isArray(requiredRole)) {
            return requiredRole.includes(user.role);
        }
        return user.role === requiredRole;
    };

    const hasPermission = (module, action) => {
        if (!user || !user.permissions) return false;

        // admin มีสิทธิ์ทั้งหมด
        if (user.role === 'admin') return true;

        const modulePermissions = user.permissions[module];
        if (!modulePermissions) return false;

        // ถ้าเป็น boolean
        if (typeof modulePermissions === 'boolean') {
            return modulePermissions;
        }

        // ถ้าเป็น object ที่มี action เฉพาะ
        if (typeof modulePermissions === 'object') {
            return modulePermissions[action] === true;
        }

        return false;
    };

    const canAccessResources = () => {
        return hasPermission('admin', 'view');
    };

    const canAccessReports = () => {
        return hasPermission('reports', 'view');
    };

    const canCreateEOCData = () => {
        return hasPermission('eoc', 'create');
    };

    const canEditEOCData = () => {
        return hasPermission('eoc', 'edit');
    };

    const canDeleteEOCData = () => {
        return hasPermission('eoc', 'delete');
    };

    return (
        <AuthContext.Provider value={{
            user,
            setUser,
            login,
            logout,
            loading,
            idleWarning,
            hasAccess,
            hasPermission,
            canAccessResources,
            canAccessReports,
            canCreateEOCData,
            canEditEOCData,
            canDeleteEOCData,
            validateSession
        }}>
            {children}

            {/* Idle Warning Modal */}
            {idleWarning && (
                <div className="fixed inset-0  backdrop-blur-md bg-white/30 flex items-center justify-center z-50">
                    <div className="bg-white rounded-lg p-6 max-w-md mx-4 shadow-xl">
                        <div className="flex items-center gap-3 mb-4">
                            <div className="w-12 h-12 bg-yellow-100 rounded-full flex items-center justify-center">
                                <svg className="w-6 h-6 text-yellow-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                                </svg>
                            </div>
                            <div>
                                <h3 className="text-lg font-bold text-gray-800">⚠️ คำเตือน</h3>
                                <p className="text-sm text-gray-600">Session กำลังจะหมดอายุ</p>
                            </div>
                        </div>
                        <p className="text-gray-700 mb-4">
                            คุณไม่ได้ใช้งานเกินกว่า 8 นาที ระบบจะออกจากระบบอัตโนมัติในอีก <span className="font-bold text-red-600">2 นาที</span> หากไม่มีการใช้งาน
                        </p>
                        <div className="flex gap-3">
                            <button
                                onClick={() => {
                                    setIdleWarning(false);
                                    validateSession();
                                }}
                                className="flex-1 bg-green-600 hover:bg-green-700 text-white font-semibold py-2 px-4 rounded-lg transition-colors"
                            >
                                ใช้งานต่อ
                            </button>
                            <button
                                onClick={logout}
                                className="flex-1 bg-gray-200 hover:bg-gray-300 text-gray-700 font-semibold py-2 px-4 rounded-lg transition-colors"
                            >
                                ออกจากระบบ
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </AuthContext.Provider>
    );
}

export function useAuth() {
    const context = useContext(AuthContext);
    if (!context) {
        throw new Error("useAuth must be used within AuthProvider");
    }
    return context;
}
