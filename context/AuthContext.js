"use client";
import { createContext, useContext, useState, useEffect } from "react";

const AuthContext = createContext();

export function AuthProvider({ children }) {
    const [user, setUser] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        // ตรวจสอบ session จาก localStorage
        const storedUser = localStorage.getItem("user");
        if (storedUser) {
            setUser(JSON.parse(storedUser));
        }
        setLoading(false);
    }, []);

    const login = (userData) => {
        setUser(userData);
        localStorage.setItem("user", JSON.stringify(userData));
    };

    const logout = () => {
        setUser(null);
        localStorage.removeItem("user");
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

    const canAccessResources = () => {
        // เฉพาะ admin เท่านั้นที่เข้าถึงทรัพยากรได้
        return user?.role === 'admin';
    };

    const canAccessReports = () => {
        // เฉพาะ admin เท่านั้นที่เข้าถึงรายงานได้
        return user?.role === 'admin';
    };

    return (
        <AuthContext.Provider value={{
            user,
            login,
            logout,
            loading,
            hasAccess,
            canAccessResources,
            canAccessReports
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
