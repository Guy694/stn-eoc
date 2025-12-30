"use client";
import { createContext, useContext, useState, useEffect } from 'react';
import { useAuth } from './AuthContext';

const EOCContext = createContext();

export function EOCProvider({ children }) {
    const { user } = useAuth();
    const [eocStatus, setEocStatus] = useState({
        flood: { is_active: false, description: '', activated_at: null },
        drought: { is_active: false, description: '', activated_at: null },
        tsunami: { is_active: false, description: '', activated_at: null },
        earthquake: { is_active: false, description: '', activated_at: null },
        disease: { is_active: false, description: '', activated_at: null }
    });
    const [loading, setLoading] = useState(true);

    // ดึงสถานะ EOC
    const fetchEOCStatus = async () => {
        try {
            const response = await fetch('/api/eoc/status');

            // ตรวจสอบว่า response สำเร็จก่อน parse JSON
            if (!response.ok) {
                console.error('Failed to fetch EOC status:', response.status);
                return;
            }

            const data = await response.json();

            if (data.success) {
                const statusMap = {};
                data.data.forEach(item => {
                    statusMap[item.eoc_type] = {
                        is_active: Boolean(item.is_active),
                        description: item.description,
                        activated_at: item.activated_at,
                        deactivated_at: item.deactivated_at,
                        activated_by_name: item.activated_by_name,
                        deactivated_by_name: item.deactivated_by_name
                    };
                });
                setEocStatus(statusMap);
            }
        } catch (error) {
            console.error('Error fetching EOC status:', error);
        } finally {
            setLoading(false);
        }
    };

    // โหลดสถานะ EOC เมื่อ component mount
    useEffect(() => {
        fetchEOCStatus();
        // Refresh ทุก 30 วินาที
        const interval = setInterval(fetchEOCStatus, 30000);
        return () => clearInterval(interval);
    }, []);

    // เปิด/ปิด EOC (admin only)
    const toggleEOC = async (eocType, isActive, description = '') => {
        if (!user || user.role !== 'admin') {
            throw new Error('ต้องมีสิทธิ์ admin เท่านั้น');
        }

        try {
            const response = await fetch('/api/eoc/status', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    eocType,
                    isActive,
                    userId: user.id,
                    description
                })
            });

            if (!response.ok) {
                console.error('Failed to toggle EOC:', response.status);
                return { success: false, message: 'ไม่สามารถอัพเดทสถานะ EOC ได้' };
            }

            const data = await response.json();

            if (data.success) {
                // อัพเดทสถานะใน state
                await fetchEOCStatus();
                return { success: true, message: data.message };
            } else {
                return { success: false, message: data.message };
            }
        } catch (error) {
            console.error('Error toggling EOC:', error);
            return { success: false, message: 'เกิดข้อผิดพลาดในการอัพเดทสถานะ EOC' };
        }
    };

    // ตรวจสอบว่า EOC เปิดอยู่หรือไม่
    const isEOCActive = (eocType) => {
        return eocStatus[eocType]?.is_active || false;
    };

    // ตรวจสอบว่าสามารถกรอกข้อมูลได้หรือไม่
    const canSubmitData = (eocType) => {
        // Admin สามารถกรอกได้เสมอ
        if (user?.role === 'admin') {
            return true;
        }
        // ผู้ใช้อื่นต้อง EOC เปิดอยู่
        return isEOCActive(eocType);
    };

    // ดึงรายการ EOC ที่เปิดอยู่
    const getActiveEOCs = () => {
        return Object.entries(eocStatus)
            .filter(([_, status]) => status.is_active)
            .map(([type, status]) => ({ type, ...status }));
    };

    // แปลงชื่อ EOC เป็นภาษาไทย
    const getEOCDisplayName = (eocType) => {
        const names = {
            flood: 'น้ำท่วม',
            drought: 'ภัยแล้ง',
            tsunami: 'สึนามิ',
            earthquake: 'แผ่นดินไหว',
            disease: 'โรคระบาด'
        };
        return names[eocType] || eocType;
    };

    const value = {
        eocStatus,
        loading,
        toggleEOC,
        isEOCActive,
        canSubmitData,
        getActiveEOCs,
        getEOCDisplayName,
        refreshStatus: fetchEOCStatus
    };

    return <EOCContext.Provider value={value}>{children}</EOCContext.Provider>;
}

export function useEOC() {
    const context = useContext(EOCContext);
    if (!context) {
        throw new Error('useEOC must be used within EOCProvider');
    }
    return context;
}
