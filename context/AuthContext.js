"use client";
import { createContext, useContext, useState, useEffect } from "react";

const AuthContext = createContext();

export function AuthProvider({ children }) {
    const [user, setUser] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        // ตรวจสอบ session จาก localStorage
        validateSession();
    }, []);

    const validateSession = async () => {
        try {
            const sessionToken = localStorage.getItem("sessionToken");
            if (!sessionToken) {
                setLoading(false);
                return;
            }

            const response = await fetch('/api/auth/validate', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ sessionToken })
            });

            const data = await response.json();

            if (data.success && data.user) {
                setUser(data.user);
            } else {
                // Session หมดอายุ
                localStorage.removeItem("sessionToken");
                localStorage.removeItem("user");
                setUser(null);
            }
        } catch (error) {
            console.error('Error validating session:', error);
            localStorage.removeItem("sessionToken");
            localStorage.removeItem("user");
            setUser(null);
        } finally {
            setLoading(false);
        }
    };

    const login = async (username, password) => {
        try {
            const response = await fetch('/api/auth/login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username, password })
            });

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
                await fetch('/api/auth/logout', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ sessionToken })
                });
            }
        } catch (error) {
            console.error('Logout error:', error);
        } finally {
            setUser(null);
            localStorage.removeItem("sessionToken");
            localStorage.removeItem("user");
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
            login,
            logout,
            loading,
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
