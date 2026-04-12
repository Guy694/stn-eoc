"use client";
import { MapContainer, TileLayer, Marker, Popup, CircleMarker, LayerGroup } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { disasterTypeColors, severityColors } from "@/data/satunData";
import { useState, useRef, useEffect } from "react";
import { useFullscreenMap } from "@/components/FullscreenMapWrapper";

// แก้ไข icon default ของ Leaflet
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
    iconRetinaUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png",
    iconUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png",
    shadowUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png",
});

export default function DisasterMap({ events, onEventClick }) {
    const [showEventLabels, setShowEventLabels] = useState(true);
    const { isFullscreen, containerRef, buttonEl } = useFullscreenMap();

    // ศูนย์กลางของจังหวัดสตูล
    const satunCenter = [6.6238, 100.0673];

    // สร้าง custom icon ตามประเภทภัย
    const createCustomIcon = (event) => {
        let color = severityColors[event.severity] || "#6B7280";

        // For traffic reports, use color based on travelStatus
        if (event.reportType === 'traffic_report') {
            if (event.travelStatus === 'passable') {
                color = "#10B981"; // Green - ผ่านได้
            } else if (event.travelStatus === 'impassable') {
                color = "#EF4444"; // Red - ผ่านไม่ได้
            } else if (event.travelStatus === 'difficult') {
                color = "#F59E0B"; // Orange - ผ่านได้ยากลำบาก
            } else {
                color = "#6B7280"; // Gray - ไม่ระบุ
            }
        }

        return L.divIcon({
            className: "custom-div-icon",
            html: `
        <div style="
          background-color: ${color};
          width: 30px;
          height: 30px;
          border-radius: 50%;
          border: 3px solid white;
          box-shadow: 0 2px 8px rgba(0,0,0,0.3);
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 16px;
        ">
          ${getDisasterIcon(event)}
        </div>
      `,
            iconSize: [30, 30],
            iconAnchor: [15, 15],
        });
    };

    const getDisasterIcon = (event) => {
        // Check reportType first for citizen reports
        if (event.reportType === 'traffic_report') {
            return "🚦"; // Traffic light for traffic reports
        }
        if (event.reportType === 'help_request') {
            return "💧"; // Water drop for flood/help requests
        }

        // Fallback to disaster type
        const icons = {
            "น้ำท่วม": "💧",
            "ดินถ่ม": "⛰️",
            "พายุ": "🌪️",
            "ไฟป่า": "🔥",
            "แผ่นดินไหว": "📍",
        };
        return icons[event.type] || "⚠️";
    };

    // สร้าง label icon
    const createLabelIcon = (text) => {
        return L.divIcon({
            className: 'label-icon',
            html: `<div style="
                font-size: 11px;
                color: #1F2937;
                font-weight: 500;
                background-color: rgba(255, 255, 255, 0.85);
                padding: 2px 6px;
                border-radius: 4px;
                border: 1px solid rgba(239, 68, 68, 0.5);
                text-shadow: 1px 1px 2px rgba(255,255,255,0.8);
                white-space: nowrap;
            ">${text}</div>`,
            iconSize: null,
            iconAnchor: [0, 0]
        });
    };

    return (
        <div
            ref={containerRef}
            className={`relative w-full h-full ${isFullscreen ? 'fixed inset-0 z-[99999]' : ''}`}
            style={isFullscreen ? { height: '100vh' } : {}}
        >
            {buttonEl}
            <MapContainer
                center={satunCenter}
                zoom={10}
                style={{ height: "100%", width: "100%", borderRadius: "8px" }}
                className="z-0"
            >
                <TileLayer
                    attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                    url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                />

                {/* แสดง Markers สำหรับแต่ละเหตุการณ์ */}
                {events.map((event) => (
                    <Marker
                        key={event.id}
                        position={[event.lat, event.lng]}
                        icon={createCustomIcon(event)}
                        eventHandlers={{
                            click: () => {
                                if (onEventClick) onEventClick(event);
                            },
                        }}
                    >
                        <Popup>
                            <div className="p-2 min-w-[200px]">
                                <h3 className="font-bold text-gray-800 mb-2">{event.type}</h3>
                                <div className="space-y-1 text-sm">
                                    <p>
                                        <span className="font-semibold">ระดับ:</span>{" "}
                                        <span
                                            className={`px-2 py-0.5 rounded text-xs ${event.severity === "สูง"
                                                ? "bg-red-100 text-red-700"
                                                : event.severity === "ปานกลาง"
                                                    ? "bg-yellow-100 text-yellow-700"
                                                    : "bg-green-100 text-green-700"
                                                }`}
                                        >
                                            {event.severity}
                                        </span>
                                    </p>
                                    <p>
                                        <span className="font-semibold">พื้นที่:</span> ต.{event.tambon} อ.{event.district}
                                    </p>
                                    <p>
                                        <span className="font-semibold">หมู่บ้าน:</span> {event.village}
                                    </p>
                                    <p>
                                        <span className="font-semibold">วันที่:</span> {event.date}
                                    </p>
                                    <p className="text-gray-600 mt-2">{event.description}</p>
                                    <p className="text-orange-600 font-semibold">
                                        ผู้ได้รับผลกระทบ: {event.affected} คน
                                    </p>
                                </div>
                            </div>
                        </Popup>
                    </Marker>
                ))}

                {/* แสดงชื่อเหตุการณ์ */}
                {showEventLabels && (
                    <LayerGroup>
                        {events.map((event) => (
                            <Marker
                                key={`label-${event.id}`}
                                position={[event.lat + 0.01, event.lng]}
                                icon={createLabelIcon(`${event.type} (${event.tambon})`)}
                            />
                        ))}
                    </LayerGroup>
                )}
            </MapContainer>

            {/* Control สำหรับแสดง/ซ่อน labels */}
            <div className="absolute top-4 right-20 bg-white p-3 rounded-lg shadow-lg z-[1000]">
                <label className="flex items-center gap-2 text-sm cursor-pointer">
                    <input
                        type="checkbox"
                        checked={showEventLabels}
                        onChange={(e) => setShowEventLabels(e.target.checked)}
                        className="w-4 h-4 text-red-600 rounded"
                    />
                    <span>แสดงชื่อเหตุการณ์</span>
                </label>
            </div>
        </div>
    );
}
