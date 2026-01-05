"use client";
import { useState, useEffect } from 'react';
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
    const [polygons, setPolygons] = useState([]);
    const [boundaryLevel, setBoundaryLevel] = useState('district');
    const [showBoundary, setShowBoundary] = useState(true);

    // สร้าง custom icon สำหรับแต่ละระดับความเร่งด่วน
    useEffect(() => {
        if (typeof window !== 'undefined') {
            const L = require('leaflet');

            const icons = {
                low: L.icon({
                    iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-blue.png',
                    shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
                    iconSize: [25, 41],
                    iconAnchor: [12, 41],
                    popupAnchor: [1, -34],
                    shadowSize: [41, 41]
                }),
                medium: L.icon({
                    iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-yellow.png',
                    shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
                    iconSize: [25, 41],
                    iconAnchor: [12, 41],
                    popupAnchor: [1, -34],
                    shadowSize: [41, 41]
                }),
                high: L.icon({
                    iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-orange.png',
                    shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
                    iconSize: [25, 41],
                    iconAnchor: [12, 41],
                    popupAnchor: [1, -34],
                    shadowSize: [41, 41]
                }),
                critical: L.icon({
                    iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-red.png',
                    shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
                    iconSize: [25, 41],
                    iconAnchor: [12, 41],
                    popupAnchor: [1, -34],
                    shadowSize: [41, 41]
                })
            };

            setCustomIcon(icons);
        }
    }, []);

    useEffect(() => {
        fetchIncidents();
    }, [disasterType, startDate, endDate]);

    useEffect(() => {
        if (showBoundary) {
            fetchBoundaries();
        }
    }, [boundaryLevel, showBoundary]);

    const fetchBoundaries = async () => {
        try {
            const response = await fetch(`/api/common/boundary-polygons?level=${boundaryLevel}`);
            const data = await response.json();

            if (data.success) {
                setPolygons(data.data);
            }
        } catch (error) {
            console.error('Error fetching boundaries:', error);
        }
    };

    const fetchIncidents = async () => {
        try {
            setLoading(true);
            const params = new URLSearchParams();
            params.append('disaster_type', disasterType);
            if (startDate) params.append('start_date', startDate);
            if (endDate) params.append('end_date', endDate);

            const response = await fetch(`/api/public/verified-incidents?${params}`);
            const data = await response.json();

            if (data.success) {
                setIncidents(data.data);
            }
        } catch (error) {
            console.error('Error fetching incidents:', error);
        } finally {
            setLoading(false);
        }
    };

    const formatDate = (dateString) => {
        if (!dateString) return '-';
        const date = new Date(dateString);
        return date.toLocaleDateString('th-TH', {
            year: 'numeric',
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
    };

    const getUrgencyLabel = (urgency) => {
        const labels = {
            low: 'ไม่เร่งด่วน',
            medium: 'ปานกลาง',
            high: 'เร่งด่วน',
            critical: 'เร่งด่วนมาก'
        };
        return labels[urgency] || urgency;
    };

    const getUrgencyColor = (urgency) => {
        const colors = {
            low: 'text-blue-600',
            medium: 'text-yellow-600',
            high: 'text-orange-600',
            critical: 'text-red-600'
        };
        return colors[urgency] || 'text-gray-600';
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

    return (
        <div className="text-gray-800 bg-white rounded-lg shadow-md overflow-hidden">
            <div className="text-center p-4 bg-gradient-to-br from-blue-50 to-green-50 rounded-xl p-6">
                <h3 className="text-2xl font-bold flex items-center gap-2 text-gray-800 justify-center">
                    📍 รายงานจากประชาชน (ยืนยันแล้ว)
                </h3>
                <p className="text-lg mt-1">
                    จุดปักหมุดแสดงตำแหน่งที่ประชาชนรายงาน ({incidents.length} จุด)
                </p>
            </div>

            <div className="p-4 bg-gradient-to-br from-blue-50 to-green-50">
                {/* Boundary Controls */}
                <div className="mb-4 bg-white p-4 rounded-lg shadow">
                    <div className="flex flex-wrap items-center gap-4">
                        <div className="flex items-center gap-2">
                            <input
                                type="checkbox"
                                id="showBoundary"
                                checked={showBoundary}
                                onChange={(e) => setShowBoundary(e.target.checked)}
                                className="w-4 h-4 text-blue-600"
                            />
                            <label htmlFor="showBoundary" className="font-medium">แสดงขอบเขตพื้นที่</label>
                        </div>

                        {showBoundary && (
                            <div className="flex items-center gap-2">
                                <label className="text-sm font-medium">ระดับพื้นที่:</label>
                                <div className="flex gap-2">
                                    <button
                                        onClick={() => setBoundaryLevel('province')}
                                        className={`px-3 py-1 rounded text-sm ${boundaryLevel === 'province'
                                            ? 'bg-blue-600 text-white'
                                            : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                                            }`}
                                    >
                                        จังหวัด
                                    </button>
                                    <button
                                        onClick={() => setBoundaryLevel('district')}
                                        className={`px-3 py-1 rounded text-sm ${boundaryLevel === 'district'
                                            ? 'bg-blue-600 text-white'
                                            : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                                            }`}
                                    >
                                        อำเภอ
                                    </button>
                                    <button
                                        onClick={() => setBoundaryLevel('tambon')}
                                        className={`px-3 py-1 rounded text-sm ${boundaryLevel === 'tambon'
                                            ? 'bg-blue-600 text-white'
                                            : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                                            }`}
                                    >
                                        ตำบล
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>
                </div>

                {/* Legend */}
                <div className="mb-4 flex flex-wrap gap-4 text-sm">
                    <div className="flex items-center gap-2">
                        <div className="w-4 h-4 bg-blue-500 rounded-full"></div>
                        <span>ไม่เร่งด่วน</span>
                    </div>
                    <div className="flex items-center gap-2">
                        <div className="w-4 h-4 bg-yellow-500 rounded-full"></div>
                        <span>ปานกลาง</span>
                    </div>
                    <div className="flex items-center gap-2">
                        <div className="w-4 h-4 bg-orange-500 rounded-full"></div>
                        <span>เร่งด่วน</span>
                    </div>
                    <div className="flex items-center gap-2">
                        <div className="w-4 h-4 bg-red-500 rounded-full"></div>
                        <span>เร่งด่วนมาก</span>
                    </div>
                </div>

                {/* Map */}
                {incidents.length > 0 ? (
                    <div className="h-[600px] rounded-lg overflow-hidden border border-gray-200">
                        <MapContainer
                            center={[6.6238, 100.0673]}
                            zoom={10}
                            style={{ height: '100%', width: '100%' }}
                        >
                            <TileLayer
                                attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
                                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                            />

                            {/* Boundary Polygons */}
                            {showBoundary && polygons.map((polygon, idx) => (
                                polygon.geometry && (
                                    <GeoJSON
                                        key={`${boundaryLevel}-${idx}`}
                                        data={polygon.geometry}
                                        style={{
                                            fillColor: 'transparent',
                                            fillOpacity: 0.1,
                                            color: '#000000',
                                            weight: boundaryLevel === 'province' ? 3 : boundaryLevel === 'district' ? 2 : 1,
                                            opacity: 0.8
                                        }}
                                        onEachFeature={(feature, layer) => {
                                            if (polygon.name) {
                                                layer.bindTooltip(polygon.villname, {
                                                    permanent: false,
                                                    direction: 'center',
                                                    className: 'bg-white px-2 py-1 rounded shadow'
                                                });
                                            }
                                        }}
                                    />
                                )
                            ))}

                            {/* Incident Markers */}
                            {incidents.map((incident) => (
                                <Marker
                                    key={incident.id}
                                    position={[parseFloat(incident.latitude), parseFloat(incident.longitude)]}
                                    icon={customIcon?.[incident.urgency] || undefined}
                                >
                                    <Popup maxWidth={300}>
                                        <div className="p-2">
                                            <h4 className="font-bold text-gray-800 mb-2">
                                                รายงานจาก: {incident.first_name} {incident.last_name}
                                            </h4>

                                            <div className="space-y-1 text-sm">
                                                <p><strong>สถานที่:</strong> {incident.village || '-'}, ต.{incident.sub_district || '-'}, อ.{incident.district || '-'}</p>
                                                <p><strong>โทร:</strong> {incident.phone}</p>
                                                <p className={`${getUrgencyColor(incident.urgency)}`}>
                                                    <strong>ความเร่งด่วน:</strong> {getUrgencyLabel(incident.urgency)}
                                                </p>
                                                <p><strong>ระดับน้ำ:</strong> {incident.water_level}</p>
                                                {incident.affected_people > 0 && (
                                                    <p><strong>ผู้ได้รับผลกระทบ:</strong> {incident.affected_people} คน</p>
                                                )}
                                                <p><strong>เวลาเกิดเหตุ:</strong> {formatDate(incident.occurred_at)}</p>
                                                <p className="pt-2 border-t"><strong>รายละเอียด:</strong><br />{incident.description}</p>

                                                {incident.photo_path && (
                                                    <div className="pt-2 border-t">
                                                        <img
                                                            src={incident.photo_path}
                                                            alt="รูปภาพเหตุการณ์"
                                                            className="w-full h-auto rounded mt-2"
                                                        />
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    </Popup>
                                </Marker>
                            ))}
                        </MapContainer>
                    </div>
                ) : (
                    <div className="h-96 flex items-center justify-center text-gray-500 border border-gray-200 rounded-lg">
                        <div className="text-center">
                            <svg className="w-16 h-16 mx-auto mb-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                            </svg>
                            <p className="text-lg">ไม่มีรายงานที่ยืนยันแล้วในช่วงเวลานี้</p>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
