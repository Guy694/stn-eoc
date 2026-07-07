"use client";
import { createContext, useContext, useState, useEffect } from 'react';
import { useAuth } from './AuthContext';
import { formatEocDisplayName } from '@/lib/eocDisplay';

const EOCContext = createContext();

export function EOCProvider({ children }) {
    const { user } = useAuth();
    const [eocStatus, setEocStatus] = useState({});
    const [eocTypes, setEocTypes] = useState([]);
    const [loading, setLoading] = useState(true);

    // ดึงสถานะ EOC
    const fetchEOCStatus = async () => {
        try {
            const response = await fetch('/stn-eoc/api/eoc/status/');

            // ตรวจสอบว่า response สำเร็จก่อน parse JSON
            if (!response.ok) {
                console.error('Failed to fetch EOC status:', response.status);
                return;
            }

            const data = await response.json();

            if (data.success) {
                const statusMap = {};
                const typesList = [];
                data.data.forEach(item => {
                    statusMap[item.eoc_type] = {
                        is_active: Boolean(item.is_active),
                        description: item.description,
                        activated_at: item.session_opened_at || item.activated_at,
                        deactivated_at: item.deactivated_at,
                        activated_by_name: item.activated_by_name,
                        deactivated_by_name: item.deactivated_by_name,
                        open_order_file_path: item.open_order_file_path,
                        open_order_file_name: item.open_order_file_name,
                        name_th: item.name_th,
                        name_en: item.name_en,
                        icon: item.icon,
                        color_primary: item.color_primary,
                        color_gradient: item.color_gradient,
                        session_id: item.session_id,
                        session_number: item.session_number,
                        session_opened_at: item.session_opened_at,
                        session_status: item.session_status,
                        disease_id: item.disease_id,
                        disease_name: item.disease_name
                    };
                    typesList.push(item.eoc_type);
                });
                setEocStatus(statusMap);
                setEocTypes(typesList);
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
    const toggleEOC = async (eocType, isActive, description = '', festivalType = null, options = {}) => {
        if (!user || user.role !== 'admin') {
            throw new Error('ต้องมีสิทธิ์ admin เท่านั้น');
        }

        try {
            const shouldUseFormData = Boolean(options.openedAt || options.closedAt || options.orderFile);
            let requestOptions;

            if (shouldUseFormData) {
                const formData = new FormData();
                formData.append('eocType', eocType);
                formData.append('isActive', String(isActive));
                formData.append('description', description || '');
                if (festivalType) formData.append('festivalType', festivalType);
                if (options.diseaseId) formData.append('diseaseId', options.diseaseId);
                if (options.diseaseName) formData.append('diseaseName', options.diseaseName);
                if (options.openedAt) formData.append('openedAt', options.openedAt);
                if (options.closedAt) formData.append('closedAt', options.closedAt);
                if (options.orderFile) formData.append('orderFile', options.orderFile);

                requestOptions = {
                    method: 'POST',
                    body: formData
                };
            } else {
                requestOptions = {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        eocType,
                        isActive,
                        userId: user.id,
                        description,
                        festivalType,
                        diseaseId: options.diseaseId || null,
                        diseaseName: options.diseaseName || null,
                        closedAt: options.closedAt || null
                    })
                };
            }

            const response = await fetch('/stn-eoc/api/eoc/status/', {
                ...requestOptions
            });

            if (!response.ok) {
                console.error('Failed to toggle EOC:', response.status);
                let backendMessage = 'ไม่สามารถอัพเดทสถานะ EOC ได้';
                try {
                    const errorData = await response.json();
                    if (errorData?.message) {
                        backendMessage = errorData.message;
                    }
                } catch {
                    // Ignore JSON parse errors and keep fallback message.
                }
                return { success: false, message: backendMessage };
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
        return formatEocDisplayName({
            eoc_type: eocType,
            ...(eocStatus[eocType] || {})
        });
    };

    const value = {
        eocStatus,
        eocTypes,
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
