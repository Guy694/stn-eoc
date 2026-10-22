"use client";
import { createContext, useContext, useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";

const AuthContext = createContext();
const PASSWORD_CHANGE_PATH = '/settings';

function getAppPath() {
    if (typeof window === 'undefined') return '/';
    return window.location.pathname.replace(/^\/stn-eoc/, '').replace(/\/+$/, '') || '/';
}

// ข้อความเมื่อเซิร์ฟเวอร์ไม่ได้ส่งข้อความมา (เช่น proxy ตอบแทน)
export function loginFailureCode(status) {
    if (status === 401) return 'invalid_credentials';
    if (status === 429) return 'rate_limited';
    return status >= 500 ? 'server_error' : 'failed';
}

export function loginFailureMessage(status) {
    if (status === 401 || status === 400) return 'ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง';
    if (status === 429) return 'พยายามเข้าสู่ระบบหลายครั้งเกินไป กรุณารอสักครู่แล้วลองใหม่';
    if (status >= 500) return 'ระบบขัดข้องชั่วคราว กรุณาลองใหม่อีกครั้ง หากยังเข้าไม่ได้ติดต่อผู้ดูแลระบบ';
    return 'เข้าสู่ระบบไม่สำเร็จ';
}

export function AuthProvider({ children }) {
    const [user, setUser] = useState(null);
    const [loading, setLoading] = useState(true);
    const [idleWarning, setIdleWarning] = useState(false);
    const router = useRouter();

    const isPublicPath = useCallback(() => {
        if (typeof window === 'undefined') return false;
        const normalizedPath = window.location.pathname.replace(/^\/stn-eoc/, '') || '/';
        const publicPages = ['/', '/login', '/register', '/privacy-policy', '/auth/thaiid/callback', '/maintenance'];
        // ระหว่างปิดปรับปรุง proxy แสดงหน้าแจ้งปิดปรับปรุงแทนทุกหน้า (URL เดิม) — ไม่ต้องตรวจ session/ไม่ส่งไปหน้า login
        if (document.querySelector('[data-maintenance-page]')) return true;
        return normalizedPath.startsWith('/public/')
            || publicPages.some(page => normalizedPath === page || normalizedPath.startsWith(`${page}/`));
    }, []);

    const handleSessionExpired = useCallback((skipReload = false) => {
        localStorage.removeItem("sessionToken");
        localStorage.removeItem("user");
        setUser(null);
        setIdleWarning(false);

        // Redirect ไป login เฉพาะหน้าที่ต้อง authentication
        if (typeof window !== 'undefined' && !isPublicPath()) {
            if (!skipReload) {
                router.push('/login?timeout=true');
            }
        }
    }, [isPublicPath, router]);

    const validateSession = useCallback(async (skipReload = false) => {
        if (isPublicPath()) {
            setLoading(false);
            return;
        }

        try {
            const cookieResponse = await fetch('/stn-eoc/api/auth/session/');

            if (cookieResponse.ok) {
                const cookieData = await cookieResponse.json();

                if (cookieData.success && cookieData.user) {
                    // พบ server session จาก httpOnly cookie
                    setUser(cookieData.user);

                    // บัญชีที่ใช้รหัสผ่านชั่วคราวต้องเปลี่ยนรหัสผ่านก่อน (API อื่นจะตอบ 403 จนกว่าจะเปลี่ยน)
                    if (cookieData.user.mustChangePassword && getAppPath() !== PASSWORD_CHANGE_PATH) {
                        router.replace(`${PASSWORD_CHANGE_PATH}/?forcePasswordChange=1`);
                    }
                    if (cookieData.remainingMinutes !== undefined && cookieData.remainingMinutes <= 2 && cookieData.remainingMinutes > 0) {
                        setIdleWarning(true);
                    } else {
                        setIdleWarning(false);
                    }

                    setLoading(false);
                    return;
                }
            }

            handleSessionExpired(skipReload);

        } catch (error) {
            console.error('Error validating session:', error);
            handleSessionExpired(skipReload);
        } finally {
            setLoading(false);
        }
    }, [handleSessionExpired, isPublicPath, router]);

    // ตรวจสอบ session ทุก 1 นาที
    useEffect(() => {
        validateSession();

        const intervalId = setInterval(() => {
            validateSession();
        }, 60000);

        return () => clearInterval(intervalId);
    }, [validateSession]);

    const login = async (username, password) => {
        try {
            const response = await fetch('/stn-eoc/api/auth/login/', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username, password })
            });

            const data = await response.json().catch(() => ({}));

            // ใช้ข้อความจากเซิร์ฟเวอร์ (ชื่อผู้ใช้/รหัสผ่านผิด, รออนุมัติ, ถูกล็อก, ลองถี่เกินไป)
            if (!response.ok) {
                return { success: false, code: data.code || loginFailureCode(response.status), message: data.message || loginFailureMessage(response.status) };
            }

            if (data.success && data.user) {
                setUser(data.user);
                return { success: true, message: data.message, mustChangePassword: Boolean(data.user.mustChangePassword) };
            } else {
                return { success: false, code: data.code, message: data.message || 'เข้าสู่ระบบไม่สำเร็จ' };
            }
        } catch (error) {
            console.error('Login error:', error);
            return { success: false, code: 'network', message: 'เชื่อมต่อระบบไม่ได้ ตรวจสอบอินเทอร์เน็ตแล้วลองใหม่อีกครั้ง' };
        }
    };

    const logout = async () => {
        try {
            await fetch('/stn-eoc/api/auth/logout/', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' }
            });

            document.cookie = 'session_token=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;';

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
                            คุณไม่ได้ใช้งานมาระยะหนึ่ง ระบบจะออกจากระบบอัตโนมัติในอีก <span className="font-bold text-red-600">2 นาที</span> หากไม่มีการใช้งาน
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
