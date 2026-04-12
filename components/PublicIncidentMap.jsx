"use client";
import { useState, useEffect, useRef } from 'react';
import dynamic from 'next/dynamic';

const MapContainer = dynamic(() => import('react-leaflet').then(mod => mod.MapContainer), { ssr: false });
const TileLayer = dynamic(() => import('react-leaflet').then(mod => mod.TileLayer), { ssr: false });
const Marker = dynamic(() => import('react-leaflet').then(mod => mod.Marker), { ssr: false });
const Popup = dynamic(() => import('react-leaflet').then(mod => mod.Popup), { ssr: false });
const GeoJSON = dynamic(() => import('react-leaflet').then(mod => mod.GeoJSON), { ssr: false });

export default function PublicIncidentMap({ disasterType = 'flood', startDate, endDate }) {
    const [incidents, setIncidents] = useState([]);
    const [loading, setLoading] = useState(true);
    const [customIcon, setCustomIcon] = useState(null);
    const [isFullscreen, setIsFullscreen] = useState(false);
    const mapContainerRef = useRef(null);

    // Layer states
    const [showDistrictLayer, setShowDistrictLayer] = useState(true);
    const [showTambonLayer, setShowTambonLayer] = useState(false);
    const [showVillageLayer, setShowVillageLayer] = useState(false);
    const [showLabels, setShowLabels] = useState(true);

    // Polygon data
    const [districtPolygons, setDistrictPolygons] = useState([]);
    const [tambonPolygons, setTambonPolygons] = useState([]);
    const [villagePolygons, setVillagePolygons] = useState([]);

    // District colors
    const districtColors = {
        'เมืองสตูล': '#3B82F6',
        'ควนโดน': '#10B981',
        'ควนกาหลง': '#F59E0B',
        'ท่าแพ': '#EF4444',
        'ละงู': '#8B5CF6',
        'ทุ่งหว้า': '#EC4899',
        'มะนัง': '#06B6D4'
    };

    // สร้าง custom icon สำหรับแต่ละระดับความเร่งด่วน และประเภทรายงาน
    useEffect(() => {
        if (typeof window !== 'undefined') {
            const L = require('leaflet');
            const icons = {
                // Help Request Icons (สีแดง)
                help_request_low: L.icon({
                    iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-blue.png',
                    shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
                    iconSize: [25, 41], iconAnchor: [12, 41], popupAnchor: [1, -34], shadowSize: [41, 41]
                }),
                help_request_medium: L.icon({
                    iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-yellow.png',
                    shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
                    iconSize: [25, 41], iconAnchor: [12, 41], popupAnchor: [1, -34], shadowSize: [41, 41]
                }),
                help_request_high: L.icon({
                    iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-red.png',
                    shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
                    iconSize: [25, 41], iconAnchor: [12, 41], popupAnchor: [1, -34], shadowSize: [41, 41]
                }),
                help_request_critical: L.icon({
                    iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-red.png',
                    shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
                    iconSize: [30, 49], iconAnchor: [15, 49], popupAnchor: [1, -42], shadowSize: [50, 50]
                })
            };
            setCustomIcon(icons);
        }
    }, []);

    // สร้าง custom divIcon สำหรับ traffic report ตามสถานะการสัญจร
    const createTrafficIcon = (travelStatus) => {
        if (typeof window === 'undefined') return null;
        const L = require('leaflet');

        let bgColor, icon, borderColor;

        if (travelStatus === 'passable') {
            bgColor = '#10B981'; // green
            icon = '✅';
            borderColor = '#059669';
        } else if (travelStatus === 'difficult') {
            bgColor = '#F59E0B'; // orange
            icon = '⚠️';
            borderColor = '#D97706';
        } else {
            bgColor = '#EF4444'; // red
            icon = '🚫';
            borderColor = '#DC2626';
        }

        return L.divIcon({
            className: 'custom-traffic-icon',
            html: `
                <div style="
                    background-color: ${bgColor};
                    width: 40px;
                    height: 40px;
                    border-radius: 50%;
                    border: 3px solid ${borderColor};
                    box-shadow: 0 3px 10px rgba(0,0,0,0.4);
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    font-size: 20px;
                    position: relative;
                ">
                    ${icon}
                    <div style="
                        position: absolute;
                        bottom: -8px;
                        left: 50%;
                        transform: translateX(-50%);
                        width: 0;
                        height: 0;
                        border-left: 8px solid transparent;
                        border-right: 8px solid transparent;
                        border-top: 8px solid ${borderColor};
                    "></div>
                </div>
            `,
            iconSize: [40, 48],
            iconAnchor: [20, 48],
            popupAnchor: [0, -48]
        });
    };

    useEffect(() => { fetchIncidents(); }, [disasterType, startDate, endDate]);

    // Fetch polygons based on layer toggles
    useEffect(() => {
        if (showDistrictLayer && districtPolygons.length === 0) fetchPolygons('district');
    }, [showDistrictLayer]);

    useEffect(() => {
        if (showTambonLayer && tambonPolygons.length === 0) fetchPolygons('tambon');
    }, [showTambonLayer]);

    useEffect(() => {
        if (showVillageLayer && villagePolygons.length === 0) fetchPolygons('village');
    }, [showVillageLayer]);

    // Listen for fullscreen changes
    useEffect(() => {
        const handleFullscreenChange = () => {
            setIsFullscreen(!!document.fullscreenElement);
        };

        document.addEventListener('fullscreenchange', handleFullscreenChange);
        return () => document.removeEventListener('fullscreenchange', handleFullscreenChange);
    }, []);

    const fetchPolygons = async (level) => {
        try {
            const response = await fetch(`/stn-eoc/api/common/area-polygons?level=${level}`);
            const data = await response.json();
            if (data.success) {
                if (level === 'district') setDistrictPolygons(data.data);
                else if (level === 'tambon') setTambonPolygons(data.data);
                else setVillagePolygons(data.data);
            }
        } catch (error) {
            console.error(`Error fetching ${level} polygons:`, error);
        }
    };

    const fetchIncidents = async () => {
        try {
            setLoading(true);
            const params = new URLSearchParams();
            params.append('disaster_type', disasterType);
            if (startDate) params.append('start_date', startDate);
            if (endDate) params.append('end_date', endDate);

            const response = await fetch(`/stn-eoc/api/public/verified-incidents?${params}`);
            const data = await response.json();
            if (data.success) setIncidents(data.data);
        } catch (error) {
            console.error('Error fetching incidents:', error);
        } finally {
            setLoading(false);
        }
    };

    const formatDate = (dateString) => {
        if (!dateString) return '-';
        return new Date(dateString).toLocaleDateString('th-TH', {
            year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit'
        });
    };

    const getUrgencyLabel = (urgency) => ({ low: 'ไม่เร่งด่วน', medium: 'ปานกลาง', high: 'เร่งด่วน', critical: 'เร่งด่วนมาก' }[urgency] || urgency);
    const getUrgencyColor = (urgency) => ({ low: 'text-blue-600', medium: 'text-yellow-600', high: 'text-orange-600', critical: 'text-red-600' }[urgency] || 'text-gray-600');
    const getReportTypeLabel = (reportType) => ({ help_request: 'แจ้งความช่วยเหลือ', traffic_report: 'แจ้งเส้นทางการจราจร' }[reportType] || reportType);
    const getReportTypeIcon = (reportType) => ({ help_request: '🆘', traffic_report: '🚧' }[reportType] || '📍');

    // แปลง photo_path ให้มี basePath
    const getPhotoUrl = (photoPath) => {
        if (!photoPath) return null;
        if (photoPath.startsWith('http://') || photoPath.startsWith('https://')) return photoPath;
        if (photoPath.startsWith('/stn-eoc/')) return photoPath;
        if (photoPath.startsWith('/uploads/')) return `/stn-eoc${photoPath}`;
        return `/stn-eoc/uploads/incidents/${photoPath}`;
    };

    // สร้าง icon key จาก report_type และ urgency
    const getMarkerIcon = (incident) => {
        const reportType = incident.report_type || 'help_request';

        // ถ้าเป็น traffic report ให้ใช้ icon ตามสถานะการสัญจร
        if (reportType === 'traffic_report') {
            return createTrafficIcon(incident.travel_status);
        }

        // ถ้าเป็น help request ให้ใช้ icon ตามความเร่งด่วน
        const urgency = incident.urgency || 'medium';
        const iconKey = `${reportType}_${urgency}`;
        return customIcon?.[iconKey] || undefined;
    };

    // Create label icon
    const createLabelIcon = (text, type = 'district') => {
        if (typeof window === 'undefined') return null;
        const L = require('leaflet');
        const styles = {
            district: { fontSize: '12px', fontWeight: 'bold', color: '#1E40AF', backgroundColor: 'rgba(255,255,255,0.9)', padding: '2px 6px', borderRadius: '4px', border: '2px solid #3B82F6' },
            tambon: { fontSize: '10px', fontWeight: '600', color: '#047857', backgroundColor: 'rgba(255,255,255,0.85)', padding: '1px 4px', borderRadius: '3px', border: '1px solid #10B981' },
            village: { fontSize: '9px', fontWeight: '500', color: '#6B7280', backgroundColor: 'rgba(255,255,255,0.8)', padding: '1px 3px', borderRadius: '2px', border: '1px solid #9CA3AF' }
        };
        const style = styles[type];
        const styleString = Object.entries(style).map(([k, v]) => `${k.replace(/([A-Z])/g, '-$1').toLowerCase()}: ${v}`).join('; ');
        return L.divIcon({
            className: 'label-icon',
            html: `<div style="${styleString}; white-space: nowrap; pointer-events: none;">${text}</div>`,
            iconSize: null, iconAnchor: [0, 0]
        });
    };

    // Calculate center from GeoJSON
    const getPolygonCenter = (geojson) => {
        if (!geojson || !geojson.coordinates) return null;
        try {
            let allCoords = [];
            const extractCoords = (coords) => {
                if (typeof coords[0] === 'number') allCoords.push(coords);
                else coords.forEach(c => extractCoords(c));
            };
            extractCoords(geojson.coordinates);
            if (allCoords.length === 0) return null;
            const avgLng = allCoords.reduce((s, c) => s + c[0], 0) / allCoords.length;
            const avgLat = allCoords.reduce((s, c) => s + c[1], 0) / allCoords.length;
            return [avgLat, avgLng];
        } catch { return null; }
    };

    if (loading) {
        return (
            <div className="bg-white rounded-lg shadow-md p-6">
                <div className="flex items-center justify-center h-96">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
                </div>
            </div>
        );
    }

    // Toggle fullscreen
    const toggleFullscreen = () => {
        if (!mapContainerRef.current) return;

        if (!document.fullscreenElement) {
            mapContainerRef.current.requestFullscreen().then(() => {
                setIsFullscreen(true);
            }).catch(err => {
                console.error('Error attempting to enable fullscreen:', err);
            });
        } else {
            document.exitFullscreen().then(() => {
                setIsFullscreen(false);
            });
        }
    };

    return (
        <div ref={mapContainerRef} className="text-gray-800 bg-white rounded-lg shadow-md overflow-hidden">
            <div className="text-center p-4 bg-gradient-to-br from-blue-50 to-green-50 relative">
                <h3 className="text-xl md:text-2xl font-bold text-gray-800">📍 รายงานจากประชาชน (ยืนยันแล้ว)</h3>
                <p className="text-sm mt-1">จุดปักหมุดแสดงตำแหน่งที่ประชาชนรายงาน <span>({incidents.length} จุด)</span></p>

                {/* Fullscreen Button */}
                <button
                    onClick={toggleFullscreen}
                    className="absolute top-4 right-4 bg-white hover:bg-gray-100 text-gray-800 p-2 rounded-lg shadow-md transition-all hover:shadow-lg"
                    title={isFullscreen ? "ออกจากโหมดเต็มจอ" : "เปิดแบบเต็มจอ"}
                >
                    {isFullscreen ? (
                        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                    ) : (
                        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4" />
                        </svg>
                    )}
                </button>
            </div>

            <div className="p-4 bg-gradient-to-br from-blue-50 to-green-50">
                {/* Layer Controls */}
                <div className="mb-4 bg-white p-4 rounded-lg shadow">
                    <label className="text-sm font-medium block mb-3">🗺️ แสดง Layer พื้นที่:</label>
                    <div className="flex flex-wrap gap-4">
                        <label className="flex items-center gap-2 cursor-pointer">
                            <input type="checkbox" checked={showDistrictLayer} onChange={(e) => setShowDistrictLayer(e.target.checked)} className="w-4 h-4 text-blue-600 rounded" />
                            <span className="text-sm">🏛️ อำเภอ</span>
                        </label>
                        <label className="flex items-center gap-2 cursor-pointer">
                            <input type="checkbox" checked={showTambonLayer} onChange={(e) => setShowTambonLayer(e.target.checked)} className="w-4 h-4 text-green-600 rounded" />
                            <span className="text-sm">📍 ตำบล</span>
                        </label>
                        <label className="flex items-center gap-2 cursor-pointer">
                            <input type="checkbox" checked={showVillageLayer} onChange={(e) => setShowVillageLayer(e.target.checked)} className="w-4 h-4 text-gray-600 rounded" />
                            <span className="text-sm">🏘️ หมู่บ้าน</span>
                        </label>
                        <label className="flex items-center gap-2 cursor-pointer">
                            <input type="checkbox" checked={showLabels} onChange={(e) => setShowLabels(e.target.checked)} className="w-4 h-4 text-purple-600 rounded" />
                            <span className="text-sm">🏷️ แสดงชื่อ</span>
                        </label>
                    </div>
                </div>

                {/* District Legend */}
                {showDistrictLayer && (
                    <div className="mb-4 bg-white p-3 rounded-lg shadow">
                        <label className="text-sm font-medium block mb-2">สีเขตอำเภอ:</label>
                        <div className="flex flex-wrap gap-3 text-xs">
                            {Object.entries(districtColors).map(([name, color]) => (
                                <div key={name} className="flex items-center gap-1">
                                    <div className="w-3 h-3 rounded" style={{ backgroundColor: color, opacity: 0.5 }}></div>
                                    <span>{name}</span>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {/* Report Type Legend */}
                <div className="mb-4 bg-white p-3 rounded-lg shadow">
                    <label className="text-sm font-medium block mb-2">📋 ประเภทรายงาน:</label>
                    <div className="space-y-2">
                        <div className="flex items-center gap-2">
                            <div className="w-4 h-4 bg-red-500 rounded-full"></div>
                            <span className="text-sm">🆘 แจ้งความช่วยเหลือ (สีตามความเร่งด่วน)</span>
                        </div>
                        <div>
                            <div className="flex items-center gap-2 mb-1">
                                <span className="text-sm font-semibold">🚧 แจ้งเส้นทางการจราจร (สัญลักษณ์ตามสถานะ):</span>
                            </div>
                            <div className="ml-4 space-y-1">
                                <div className="flex items-center gap-2">
                                    <span className="text-lg">✅</span>
                                    <span className="text-xs">สัญจรได้ปกติ</span>
                                </div>
                                <div className="flex items-center gap-2">
                                    <span className="text-lg">⚠️</span>
                                    <span className="text-xs">สัญจรได้ยากลำบาก</span>
                                </div>
                                <div className="flex items-center gap-2">
                                    <span className="text-lg">🚫</span>
                                    <span className="text-xs">ไม่สามารถสัญจรได้</span>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>




                {/* Map */}
                <div className={`${isFullscreen ? 'h-screen' : 'h-[400px]'} rounded-lg overflow-hidden border border-gray-200`}>
                    <MapContainer center={[6.6238, 100.0673]} zoom={10} style={{ height: '100%', width: '100%' }}>
                        <TileLayer attribution='&copy; OpenStreetMap' url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />

                        {/* District Layer */}
                        {showDistrictLayer && districtPolygons.map((item, idx) => {
                            if (!item.geojson) return null;
                            const color = districtColors[item.name] || '#6B7280';
                            const center = getPolygonCenter(item.geojson);
                            return (
                                <div key={`district-${idx}`}>
                                    <GeoJSON
                                        data={item.geojson}
                                        style={{ color: color, weight: 1, fillColor: color, fillOpacity: 0.1 }}
                                        onEachFeature={(feature, layer) => {
                                            layer.bindPopup(`<div class="text-center" style="font-family: var(--font-kanit)"><strong class="text-lg">อ.${item.name}</strong></div>`);
                                        }}
                                    />
                                    {showLabels && center && (
                                        <Marker position={center} icon={createLabelIcon(`อ.${item.name}`, 'district')} />
                                    )}
                                </div>
                            );
                        })}

                        {/* Tambon Layer */}
                        {showTambonLayer && tambonPolygons.map((item, idx) => {
                            if (!item.geojson) return null;
                            const center = getPolygonCenter(item.geojson);
                            return (
                                <div key={`tambon-${idx}`}>
                                    <GeoJSON
                                        data={item.geojson}
                                        style={{ color: '#059669', weight: 2, fillColor: '#10B981', fillOpacity: 0.1, dashArray: '5, 5' }}
                                        onEachFeature={(feature, layer) => {
                                            layer.bindPopup(`<div class="text-center" style="font-family: var(--font-kanit)"><strong>ต.${item.name}</strong><p class="text-sm">อ.${item.district_name}</p></div>`);
                                        }}
                                    />
                                    {showLabels && center && (
                                        <Marker position={center} icon={createLabelIcon(`ต.${item.name}`, 'tambon')} />
                                    )}
                                </div>
                            );
                        })}

                        {/* Village Layer */}
                        {showVillageLayer && villagePolygons.map((item, idx) => {
                            if (!item.geojson) return null;
                            return (
                                <GeoJSON
                                    key={`village-${idx}`}
                                    data={item.geojson}
                                    style={{ color: '#9CA3AF', weight: 1, fillColor: '#D1D5DB', fillOpacity: 0.1 }}
                                    onEachFeature={(feature, layer) => {
                                        layer.bindPopup(`<div class="text-center" style="font-family: var(--font-kanit)"><strong>${item.name}</strong><p class="text-xs">ต.${item.tambon_name} อ.${item.district_name}</p></div>`);
                                    }}
                                />
                            );
                        })}

                        {/* Incident Markers */}
                        {incidents.map((incident) => (
                            <Marker
                                key={incident.id}
                                position={[parseFloat(incident.latitude), parseFloat(incident.longitude)]}
                                icon={getMarkerIcon(incident)}
                            >
                                <Popup maxWidth={200} maxHeight={200}>
                                    <div className="p-2" style={{ fontFamily: 'var(--font-kanit)' }}>
                                        <div className="flex items-center gap-2 mb-2">
                                            <span className="text-2xl">{getReportTypeIcon(incident.report_type)}</span>
                                            <h4 className="font-bold text-gray-800">{getReportTypeLabel(incident.report_type)}</h4>
                                        </div>
                                        <h5 className="font-semibold text-gray-700 mb-2">รายงานจาก: {incident.first_name} {incident.last_name}</h5>
                                        <div className="text-sm">
                                            <p><strong>สถานที่:</strong> {incident.village || '-'}, ต.{incident.sub_district || '-'}, อ.{incident.district || '-'}</p>
                                            <p><strong>โทร:</strong> {incident.phone}</p>
                                            <p className={getUrgencyColor(incident.urgency)}><strong>ความเร่งด่วน:</strong> {getUrgencyLabel(incident.urgency)}</p>
                                            <p><strong>ระดับน้ำ:</strong> {incident.water_level} ซม.</p>
                                            {incident.affected_people > 0 && <p><strong>ผู้ได้รับผลกระทบ:</strong> {incident.affected_people} คน</p>}
                                            {incident.travel_status && <p><strong>สถานะการสัญจร:</strong> {incident.travel_status === 'passable' ? '✅ สัญจรได้ปกติ' : incident.travel_status === 'difficult' ? '⚠️ สัญจรได้ยากลำบาก' : '🚫 ไม่สามารถสัญจรได้'}</p>}
                                            <p><strong>เวลาเกิดเหตุ:</strong> {formatDate(incident.occurred_at)}</p>
                                            <p className="pt-2 border-t"><strong>รายละเอียด:</strong><br />{incident.description}</p>
                                            {incident.photo_path && (
                                                <div className="pt-2 border-t">
                                                    <img src={getPhotoUrl(incident.photo_path)} alt="รูปภาพ" className="w-full h-auto rounded mt-2" />
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                </Popup>
                            </Marker>
                        ))}
                    </MapContainer>
                </div>

                {incidents.length === 0 && (
                    <div className="mt-4 text-center text-gray-500 p-4 bg-white rounded-lg">
                        <p>ไม่มีรายงานที่ยืนยันแล้วในช่วงเวลานี้</p>
                    </div>
                )}
            </div>
        </div>
    );
}
