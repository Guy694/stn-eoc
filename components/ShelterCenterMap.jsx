"use client";
import { useCallback, useEffect, useState } from 'react';
import dynamic from 'next/dynamic';

const MapContainer = dynamic(() => import('react-leaflet').then(mod => mod.MapContainer), { ssr: false });
const TileLayer = dynamic(() => import('react-leaflet').then(mod => mod.TileLayer), { ssr: false });
const Marker = dynamic(() => import('react-leaflet').then(mod => mod.Marker), { ssr: false });
const Popup = dynamic(() => import('react-leaflet').then(mod => mod.Popup), { ssr: false });
const GeoJSON = dynamic(() => import('react-leaflet').then(mod => mod.GeoJSON), { ssr: false });

const EOC_TYPES = [
    { value: 'flood', label: '💧 น้ำท่วม', color: 'blue', markerUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-blue.png' },
    { value: 'drought', label: '🌵 ภัยแล้ง', color: 'yellow', markerUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-yellow.png' },
    { value: 'tsunami', label: '🌊 สึนามิ', color: 'cyan', markerUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-blue.png' },
    { value: 'earthquake', label: '🏚️ แผ่นดินไหว', color: 'orange', markerUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-orange.png' },
    { value: 'disease', label: '🦠 โรคระบาด', color: 'red', markerUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-red.png' }
];

export default function ShelterCenterMap({ eocType = null, sessionId = null }) {
    const [shelters, setShelters] = useState([]);
    const [loading, setLoading] = useState(true);
    const [customIcons, setCustomIcons] = useState(null);
    const [filterType, setFilterType] = useState(eocType || '');

    // Layer states
    const [showDistrictLayer, setShowDistrictLayer] = useState(false);
    const [showTambonLayer, setShowTambonLayer] = useState(false);
    const [showLabels, setShowLabels] = useState(true);

    // Polygon data
    const [districtPolygons, setDistrictPolygons] = useState([]);
    const [tambonPolygons, setTambonPolygons] = useState([]);

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

    const eocTypes = EOC_TYPES;

    // สร้าง custom icons
    useEffect(() => {
        if (typeof window !== 'undefined') {
            const L = require('leaflet');
            const icons = {};

            // สร้าง icon สำหรับแต่ละประเภท EOC โดยใช้รูปบ้าน/ศูนย์พักพิง
            const shelterIconColors = {
                'flood': { bg: '#3B82F6', border: '#1D4ED8', emoji: '🏠' },      // น้ำเงิน
                'drought': { bg: '#EAB308', border: '#CA8A04', emoji: '🏠' },    // เหลือง
                'tsunami': { bg: '#8B5CF6', border: '#7C3AED', emoji: '🏠' },    // ม่วง
                'earthquake': { bg: '#F97316', border: '#EA580C', emoji: '🏠' }, // ส้ม
                'disease': { bg: '#EF4444', border: '#DC2626', emoji: '🏠' }     // แดง
            };

            eocTypes.forEach(type => {
                const colors = shelterIconColors[type.value] || { bg: '#6B7280', border: '#4B5563', emoji: '🏠' };
                icons[type.value] = L.divIcon({
                    className: 'shelter-custom-icon',
                    html: `
                        <div style="
                            background-color: ${colors.bg};
                            border: 3px solid ${colors.border};
                            border-radius: 50%;
                            width: 40px;
                            height: 40px;
                            display: flex;
                            align-items: center;
                            justify-content: center;
                            font-size: 20px;
                            box-shadow: 0 4px 6px rgba(0,0,0,0.3);
                            cursor: pointer;
                        ">
                            ${colors.emoji}
                        </div>
                    `,
                    iconSize: [40, 40],
                    iconAnchor: [20, 20],
                    popupAnchor: [0, -20]
                });
            });
            setCustomIcons(icons);
        }
    }, [eocTypes]);

    const fetchPolygons = useCallback(async (level) => {
        try {
            const response = await fetch(`/stn-eoc/api/common/area-polygons?level=${level}`);
            const data = await response.json();
            if (data.success) {
                if (level === 'district') setDistrictPolygons(data.data);
                else if (level === 'tambon') setTambonPolygons(data.data);
            }
        } catch (error) {
            console.error(`Error fetching ${level} polygons:`, error);
        }
    }, []);

    const fetchShelters = useCallback(async () => {
        try {
            setLoading(true);
            const params = new URLSearchParams();
            if (filterType) params.append('eoc_type', filterType);
            if (sessionId) params.append('session_id', sessionId);

            const response = await fetch(`/stn-eoc/api/eoc/shelter-centers?${params}`);
            const data = await response.json();
            if (data.success) setShelters(data.data);
        } catch (error) {
            console.error('Error fetching shelters:', error);
        } finally {
            setLoading(false);
        }
    }, [filterType, sessionId]);

    // Fetch polygons
    useEffect(() => {
        if (showDistrictLayer && districtPolygons.length === 0) fetchPolygons('district');
    }, [districtPolygons.length, fetchPolygons, showDistrictLayer]);

    useEffect(() => {
        if (showTambonLayer && tambonPolygons.length === 0) fetchPolygons('tambon');
    }, [fetchPolygons, showTambonLayer, tambonPolygons.length]);

    useEffect(() => { fetchShelters(); }, [fetchShelters]);

    const getEocTypeLabel = (eocTypeValue) => eocTypes.find(t => t.value === eocTypeValue)?.label || eocTypeValue;

    const sheltersWithCoordinates = shelters.filter((shelter) => {
        const lat = Number.parseFloat(shelter.lat);
        const lon = Number.parseFloat(shelter.lon);
        return Number.isFinite(lat) && Number.isFinite(lon);
    });
    const sheltersWithoutCoordinates = shelters.length - sheltersWithCoordinates.length;

    const getOccupancyBadge = (shelter) => {
        if (!shelter.current_occupancy && shelter.current_occupancy !== 0) return null;
        const occupancyPercent = (shelter.current_occupancy / shelter.shelter_capacity) * 100;
        let badgeClass = 'bg-green-100 text-green-800';
        let statusText = 'ว่าง';
        if (occupancyPercent >= 100) { badgeClass = 'bg-red-100 text-red-800'; statusText = 'เต็ม'; }
        else if (occupancyPercent >= 80) { badgeClass = 'bg-yellow-100 text-yellow-800'; statusText = 'ใกล้เต็ม'; }
        return (
            <div className={`inline-block px-2 py-1 rounded text-xs font-bold ${badgeClass} mt-2`}>
                {statusText}: {shelter.current_occupancy}/{shelter.shelter_capacity} ({occupancyPercent.toFixed(0)}%)
            </div>
        );
    };

    // Create label icon
    const createLabelIcon = (text, type = 'district') => {
        if (typeof window === 'undefined') return null;
        const L = require('leaflet');
        const styles = {
            district: { fontSize: '12px', fontWeight: 'bold', color: '#1E40AF', backgroundColor: 'rgba(255,255,255,0.9)', padding: '2px 6px', borderRadius: '4px', border: '2px solid #3B82F6' },
            tambon: { fontSize: '10px', fontWeight: '600', color: '#047857', backgroundColor: 'rgba(255,255,255,0.85)', padding: '1px 4px', borderRadius: '3px', border: '1px solid #10B981' }
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
                    <div className="animate-spin rounded-full h-12 w-12 border-b border-blue-500"></div>
                </div>
            </div>
        );
    }

    return (
        <div className="text-gray-800 bg-white rounded-lg shadow-md overflow-hidden">
            <div className="text-center p-4 bg-gradient-to-br from-green-50 to-blue-50">
                <h3 className="text-2xl font-bold text-gray-800">🏥 ศูนย์พักพิงชั่วคราว</h3>
                <p className="text-lg mt-1">
                    แสดงตำแหน่งศูนย์พักพิงบนแผนที่ ({sheltersWithCoordinates.length}/{shelters.length} แห่ง)
                </p>
                {sheltersWithoutCoordinates > 0 && (
                    <p className="text-sm text-amber-700 mt-1">
                        มี {sheltersWithoutCoordinates} แห่งที่ยังไม่มีพิกัด จึงยังไม่แสดงบนแผนที่
                    </p>
                )}
            </div>

            <div className="p-4 bg-gradient-to-br from-green-50 to-blue-50">
                {/* Filter Controls */}
                {!eocType && (
                    <div className="mb-4 bg-white p-4 rounded-lg shadow">
                        <div className="flex flex-wrap items-center gap-4">
                            <label className="text-sm font-medium">กรองตามประเภท EOC:</label>
                            <div className="flex gap-2 flex-wrap">
                                <button onClick={() => setFilterType('')} className={`px-3 py-1 rounded text-sm ${filterType === '' ? 'bg-blue-600 text-white' : 'bg-blue-50 text-blue-900 hover:bg-blue-100'}`}>ทั้งหมด</button>
                                {eocTypes.map(type => (
                                    <button key={type.value} onClick={() => setFilterType(type.value)} className={`px-3 py-1 rounded text-sm ${filterType === type.value ? 'bg-blue-600 text-white' : 'bg-blue-50 text-blue-900 hover:bg-blue-100'}`}>{type.label}</button>
                                ))}
                            </div>
                        </div>
                    </div>
                )}

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
                            <input type="checkbox" checked={showLabels} onChange={(e) => setShowLabels(e.target.checked)} className="w-4 h-4 text-teal-600 rounded" />
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

                {/* Map */}
                <div className="h-[600px] rounded-lg overflow-hidden border border-gray-200">
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
                                        style={{ color: color, weight: 3, fillColor: color, fillOpacity: 0.2 }}
                                        onEachFeature={(feature, layer) => {
                                            layer.bindPopup(`<div class="text-center"><strong class="text-lg">อ.${item.name}</strong></div>`);
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
                                            layer.bindPopup(`<div class="text-center"><strong>ต.${item.name}</strong><p class="text-sm">อ.${item.district_name}</p></div>`);
                                        }}
                                    />
                                    {showLabels && center && (
                                        <Marker position={center} icon={createLabelIcon(`ต.${item.name}`, 'tambon')} />
                                    )}
                                </div>
                            );
                        })}

                        {/* Shelter Markers */}
                        {sheltersWithCoordinates.map((shelter) => (
                            <Marker
                                key={shelter.id}
                                position={[parseFloat(shelter.lat), parseFloat(shelter.lon)]}
                                icon={customIcons?.[shelter.eoc_type] || undefined}
                            >
                                <Popup maxWidth={300}>
                                    <div className="p-2" style={{ fontFamily: 'var(--font-kanit)' }}>
                                        <h4 className="font-bold text-gray-800 mb-2">{shelter.sheltername}</h4>
                                        <div className="space-y-1 text-sm">
                                            <p><strong>ประเภท:</strong> {getEocTypeLabel(shelter.eoc_type)}</p>
                                            <p><strong>ที่อยู่:</strong> {shelter.address || '-'}</p>
                                            <p><strong>พื้นที่:</strong> ต.{shelter.tambon}, อ.{shelter.district_name || '-'}</p>
                                            <p><strong>ความจุ:</strong> {shelter.shelter_capacity} คน</p>
                                            {shelter.contact_phone && (
                                                <p className="flex items-center gap-1">
                                                    <strong>โทรศัพท์:</strong>
                                                    <a href={`tel:${shelter.contact_phone}`} className="text-blue-600 hover:text-blue-800 hover:underline">
                                                        {shelter.contact_phone}
                                                    </a>
                                                </p>
                                            )}
                                            <div className="mt-2 pt-2  border-t border-gray-100">
                                                <a
                                                    href={`https://www.google.com/maps/dir/?api=1&destination=${shelter.lat},${shelter.lon}`}
                                                    target="_blank"
                                                    rel="noopener noreferrer"
                                                    className="w-full bg-green-600 text-white text-center py-2 rounded-lg text-sm hover:bg-green-700 transition-colors flex items-center justify-center gap-2"
                                                >
                                                    <span style={{ color: 'white' }} className='p-1'>นำทางไปยังศูนย์พักพิง</span>
                                                </a>
                                            </div>
                                            {getOccupancyBadge(shelter)}
                                        </div>
                                    </div>
                                </Popup>
                            </Marker>
                        ))}
                    </MapContainer>
                </div>

                {shelters.length === 0 && (
                    <div className="mt-4 text-center text-gray-500 p-4 bg-white rounded-lg">
                        <p>ไม่พบศูนย์พักพิงที่เปิดใช้งาน</p>
                    </div>
                )}
            </div>
        </div>
    );
}
