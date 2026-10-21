"use client";
import { useCallback, useEffect, useState } from 'react';
import dynamic from 'next/dynamic';
import AppIcon from "@/components/icons/AppIcon";
import ShelterPopup from "@/components/public/map/ShelterPopup";
import { escapeHtml as esc } from "@/lib/escapeHtml";
import { isMedicalShelter, shelterDivIconOptions } from '@/lib/shelterMarker';

const MapContainer = dynamic(() => import('react-leaflet').then(mod => mod.MapContainer), { ssr: false });
const TileLayer = dynamic(() => import('react-leaflet').then(mod => mod.TileLayer), { ssr: false });
const Marker = dynamic(() => import('react-leaflet').then(mod => mod.Marker), { ssr: false });
const Popup = dynamic(() => import('react-leaflet').then(mod => mod.Popup), { ssr: false });
const GeoJSON = dynamic(() => import('react-leaflet').then(mod => mod.GeoJSON), { ssr: false });

const EOC_TYPES = [
    { value: 'flood', label: "อุทกภัยน้ำท่วม", color: 'blue', markerUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-blue.png' },
    { value: 'drought', label: "ภัยแล้ง", color: 'yellow', markerUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-yellow.png' },
    { value: 'tsunami', label: "สึนามิ", color: 'cyan', markerUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-blue.png' },
    { value: 'earthquake', label: "แผ่นดินไหว", color: 'orange', markerUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-orange.png' },
    { value: 'disease', label: "โรคระบาด", color: 'red', markerUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-red.png' }
];

export default function ShelterCenterMap({
    eocType = null,
    sessionId = null,
    apiPath = '/stn-eoc/api/eoc/shelter-centers',
    includeAll = false,
    embedded = false,
    heightClass = 'h-[600px]',
    showLayerControls = true
}) {
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

    const districtBoundaryColor = '#111827';

    const eocTypes = EOC_TYPES;

    useEffect(() => {
        setFilterType(eocType || '');
    }, [eocType]);

    // สร้าง custom icons
    useEffect(() => {
        if (typeof window !== 'undefined') {
            const L = require('leaflet');
            const icons = {};

            // หมุดศูนย์พักพิงแบบเดียวทั้งระบบ (lib/shelterMarker)
            icons.shelter = L.divIcon(shelterDivIconOptions());
            icons.medical = L.divIcon(shelterDivIconOptions({ type: 'medical' }));
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
            if (includeAll) params.append('include_all', '1');

            const response = await fetch(`${apiPath}?${params}`);
            const data = await response.json();
            if (data.success) setShelters(data.data);
        } catch (error) {
            console.error('Error fetching shelters:', error);
        } finally {
            setLoading(false);
        }
    }, [apiPath, filterType, includeAll, sessionId]);

    // Fetch polygons
    useEffect(() => {
        if (showDistrictLayer && districtPolygons.length === 0) fetchPolygons('district');
    }, [districtPolygons.length, fetchPolygons, showDistrictLayer]);

    useEffect(() => {
        if (showTambonLayer && tambonPolygons.length === 0) fetchPolygons('tambon');
    }, [fetchPolygons, showTambonLayer, tambonPolygons.length]);

    useEffect(() => { fetchShelters(); }, [fetchShelters]);

    const sheltersWithCoordinates = shelters.filter((shelter) => {
        const lat = Number.parseFloat(shelter.lat);
        const lon = Number.parseFloat(shelter.lon);
        return Number.isFinite(lat) && Number.isFinite(lon);
    });
    const sheltersWithoutCoordinates = shelters.length - sheltersWithCoordinates.length;

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
            <div className="rounded-2xl border border-slate-200 bg-white p-6">
                <div className="flex items-center justify-center h-96">
                    <div className="animate-spin rounded-full h-12 w-12 border-b border-blue-500"></div>
                </div>
            </div>
        );
    }

    return (
        <div className={`text-slate-800 overflow-hidden ${embedded ? 'bg-transparent' : 'bg-white rounded-lg shadow-md'}`}>
            {!embedded && (
                <div className="text-center p-4 bg-gradient-to-br from-green-50 to-blue-50">
                    <h3 className="text-2xl font-bold text-slate-800"><AppIcon icon="shelter" className="inline-block h-[1em] w-[1em] shrink-0 align-[-0.125em]" /> ศูนย์พักพิงชั่วคราว</h3>
                    <p className="text-lg mt-1">
                        แสดงตำแหน่งศูนย์พักพิงบนแผนที่ ({sheltersWithCoordinates.length}/{shelters.length} แห่ง)
                    </p>
                    {sheltersWithoutCoordinates > 0 && (
                        <p className="text-sm text-amber-700 mt-1">
                            มี {sheltersWithoutCoordinates} แห่งที่ยังไม่มีพิกัด จึงยังไม่แสดงบนแผนที่
                        </p>
                    )}
                </div>
            )}

            <div className={embedded ? "" : "p-4 bg-gradient-to-br from-green-50 to-blue-50"}>
                {/* Filter Controls */}
                {!embedded && !eocType && (
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
                {showLayerControls && (
                <div className={`${embedded ? 'mb-3 rounded-lg border border-slate-100 bg-white p-3' : 'mb-4 bg-white p-4 rounded-lg shadow'}`}>
                    <label className="text-sm font-medium block mb-3"><AppIcon icon="map" className="inline-block h-[1em] w-[1em] shrink-0 align-[-0.125em]" /> แสดงชั้นข้อมูลพื้นที่:</label>
                    <div className="flex flex-wrap gap-4">
                        <label className="flex items-center gap-2 cursor-pointer">
                            <input type="checkbox" checked={showDistrictLayer} onChange={(e) => setShowDistrictLayer(e.target.checked)} className="w-4 h-4 text-blue-600 rounded" />
                            <span className="text-sm"><AppIcon icon="landmark" className="inline-block h-[1em] w-[1em] shrink-0 align-[-0.125em]" /> อำเภอ</span>
                        </label>
                        <label className="flex items-center gap-2 cursor-pointer">
                            <input type="checkbox" checked={showTambonLayer} onChange={(e) => setShowTambonLayer(e.target.checked)} className="w-4 h-4 text-green-600 rounded" />
                            <span className="text-sm"><AppIcon icon="mapPin" className="inline-block h-[1em] w-[1em] shrink-0 align-[-0.125em]" /> ตำบล</span>
                        </label>
                        <label className="flex items-center gap-2 cursor-pointer">
                            <input type="checkbox" checked={showLabels} onChange={(e) => setShowLabels(e.target.checked)} className="w-4 h-4 text-teal-600 rounded" />
                            <span className="text-sm"><AppIcon icon="tag" className="inline-block h-[1em] w-[1em] shrink-0 align-[-0.125em]" /> แสดงชื่อ</span>
                        </label>
                    </div>
                </div>
                )}

                {/* District Legend */}
                {showDistrictLayer && (
                    <div className="mb-4 bg-white p-3 rounded-lg shadow">
                        <label className="text-sm font-medium block mb-2">ขอบเขตอำเภอ:</label>
                        <div className="flex items-center gap-2 text-xs">
                            <div className="h-1 w-8 rounded bg-slate-900"></div>
                            <span>เส้นขอบเขตอำเภอสีดำ</span>
                        </div>
                    </div>
                )}

                {/* Map */}
                <div className={`${heightClass} rounded-lg overflow-hidden border border-slate-200`}>
                    <MapContainer center={[6.6238, 100.0673]} zoom={10} style={{ height: '100%', width: '100%' }}>
                        <TileLayer attribution='&copy; OpenStreetMap' url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />

                        {/* District Layer */}
                        {showDistrictLayer && districtPolygons.map((item, idx) => {
                            if (!item.geojson) return null;
                            const center = getPolygonCenter(item.geojson);
                            return (
                                <div key={`district-${idx}`}>
                                    <GeoJSON
                                        data={item.geojson}
                                        style={{ color: districtBoundaryColor, weight: 3, opacity: 0.95, fillOpacity: 0 }}
                                        onEachFeature={(feature, layer) => {
                                            layer.bindPopup(`<div class="text-center"><strong class="text-lg">อ.${esc(item.name)}</strong></div>`);
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
                                            layer.bindPopup(`<div class="text-center"><strong>ต.${esc(item.name)}</strong><p class="text-sm">อ.${esc(item.district_name)}</p></div>`);
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
                                icon={(isMedicalShelter(shelter.shelter_type) ? customIcons?.medical : customIcons?.shelter) || undefined}
                            >
                                <Popup maxWidth={270} minWidth={240}>
                                    <ShelterPopup shelter={shelter} />
                                </Popup>
                            </Marker>
                        ))}
                    </MapContainer>
                </div>

                {shelters.length === 0 && (
                    <div className="mt-4 text-center text-slate-500 p-4 bg-white rounded-lg">
                        <p>ไม่พบศูนย์พักพิงที่เปิดใช้งานในเงื่อนไขนี้</p>
                    </div>
                )}
            </div>
        </div>
    );
}
