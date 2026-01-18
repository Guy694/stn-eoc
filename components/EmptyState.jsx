"use client";

export default function EmptyState({
    icon = "📭",
    title = "ไม่พบข้อมูล",
    message = "ยังไม่มีข้อมูลในขณะนี้",
    actionLabel,
    onAction,
    actionIcon
}) {
    return (
        <div className="flex flex-col items-center justify-center py-16 px-4">
            {/* Animated Icon */}
            <div className="mb-6 animate-bounce-slow">
                <div className="text-8xl opacity-50">
                    {icon}
                </div>
            </div>

            {/* Content */}
            <h3 className="text-2xl font-bold text-gray-800 mb-2 text-center">
                {title}
            </h3>
            <p className="text-gray-600 mb-8 text-center max-w-md">
                {message}
            </p>

            {/* Action Button */}
            {actionLabel && onAction && (
                <button
                    onClick={onAction}
                    className="bg-gradient-to-r from-green-600 to-green-700 hover:from-green-700 hover:to-green-800 text-white font-semibold py-3 px-8 rounded-xl shadow-lg hover:shadow-xl transition-all duration-200 hover:scale-105 flex items-center gap-2"
                >
                    {actionIcon && <span className="text-xl">{actionIcon}</span>}
                    <span>{actionLabel}</span>
                </button>
            )}
        </div>
    );
}

// Preset empty states for common scenarios
export function NoReportsEmptyState({ onReport }) {
    return (
        <EmptyState
            icon="🗺️"
            title="ยังไม่มีรายงานในขณะนี้"
            message="ไม่มีรายงานเหตุการณ์จากประชาชนในพื้นที่นี้ หากคุณพบเหตุการณ์ที่ต้องการรายงาน กรุณาแจ้งเหตุผ่านระบบ"
            actionLabel="แจ้งเหตุภัยพิบัติ"
            actionIcon="🚨"
            onAction={onReport}
        />
    );
}

export function NoResultsEmptyState({ onClearFilters }) {
    return (
        <EmptyState
            icon="🔍"
            title="ไม่พบผลลัพธ์"
            message="ไม่พบข้อมูลที่ตรงกับเงื่อนไขการค้นหา ลองปรับเปลี่ยนตัวกรองหรือล้างตัวกรองทั้งหมด"
            actionLabel="ล้างตัวกรอง"
            actionIcon="🔄"
            onAction={onClearFilters}
        />
    );
}

export function NetworkErrorEmptyState({ onRetry }) {
    return (
        <EmptyState
            icon="📡"
            title="ไม่สามารถโหลดข้อมูลได้"
            message="เกิดปัญหาในการเชื่อมต่อ กรุณาตรวจสอบอินเทอร์เน็ตและลองอีกครั้ง"
            actionLabel="ลองอีกครั้ง"
            actionIcon="🔄"
            onAction={onRetry}
        />
    );
}
