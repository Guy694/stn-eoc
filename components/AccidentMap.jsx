"use client";
import { useState, useEffect, useMemo } from 'react';
import dynamic from 'next/dynamic';

// Dynamic import Leaflet components (client-side only)
const MapContainer = dynamic(
    () => import('react-leaflet').then(mod => mod.MapContainer),
    { ssr: false }
);
const TileLayer = dynamic(
    () => import('react-leaflet').then(mod => mod.TileLayer),
    { ssr: false }
);
const Marker = dynamic(
    () => import('react-leaflet').then(mod => mod.Marker),
    { ssr: false }
);
const Popup = dynamic(
    () => import('react-leaflet').then(mod => mod.Popup),
    { ssr: false }
);
const LayerGroup = dynamic(
    () => import('react-leaflet').then(mod => mod.LayerGroup),
    { ssr: false }
);

// Map center - จังหวัดสตูล
const MAP_CENTER = [6.6238, 100.0673];
const MAP_ZOOM = 10;

export default function AccidentMap({
    accidents = [],
    servicePoints = [],
    healthFacilities = [],
    onAccidentClick,
    onServicePointClick
}) {
    const [isClient, setIsClient] = useState(false);
    const [L, setL] = useState(null);
    const [showHealthFacilities, setShowHealthFacilities] = useState(true);
    const [showServicePoints, setShowServicePoints] = useState(true);
    const [showAccidents, setShowAccidents] = useState(true);

    useEffect(() => {
        setIsClient(true);
        // Import Leaflet only on client
        import('leaflet').then(leaflet => {
            setL(leaflet.default);
        });
    }, []);

    // สร้าง icons
    const icons = useMemo(() => {
        if (!L) return {};

        const createIcon = (color, emoji) => {
            return L.divIcon({
                className: 'custom-marker',
                html: `<div style="
                    background: ${color};
                    width: 32px;
                    height: 32px;
                    border-radius: 50%;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    font-size: 16px;
                    border: 2px solid white;
                    box-shadow: 0 2px 4px rgba(0,0,0,0.3);
                ">${emoji}</div>`,
                iconSize: [32, 32],
                iconAnchor: [16, 32],
                popupAnchor: [0, -32]
            });
        };

        return {
            accident: createIcon('#dc2626', '🚗'), // แดง
            accidentDeath: createIcon('#7c2d12', '💀'), // น้ำตาลเข้ม
            servicePoint: createIcon('#f97316', '🚧'), // ส้ม
            healthFacility: createIcon('#2563eb', '🏥'), // น้ำเงิน
        };
    }, [L]);

    // สรุปสถิติ
    const stats = useMemo(() => ({
        totalAccidents: accidents.length,
        totalDeaths: accidents.reduce((sum, a) => sum + (a.deaths || 0), 0),
        totalInjuries: accidents.reduce((sum, a) => sum + (a.injuries || 0), 0),
        drunkDriving: accidents.filter(a => a.drunk_driving).length,
        totalServicePoints: servicePoints.length,
        totalHealthFacilities: healthFacilities.length
    }), [accidents, servicePoints, healthFacilities]);

    if (!isClient) {
        return (
            <div className="h-[600px] bg-gray-100 rounded-lg flex items-center justify-center">
                <div className="text-center">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-500 mx-auto mb-4"></div>
                    <p className="text-gray-600">กำลังโหลดแผนที่...</p>
                </div>
            </div>
        );
    }

    return (
        <div className="bg-white rounded-lg shadow-lg overflow-hidden">
            {/* Stats Summary */}
            <div className="p-4 bg-gradient-to-r from-orange-500 to-red-500 text-white">
                <h3 className="text-xl font-bold mb-3">🗺️ แผนที่สถานการณ์อุบัติเหตุ</h3>
                <div className="grid grid-cols-2 md:grid-cols-6 gap-4">
                    <div className="bg-white/20 rounded-lg p-2 text-center">
                        <div className="text-2xl font-bold">{stats.totalAccidents}</div>
                        <div className="text-xs">อุบัติเหตุ</div>
                    </div>
                    <div className="bg-white/20 rounded-lg p-2 text-center">
                        <div className="text-2xl font-bold">{stats.totalDeaths}</div>
                        <div className="text-xs">เสียชีวิต</div>
                    </div>
                    <div className="bg-white/20 rounded-lg p-2 text-center">
                        <div className="text-2xl font-bold">{stats.totalInjuries}</div>
                        <div className="text-xs">บาดเจ็บ</div>
                    </div>
                    <div className="bg-white/20 rounded-lg p-2 text-center">
                        <div className="text-2xl font-bold">{stats.drunkDriving}</div>
                        <div className="text-xs">เมาแล้วขับ</div>
                    </div>
                    <div className="bg-white/20 rounded-lg p-2 text-center">
                        <div className="text-2xl font-bold">{stats.totalServicePoints}</div>
                        <div className="text-xs">จุดบริการ</div>
                    </div>
                    <div className="bg-white/20 rounded-lg p-2 text-center">
                        <div className="text-2xl font-bold">{stats.totalHealthFacilities}</div>
                        <div className="text-xs">หน่วยบริการ</div>
                    </div>
                </div>
            </div>

            {/* Filter Toggles */}
            <div className="p-3 bg-gray-50 border-b flex flex-wrap gap-3">
                <label className="flex items-center gap-2 cursor-pointer">
                    <input
                        type="checkbox"
                        checked={showAccidents}
                        onChange={(e) => setShowAccidents(e.target.checked)}
                        className="w-4 h-4 accent-red-500"
                    />
                    <span className="text-sm">🚗 อุบัติเหตุ ({accidents.length})</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                    <input
                        type="checkbox"
                        checked={showServicePoints}
                        onChange={(e) => setShowServicePoints(e.target.checked)}
                        className="w-4 h-4 accent-orange-500"
                    />
                    <span className="text-sm">🚧 จุดบริการ ({servicePoints.length})</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                    <input
                        type="checkbox"
                        checked={showHealthFacilities}
                        onChange={(e) => setShowHealthFacilities(e.target.checked)}
                        className="w-4 h-4 accent-blue-500"
                    />
                    <span className="text-sm">🏥 หน่วยบริการสุขภาพ ({healthFacilities.length})</span>
                </label>
            </div>

            {/* Map */}
            <div className="h-[500px]">
                {L && (
                    <MapContainer
                        center={MAP_CENTER}
                        zoom={MAP_ZOOM}
                        style={{ height: '100%', width: '100%' }}
                    >
                        <TileLayer
                            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
                            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                        />

                        {/* Accident Markers */}
                        {showAccidents && (
                            <LayerGroup>
                                {accidents.filter(a => a.lat && a.lng).map((accident, idx) => (
                                    <Marker
                                        key={`accident-${accident.id || idx}`}
                                        position={[parseFloat(accident.lat), parseFloat(accident.lng)]}
                                        icon={accident.deaths > 0 ? icons.accidentDeath : icons.accident}
                                        eventHandlers={{
                                            click: () => onAccidentClick?.(accident)
                                        }}
                                    >
                                        <Popup>
                                            <div className="min-w-[200px]">
                                                <h4 className="font-bold text-red-600 mb-2">
                                                    🚗 {accident.accident_type || 'อุบัติเหตุ'}
                                                </h4>
                                                <p className="text-sm text-gray-700 mb-1">
                                                    📍 {accident.location_name || 'ไม่ระบุสถานที่'}
                                                </p>
                                                {accident.district && (
                                                    <p className="text-xs text-gray-500">
                                                        อ.{accident.district} ต.{accident.tambon}
                                                    </p>
                                                )}
                                                <div className="mt-2 grid grid-cols-2 gap-2 text-sm">
                                                    <div className="bg-red-100 p-1 rounded text-center">
                                                        <span className="font-bold text-red-700">{accident.deaths || 0}</span>
                                                        <span className="text-xs block">เสียชีวิต</span>
                                                    </div>
                                                    <div className="bg-yellow-100 p-1 rounded text-center">
                                                        <span className="font-bold text-yellow-700">{accident.injuries || 0}</span>
                                                        <span className="text-xs block">บาดเจ็บ</span>
                                                    </div>
                                                </div>
                                                {accident.drunk_driving && (
                                                    <span className="inline-block mt-2 px-2 py-1 bg-purple-100 text-purple-700 text-xs rounded-full">
                                                        🍺 เมาแล้วขับ
                                                    </span>
                                                )}
                                            </div>
                                        </Popup>
                                    </Marker>
                                ))}
                            </LayerGroup>
                        )}

                        {/* Service Point Markers */}
                        {showServicePoints && (
                            <LayerGroup>
                                {servicePoints.filter(sp => sp.lat && sp.lng).map((point, idx) => (
                                    <Marker
                                        key={`service-${point.id || idx}`}
                                        position={[parseFloat(point.lat), parseFloat(point.lng)]}
                                        icon={icons.servicePoint}
                                        eventHandlers={{
                                            click: () => onServicePointClick?.(point)
                                        }}
                                    >
                                        <Popup>
                                            <div className="min-w-[180px]">
                                                <h4 className="font-bold text-orange-600 mb-2">
                                                    🚧 {point.name}
                                                </h4>
                                                <p className="text-xs bg-orange-100 text-orange-700 px-2 py-1 rounded inline-block mb-2">
                                                    {point.point_type}
                                                </p>
                                                {point.address && (
                                                    <p className="text-sm text-gray-600 mb-1">📍 {point.address}</p>
                                                )}
                                                <div className="text-sm text-gray-700">
                                                    <p>👮 เจ้าหน้าที่: {point.officer_count || 0} คน</p>
                                                    <p>🚔 รถตรวจ: {point.vehicle_count || 0} คัน</p>
                                                </div>
                                                {point.operating_hours && (
                                                    <p className="text-xs text-gray-500 mt-1">
                                                        🕐 {point.operating_hours}
                                                    </p>
                                                )}
                                            </div>
                                        </Popup>
                                    </Marker>
                                ))}
                            </LayerGroup>
                        )}

                        {/* Health Facility Markers */}
                        {showHealthFacilities && (
                            <LayerGroup>
                                {healthFacilities.filter(hf => hf.lat && hf.lng).map((facility, idx) => (
                                    <Marker
                                        key={`health-${facility.id || idx}`}
                                        position={[parseFloat(facility.lat), parseFloat(facility.lng)]}
                                        icon={icons.healthFacility}
                                    >
                                        <Popup>
                                            <div className="min-w-[180px]">
                                                <h4 className="font-bold text-blue-600 mb-2">
                                                    🏥 {facility.name}
                                                </h4>
                                                <p className="text-xs bg-blue-100 text-blue-700 px-2 py-1 rounded inline-block mb-2">
                                                    {facility.facility_type || 'หน่วยบริการ'}
                                                </p>
                                                {facility.address && (
                                                    <p className="text-sm text-gray-600 mb-1">📍 {facility.address}</p>
                                                )}
                                                {facility.phone && (
                                                    <p className="text-sm text-gray-700">📞 {facility.phone}</p>
                                                )}
                                            </div>
                                        </Popup>
                                    </Marker>
                                ))}
                            </LayerGroup>
                        )}
                    </MapContainer>
                )}
            </div>

            {/* Legend */}
            <div className="p-3 bg-gray-50 border-t">
                <div className="flex flex-wrap gap-4 text-sm">
                    <div className="flex items-center gap-2">
                        <span className="w-4 h-4 bg-red-500 rounded-full"></span>
                        <span>อุบัติเหตุ (บาดเจ็บ)</span>
                    </div>
                    <div className="flex items-center gap-2">
                        <span className="w-4 h-4 bg-amber-900 rounded-full"></span>
                        <span>อุบัติเหตุ (เสียชีวิต)</span>
                    </div>
                    <div className="flex items-center gap-2">
                        <span className="w-4 h-4 bg-orange-500 rounded-full"></span>
                        <span>จุดบริการชั่วคราว</span>
                    </div>
                    <div className="flex items-center gap-2">
                        <span className="w-4 h-4 bg-blue-500 rounded-full"></span>
                        <span>หน่วยบริการสุขภาพ</span>
                    </div>
                </div>
            </div>
        </div>
    );
}
