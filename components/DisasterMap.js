"use client";
import { MapContainer, TileLayer, Marker, Popup, CircleMarker } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { disasterTypeColors, severityColors } from "@/data/satunData";

// แก้ไข icon default ของ Leaflet
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
    iconRetinaUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png",
    iconUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png",
    shadowUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png",
});

export default function DisasterMap({ events, onEventClick }) {
    // ศูนย์กลางของจังหวัดสตูล
    const satunCenter = [6.6238, 100.0673];

    // สร้าง custom icon ตามประเภทภัย
    const createCustomIcon = (event) => {
        const color = severityColors[event.severity] || "#6B7280";

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
          ${getDisasterIcon(event.type)}
        </div>
      `,
            iconSize: [30, 30],
            iconAnchor: [15, 15],
        });
    };

    const getDisasterIcon = (type) => {
        const icons = {
            "น้ำท่วม": "💧",
            "ดินถ่ม": "⛰️",
            "พายุ": "🌪️",
            "ไฟป่า": "🔥",
            "แผ่นดินไหว": "📍",
        };
        return icons[type] || "⚠️";
    };

    return (
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
        </MapContainer>
    );
}
