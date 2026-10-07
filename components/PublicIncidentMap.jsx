"use client";
import { useCallback, useEffect, useRef, useState } from 'react';
import dynamic from 'next/dynamic';
import { renderToStaticMarkup } from 'react-dom/server';
import { getMapBaseLayer, MAP_BASE_LAYERS } from '@/lib/mapBaseLayers';
import AppIcon from './icons/AppIcon';
import CitizenPointPopup from './public/map/CitizenPointPopup';
import ShelterPopup from './public/map/ShelterPopup';
import HealthFacilityPopup from './public/map/HealthFacilityPopup';
import { facilityTypeInfo, markerTone } from '@/lib/healthFacilityStatus';
import { FLOOD_LEVEL_LEGEND, floodAreaMapMeta } from '@/lib/floodMapLevels';
import { waterLevelMeta } from '@/lib/waterReport';
import { isWaterReport } from '@/lib/waterReportMap';
import { problemStyle } from './public/problemCategoryIcons';

const MapContainer = dynamic(() => import('react-leaflet').then(mod => mod.MapContainer), { ssr: false });
const TileLayer = dynamic(() => import('react-leaflet').then(mod => mod.TileLayer), { ssr: false });
const Marker = dynamic(() => import('react-leaflet').then(mod => mod.Marker), { ssr: false });
const Popup = dynamic(() => import('react-leaflet').then(mod => mod.Popup), { ssr: false });
const GeoJSON = dynamic(() => import('react-leaflet').then(mod => mod.GeoJSON), { ssr: false });
const ZoomControl = dynamic(() => import('react-leaflet').then(mod => mod.ZoomControl), { ssr: false });
const Pane = dynamic(() => import('react-leaflet').then(mod => mod.Pane), { ssr: false });
const Tooltip = dynamic(() => import('react-leaflet').then(mod => mod.Tooltip), { ssr: false });
const WaterReportMarker = dynamic(() => import('./public/map/WaterReportMarker'), { ssr: false });
const ElevationLayer = dynamic(() => import('./public/map/ElevationLayer'), { ssr: false });
const WaterStationLayer = dynamic(() => import('./weather/WaterStationLayer'), { ssr: false });
const RainStationLayer = dynamic(() => import('./weather/RainStationLayer'), { ssr: false });

const renderMapIcon = (icon, className = "h-5 w-5 text-white") => renderToStaticMarkup(<AppIcon icon={icon} className={className} strokeWidth={2.5} />);

export default function PublicIncidentMap({
    disasterType = 'flood',
    sessionId,
    startDate,
    endDate,
    chrome = 'card',
    heightClass,
    layers,
    onLayersChange,
    urgencyFilter = 'all',
    reportTypeFilter = 'all',
    districtFilter = 'all',
    searchQuery = '',
    baseMap = 'street',
    onBaseMapChange,
    onDataChange,
    includeAllShelters = false,
    // ชั้นข้อมูล tile เพิ่มเติมที่ซ้อนบนแผนที่ (เช่น เรดาร์ฝน) [{ key, url, attribution, opacity, maxNativeZoom, zIndex }]
    extraTileLayers = [],
    // ตำแหน่งปุ่มซูม: ค่าเริ่มต้นของ Leaflet (topleft) หรือกำหนดเอง เช่น 'bottomright'
    zoomControlPosition = 'topleft'
}) {
    const [incidents, setIncidents] = useState([]);
    const [floodAreas, setFloodAreas] = useState([]);
    const [diseaseReports, setDiseaseReports] = useState([]);
    const [waterways, setWaterways] = useState(null);
    const [shelters, setShelters] = useState([]);
    // สถานีวัดระดับน้ำ/ฝน ThaiWater (สถานการณ์ปัจจุบัน — ดึงผ่าน API ของระบบ แคชฝั่งเซิร์ฟเวอร์ 10 นาที)
    const [waterStations, setWaterStations] = useState([]);
    const [rainStations, setRainStations] = useState([]);
    const [healthFacilities, setHealthFacilities] = useState([]);
    const [loading, setLoading] = useState(true);
    const [customIcon, setCustomIcon] = useState(null);
    const [isFullscreen, setIsFullscreen] = useState(false);
    const [internalBaseMap, setInternalBaseMap] = useState('street');
    const mapContainerRef = useRef(null);

    // Layer states
    const [internalLayers, setInternalLayers] = useState({
        district: true,
        tambon: false,
        village: false,
        diseaseReports: false,
        labels: true,
        incidents: true,
        traffic: true,
        shelters: false,
        hospitals: false,
        waterways: false
    });
    const activeLayers = layers || internalLayers;
    const setLayer = (key, value) => {
        const next = { ...activeLayers, [key]: value };
        if (onLayersChange) onLayersChange(next);
        else setInternalLayers(next);
    };
    const showDistrictLayer = activeLayers.district;
    const showTambonLayer = activeLayers.tambon;
    const showVillageLayer = activeLayers.village;
    const showFloodAreaLayer = disasterType === 'flood' && activeLayers.floodAreas !== false;
    const showDiseaseReportLayer = disasterType === 'disease' && Boolean(activeLayers.diseaseReports);
    const showLabels = activeLayers.labels;
    const showIncidentLayer = activeLayers.incidents !== false;
    const showTrafficLayer = activeLayers.traffic !== false;
    const showShelterLayer = Boolean(activeLayers.shelters);
    // กันไม่ให้ popup ไปอยู่ใต้แผงเหตุการณ์ด้านซ้ายและช่องค้นหาด้านบน
    const popupPanPadding = typeof window !== 'undefined' && window.innerWidth >= 768 ? [400, 90] : [16, 120];
    const showHospitalLayer = Boolean(activeLayers.hospitals);
    const showWaterwayLayer = Boolean(activeLayers.waterways);
    const activeBaseMap = baseMap || internalBaseMap;
    const selectedBaseLayer = getMapBaseLayer(activeBaseMap);
    const setBaseMap = (nextBaseMap) => {
        if (onBaseMapChange) onBaseMapChange(nextBaseMap);
        else setInternalBaseMap(nextBaseMap);
    };

    // Polygon data
    const [districtPolygons, setDistrictPolygons] = useState([]);
    const [tambonPolygons, setTambonPolygons] = useState([]);
    const [villagePolygons, setVillagePolygons] = useState([]);

    const districtBoundaryColor = '#111827';

    const diseaseSeverityMeta = {
        severe: { label: 'ระบาดหนัก', color: '#DC2626' },
        moderate: { label: 'ระบาดปานกลาง', color: '#F59E0B' },
        mild: { label: 'เฝ้าระวัง', color: '#14B8A6' },
        safe: { label: 'ไม่พบผู้ป่วย', color: '#22C55E' },
        nodata: { label: 'ไม่มีข้อมูล', color: '#94A3B8' }
    };

    const getDiseaseSeverityMeta = (level) => diseaseSeverityMeta[level] || diseaseSeverityMeta.nodata;
    const getDiseaseSeverityLevel = (patientCount) => {
        const count = Number(patientCount || 0);
        if (count >= 300) return 'severe';
        if (count >= 100) return 'moderate';
        if (count >= 1) return 'mild';
        return 'safe';
    };

    const getWaterwayStyle = (feature) => {
        const waterwayType = feature?.properties?.waterway;
        const isMain = waterwayType === 'river' || waterwayType === 'canal';
        return {
            color: isMain ? '#0369A1' : '#0EA5E9',
            weight: isMain ? 2.4 : 1.4,
            opacity: isMain ? 0.95 : 0.72,
            dashArray: feature?.properties?.intermittent ? '5, 6' : null
        };
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
            icon = 'checkCircle';
            borderColor = '#059669';
        } else if (travelStatus === 'difficult') {
            bgColor = '#F59E0B'; // orange
            icon = 'alert';
            borderColor = '#D97706';
        } else {
            bgColor = '#EF4444'; // red
            icon = 'xCircle';
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
                    position: relative;
                    color: white;
                ">
                    ${renderMapIcon(icon, "h-5 w-5 text-white")}
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

    // Listen for fullscreen changes
    useEffect(() => {
        const handleFullscreenChange = () => {
            setIsFullscreen(!!document.fullscreenElement);
        };

        document.addEventListener('fullscreenchange', handleFullscreenChange);
        return () => document.removeEventListener('fullscreenchange', handleFullscreenChange);
    }, []);

    const fetchPolygons = useCallback(async (level) => {
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
    }, []);

    const fetchIncidents = useCallback(async () => {
        try {
            setLoading(true);
            const params = new URLSearchParams();
            params.append('disaster_type', disasterType);
            if (sessionId) params.append('session_id', sessionId);
            if (startDate) params.append('start_date', startDate);
            if (endDate) params.append('end_date', endDate);

            const response = await fetch(`/stn-eoc/api/public/verified-incidents?${params}`);
            const data = await response.json();
            if (data.success) {
                setIncidents(data.data);
                if (onDataChange) onDataChange(data.data);
            }
        } catch (error) {
            console.error('Error fetching incidents:', error);
        } finally {
            setLoading(false);
        }
    }, [disasterType, endDate, onDataChange, sessionId, startDate]);

    useEffect(() => { fetchIncidents(); }, [fetchIncidents]);

    const fetchFloodAreas = useCallback(async () => {
        if (disasterType !== 'flood' || !showFloodAreaLayer || !sessionId) {
            setFloodAreas([]);
            return;
        }

        try {
            const params = new URLSearchParams();
            params.append('session_id', sessionId);
            if (startDate && endDate && startDate !== endDate) {
                params.append('start_date', startDate);
                params.append('end_date', endDate);
            } else if (startDate) {
                params.append('date', startDate);
            }

            const response = await fetch(`/stn-eoc/api/eoc/flood/area-status?${params}`);
            const data = await response.json();
            if (data.success) {
                setFloodAreas(data.data || []);
            } else {
                setFloodAreas([]);
            }
        } catch (error) {
            console.error('Error fetching flood area layer:', error);
            setFloodAreas([]);
        }
    }, [disasterType, endDate, sessionId, showFloodAreaLayer, startDate]);

    useEffect(() => { fetchFloodAreas(); }, [fetchFloodAreas]);

    const fetchDiseaseReports = useCallback(async () => {
        if (disasterType !== 'disease' || !showDiseaseReportLayer) {
            setDiseaseReports([]);
            return;
        }

        try {
            const params = new URLSearchParams();
            if (sessionId) params.append('session_id', sessionId);
            if (startDate) params.append('date', startDate);

            const response = await fetch(`/stn-eoc/api/eoc/disease/area-status?${params}`);
            const data = await response.json();
            if (data.success) {
                setDiseaseReports(data.data || []);
            } else {
                setDiseaseReports([]);
            }
        } catch (error) {
            console.error('Error fetching disease report layer:', error);
            setDiseaseReports([]);
        }
    }, [disasterType, sessionId, showDiseaseReportLayer, startDate]);

    useEffect(() => { fetchDiseaseReports(); }, [fetchDiseaseReports]);

    const fetchShelters = useCallback(async () => {
        if (!sessionId && !includeAllShelters) {
            setShelters([]);
            return;
        }

        try {
            const params = new URLSearchParams();
            if (disasterType) params.append('eoc_type', disasterType === 'accident' ? 'flood' : disasterType);
            if (sessionId) params.append('session_id', sessionId);
            if (!sessionId && includeAllShelters) params.append('include_all', '1');

            const response = await fetch(`/stn-eoc/api/public/shelter-centers?${params}`);
            const data = await response.json();
            if (data.success) setShelters(data.data || []);
        } catch (error) {
            console.error('Error fetching shelter layer:', error);
            setShelters([]);
        }
    }, [disasterType, includeAllShelters, sessionId]);

    useEffect(() => {
        setShelters([]);
    }, [disasterType, includeAllShelters, sessionId]);

    const fetchHealthFacilities = useCallback(async () => {
        try {
            const response = await fetch('/stn-eoc/api/common/health-facilities');
            const data = await response.json();
            if (data.success) setHealthFacilities(data.data || []);
        } catch (error) {
            console.error('Error fetching hospital layer:', error);
        }
    }, []);

    useEffect(() => {
        if (showShelterLayer && shelters.length === 0) fetchShelters();
    }, [fetchShelters, shelters.length, showShelterLayer]);

    const showWaterStations = Boolean(activeLayers.waterStations);
    const showRainStations = Boolean(activeLayers.rainStations);
    useEffect(() => {
        if (!showWaterStations) return undefined;
        let alive = true;
        const load = () => fetch('/stn-eoc/api/public/water-levels')
            .then((response) => (response.ok ? response.json() : null))
            .then((json) => { if (alive && json?.success) setWaterStations(json.stations || []); })
            .catch(() => {});
        load();
        const timer = window.setInterval(load, 10 * 60 * 1000);
        return () => { alive = false; window.clearInterval(timer); };
    }, [showWaterStations]);
    useEffect(() => {
        if (!showRainStations) return undefined;
        let alive = true;
        const load = () => fetch('/stn-eoc/api/public/rain-stations')
            .then((response) => (response.ok ? response.json() : null))
            .then((json) => { if (alive && json?.success) setRainStations(json.stations || []); })
            .catch(() => {});
        load();
        const timer = window.setInterval(load, 10 * 60 * 1000);
        return () => { alive = false; window.clearInterval(timer); };
    }, [showRainStations]);

    useEffect(() => {
        if (showHospitalLayer && healthFacilities.length === 0) fetchHealthFacilities();
    }, [fetchHealthFacilities, healthFacilities.length, showHospitalLayer]);

    useEffect(() => {
        if (!showWaterwayLayer || waterways) return;
        let ignore = false;

        const loadWaterways = async () => {
            try {
                const response = await fetch('/stn-eoc/api/common/waterways');
                const data = await response.json();
                if (ignore) return;
                if (data.success) {
                    setWaterways(data.data);
                } else {
                    setWaterways({ type: 'FeatureCollection', features: [] });
                }
            } catch (error) {
                if (ignore) return;
                console.error('Error fetching waterways:', error);
                setWaterways({ type: 'FeatureCollection', features: [] });
            }
        };

        loadWaterways();
        return () => { ignore = true; };
    }, [showWaterwayLayer, waterways]);

    // Fetch polygons based on layer toggles
    useEffect(() => {
        if (showDistrictLayer && districtPolygons.length === 0) fetchPolygons('district');
    }, [districtPolygons.length, fetchPolygons, showDistrictLayer]);

    useEffect(() => {
        if (showTambonLayer && tambonPolygons.length === 0) fetchPolygons('tambon');
    }, [fetchPolygons, showTambonLayer, tambonPolygons.length]);

    useEffect(() => {
        if (showVillageLayer && villagePolygons.length === 0) fetchPolygons('village');
    }, [fetchPolygons, showVillageLayer, villagePolygons.length]);

    // จุดปัญหาจากประชาชน (ตรวจสอบแล้ว): สี่เหลี่ยมมุมมน แยกจากหมุดของเจ้าหน้าที่ให้รู้แหล่งที่มา
    const createProblemIcon = (category, waterLevel) => {
        if (typeof window === 'undefined') return null;
        const L = require('leaflet');
        const style = problemStyle(category);
        const level = waterLevelMeta(waterLevel);
        const iconColor = level && ['dry', 'ankle_knee', 'knee_waist'].includes(level.value) ? '#111827' : 'white';
        const svg = renderToStaticMarkup(<style.icon className="h-4 w-4" color={iconColor} strokeWidth={2.5} aria-hidden="true" />);
        return L.divIcon({
            className: 'public-problem-icon',
            html: `<div style="width:32px;height:32px;border-radius:10px;border:2px solid white;background:${level?.color || style.color};box-shadow:0 2px 8px rgba(0,0,0,0.3);display:flex;align-items:center;justify-content:center;">${svg}</div>`,
            iconSize: [32, 32],
            iconAnchor: [16, 16],
            popupAnchor: [0, -16]
        });
    };

    const createShelterIcon = () => {
        if (typeof window === 'undefined') return null;
        const L = require('leaflet');
        return L.divIcon({
            className: 'public-shelter-icon',
            html: `
                <div style="
                    width: 38px;
                    height: 38px;
                    border-radius: 50%;
                    border: 3px solid #7C3AED;
                    background: #8B5CF6;
                    box-shadow: 0 3px 10px rgba(0,0,0,0.32);
                    display: flex;
                    align-items: center;
                    justify-content: center;
                ">${renderMapIcon("shelter", "h-5 w-5 text-white")}</div>
            `,
            iconSize: [38, 38],
            iconAnchor: [19, 19],
            popupAnchor: [0, -19]
        });
    };

    // หมุดสถานพยาบาล: สีตามสถานะ (เขียว=เปิด, เหลือง=จำกัด/ถนนน้ำท่วม, แดง=ปิด/น้ำท่วม, เทา=ยังไม่มีรายงาน)
    // โรงพยาบาลแสดงชื่อบนแผนที่เลย ส่วน รพ.สต./สำนักงาน ชี้แล้วเห็นชื่อ (ไม่ให้ชื่อทับกันทั้งจังหวัด)
    const createHospitalIcon = (facility) => {
        if (typeof window === 'undefined') return null;
        const L = require('leaflet');
        const type = facilityTypeInfo(facility?.typecode);
        const tone = type.level === 'office' ? { color: '#64748b' } : markerTone(facility);
        const size = type.level === 'hospital' ? 34 : type.level === 'office' ? 22 : 26;
        const iconSize = type.level === 'hospital' ? 'h-5 w-5' : 'h-3.5 w-3.5';
        const name = String(facility?.name || '').replace(/[<>&"]/g, '');
        const label = type.level === 'hospital'
            ? `<div style="position:absolute;left:50%;top:${size + 2}px;transform:translateX(-50%);white-space:nowrap;padding:1px 6px;border-radius:6px;background:rgba(255,255,255,.94);color:#0f172a;font:700 11px/1.35 var(--font-kanit),sans-serif;box-shadow:0 1px 4px rgba(0,0,0,.25);border:1px solid ${tone.color}">${name}</div>`
            : '';
        return L.divIcon({
            className: 'public-hospital-icon',
            html: `
                <div style="position:relative;width:${size}px;height:${size}px">
                    <div style="
                        width: ${size}px;
                        height: ${size}px;
                        border-radius: ${type.level === 'hospital' ? '10px' : '50%'};
                        border: ${type.level === 'hospital' ? 3 : 2}px solid white;
                        background: ${tone.color};
                        color: white;
                        box-shadow: 0 3px 10px rgba(0,0,0,0.28);
                        display: flex;
                        align-items: center;
                        justify-content: center;
                    ">${renderMapIcon("hospital", `${iconSize} text-white`)}</div>
                    ${label}
                </div>
            `,
            iconSize: [size, size],
            iconAnchor: [size / 2, size / 2],
            popupAnchor: [0, -size / 2],
            tooltipAnchor: [0, -size / 2]
        });
    };

    const createDiseaseReportIcon = (report) => {
        if (typeof window === 'undefined') return null;
        const L = require('leaflet');
        const severity = report.severity_level || getDiseaseSeverityLevel(report.patient_count);
        const meta = getDiseaseSeverityMeta(severity);
        const patientCount = Number(report.patient_count || 0);
        const displayCount = patientCount > 99 ? '99+' : String(patientCount || 0);

        return L.divIcon({
            className: 'public-disease-report-icon',
            html: `
                <div style="
                    width: 38px;
                    height: 38px;
                    border-radius: 50%;
                    border: 3px solid ${meta.color};
                    background: white;
                    color: ${meta.color};
                    box-shadow: 0 3px 10px rgba(0,0,0,0.3);
                    display: flex;
                    flex-direction: column;
                    align-items: center;
                    justify-content: center;
                    line-height: 1;
                ">
                    ${renderMapIcon("biohazard", "h-4 w-4")}
                    <span style="font-size: 10px;">${displayCount}</span>
                </div>
            `,
            iconSize: [38, 38],
            iconAnchor: [19, 19],
            popupAnchor: [0, -19]
        });
    };

    // สร้าง icon key จาก report_type และ urgency
    const getMarkerIcon = (incident) => {
        const reportType = incident.report_type || 'help_request';

        if (reportType === 'problem_point') {
            return createProblemIcon(incident.problem_category, incident.water_level);
        }

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

    const filteredIncidents = incidents.filter((incident) => {
        if (urgencyFilter !== 'all' && incident.urgency !== urgencyFilter) return false;
        if (reportTypeFilter !== 'all' && incident.report_type !== reportTypeFilter) return false;
        if (incident.report_type === 'traffic_report' && !showTrafficLayer) return false;
        if ((incident.report_type || 'help_request') !== 'traffic_report' && !showIncidentLayer) return false;
        if (districtFilter !== 'all' && incident.district !== districtFilter) return false;
        const normalizedSearch = searchQuery.trim().toLowerCase();
        if (normalizedSearch) {
            const searchableText = [
                incident.district,
                incident.sub_district,
                incident.village,
                incident.description
            ].filter(Boolean).join(' ').toLowerCase();
            if (!searchableText.includes(normalizedSearch)) return false;
        }
        return true;
    });

    if (loading) {
        return (
            <div className={`${chrome === 'full' ? 'h-full bg-slate-950/90' : 'min-h-[420px] rounded-xl border border-gray-200 bg-white'} flex items-center justify-center`}>
                <div className="text-center">
                    <AppIcon icon="loader" className="mx-auto h-12 w-12 animate-spin text-blue-500" />
                    <p className="mt-3 text-sm font-medium text-gray-600">กำลังโหลดแผนที่</p>
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
        <div ref={mapContainerRef} className={`public-incident-map text-gray-800 overflow-visible ${chrome === 'full' ? 'h-full w-full seics-map-surface' : ''}`}>
            {chrome !== 'full' && (
            <div className="relative rounded-t-xl border border-b-0 border-gray-200 bg-white p-4 md:p-5">
                <div className="pr-12">
                    <p className="text-xs font-bold uppercase tracking-wide text-blue-700">รายงานจากประชาชนที่ตรวจสอบแล้ว</p>
                    <h3 className="flex items-center gap-2 text-xl md:text-2xl font-bold text-gray-900">
                        <AppIcon icon="mapPin" className="h-6 w-6 text-blue-700" />
                        รายงานจากประชาชนที่ยืนยันแล้ว
                    </h3>
                    <p className="text-sm text-gray-600 mt-1">จุดปักหมุดแสดงตำแหน่งที่ประชาชนรายงานทั้งหมด {filteredIncidents.length} จุด</p>
                </div>

                {/* Fullscreen Button */}
                <button
                    onClick={toggleFullscreen}
                    className="absolute top-4 right-4 bg-white hover:bg-gray-100 text-gray-800 p-2 rounded-lg border border-gray-200 shadow-sm transition-colors"
                    title={isFullscreen ? "ออกจากโหมดเต็มจอ" : "เปิดแบบเต็มจอ"}
                    aria-label={isFullscreen ? "ออกจากโหมดเต็มจอ" : "เปิดแผนที่แบบเต็มจอ"}
                >
                    {isFullscreen ? (
                        <AppIcon icon="minimize" className="h-5 w-5 md:h-6 md:w-6" />
                    ) : (
                        <AppIcon icon="fullscreen" className="h-5 w-5 md:h-6 md:w-6" />
                    )}
                </button>
            </div>
            )}

            <div className={chrome === 'full' ? 'h-full w-full' : 'rounded-b-xl border border-gray-200 bg-white p-3 md:p-4'}>
                {chrome !== 'full' && (
                <details className="mb-3" open>
                    <summary className="cursor-pointer select-none py-2 text-sm font-bold text-gray-800">
                        <span className="inline-flex items-center gap-2">
                            <AppIcon icon="map" className="h-4 w-4" />
                            ตัวกรองชั้นข้อมูลและคำอธิบายสัญลักษณ์
                        </span>
                    </summary>
                    <div className="grid gap-3 border-t border-gray-200 py-3 lg:grid-cols-[minmax(0,1fr)_minmax(260px,360px)]">
                        <div>
                            <p className="text-sm font-semibold text-gray-800 mb-2">แสดงชั้นข้อมูลพื้นที่</p>
                            <label className="mb-3 block max-w-xs">
                                <span className="mb-1 block text-xs font-bold text-gray-500">แผนที่พื้นหลัง</span>
                                <select
                                    value={activeBaseMap}
                                    onChange={(event) => setBaseMap(event.target.value)}
                                    className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm font-semibold text-gray-800 outline-none focus:border-blue-400"
                                >
                                    {Object.entries(MAP_BASE_LAYERS).map(([key, layer]) => (
                                        <option key={key} value={key}>{layer.label}</option>
                                    ))}
                                </select>
                            </label>
                            <div className="flex flex-wrap gap-2">
                                {disasterType === 'flood' && (
                                    <label className="inline-flex items-center gap-2 rounded-lg border border-blue-200 bg-blue-50 px-3 py-2 text-sm text-blue-900 cursor-pointer">
                                        <input type="checkbox" checked={showFloodAreaLayer} onChange={(e) => setLayer('floodAreas', e.target.checked)} className="w-4 h-4 accent-blue-600" />
                                        <span>พื้นที่อุทกภัยน้ำท่วม</span>
                                    </label>
                                )}
                                {disasterType === 'disease' && (
                                    <label className="inline-flex items-center gap-2 rounded-lg border border-teal-200 bg-teal-50 px-3 py-2 text-sm text-teal-900 cursor-pointer">
                                        <input type="checkbox" checked={showDiseaseReportLayer} onChange={(e) => setLayer('diseaseReports', e.target.checked)} className="w-4 h-4 accent-teal-600" />
                                        <span>รายงานโรคระบาด</span>
                                    </label>
                                )}
                                <label className="inline-flex items-center gap-2 rounded-lg border border-blue-200 bg-blue-50 px-3 py-2 text-sm text-blue-900 cursor-pointer">
                                    <input type="checkbox" checked={showDistrictLayer} onChange={(e) => setLayer('district', e.target.checked)} className="w-4 h-4 accent-blue-600" />
                                    <span className="inline-flex items-center gap-1.5"><AppIcon icon="landmark" className="h-4 w-4" /> อำเภอ</span>
                                </label>
                                <label className="inline-flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-900 cursor-pointer">
                                    <input type="checkbox" checked={showTambonLayer} onChange={(e) => setLayer('tambon', e.target.checked)} className="w-4 h-4 accent-emerald-600" />
                                    <span className="inline-flex items-center gap-1.5"><AppIcon icon="mapPin" className="h-4 w-4" /> ตำบล</span>
                                </label>
                                <label className="inline-flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-800 cursor-pointer">
                                    <input type="checkbox" checked={showVillageLayer} onChange={(e) => setLayer('village', e.target.checked)} className="w-4 h-4 accent-gray-700" />
                                    <span className="inline-flex items-center gap-1.5"><AppIcon icon="home" className="h-4 w-4" /> ขอบเขตหมู่บ้าน</span>
                                </label>
                                <label className="inline-flex items-center gap-2 rounded-lg border border-sky-200 bg-sky-50 px-3 py-2 text-sm text-sky-900 cursor-pointer">
                                    <input type="checkbox" checked={showWaterwayLayer} onChange={(e) => setLayer('waterways', e.target.checked)} className="w-4 h-4 accent-sky-600" />
                                    <span>เส้นทางน้ำ/คลอง</span>
                                </label>
                                <label className="inline-flex items-center gap-2 rounded-lg border border-teal-200 bg-teal-50 px-3 py-2 text-sm text-teal-900 cursor-pointer">
                                    <input type="checkbox" checked={showLabels} onChange={(e) => setLayer('labels', e.target.checked)} className="w-4 h-4 accent-teal-600" />
                                    <span className="inline-flex items-center gap-1.5"><AppIcon icon="info" className="h-4 w-4" /> แสดงชื่อ</span>
                                </label>
                                <label className="inline-flex items-center gap-2 rounded-lg border border-orange-200 bg-orange-50 px-3 py-2 text-sm text-orange-900 cursor-pointer">
                                    <input type="checkbox" checked={showIncidentLayer} onChange={(e) => setLayer('incidents', e.target.checked)} className="w-4 h-4 accent-orange-600" />
                                    <span className="inline-flex items-center gap-1.5"><AppIcon icon="alert" className="h-4 w-4" /> เหตุการณ์</span>
                                </label>
                                <label className="inline-flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-900 cursor-pointer">
                                    <input type="checkbox" checked={showTrafficLayer} onChange={(e) => setLayer('traffic', e.target.checked)} className="w-4 h-4 accent-red-600" />
                                    <span className="inline-flex items-center gap-1.5"><AppIcon icon="route" className="h-4 w-4" /> เส้นทาง</span>
                                </label>
                                <label className="inline-flex items-center gap-2 rounded-lg border border-violet-200 bg-violet-50 px-3 py-2 text-sm text-violet-900 cursor-pointer">
                                    <input type="checkbox" checked={showShelterLayer} onChange={(e) => setLayer('shelters', e.target.checked)} className="w-4 h-4 accent-violet-600" />
                                    <span>ศูนย์พักพิง</span>
                                </label>
                                <label className="inline-flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-900 cursor-pointer">
                                    <input type="checkbox" checked={showHospitalLayer} onChange={(e) => setLayer('hospitals', e.target.checked)} className="w-4 h-4 accent-emerald-600" />
                                    <span>สถานพยาบาล</span>
                                </label>
                            </div>
                        </div>

                        <div className="space-y-3 text-sm text-gray-700">
                            {showDistrictLayer && (
                                <div>
                                    <p className="font-semibold text-gray-800 mb-2">ขอบเขตอำเภอ</p>
                                    <div className="inline-flex items-center gap-1.5 text-xs">
                                        <span className="h-1 w-8 rounded bg-gray-900" aria-hidden="true"></span>
                                        <span>เส้นขอบเขตอำเภอสีดำ</span>
                                    </div>
                                </div>
                            )}
                            {showFloodAreaLayer && (
                                <div>
                                    <p className="font-semibold text-gray-800 mb-2">ระดับน้ำเทียบกับผู้ใหญ่ที่ยืนในน้ำ</p>
                                    <div className="flex flex-wrap gap-2 text-xs">
                                        {FLOOD_LEVEL_LEGEND.map((level) => (
                                            <div key={level.value} className="inline-flex items-center gap-1.5">
                                                <span className="h-3 w-3 rounded" style={{ backgroundColor: level.color }} aria-hidden="true"></span>
                                                <span>{level.description}</span>
                                            </div>
                                        ))}
                                    </div>
                                    <p className="mt-1 text-xs text-gray-500">พื้นที่ที่ไม่มีค่าความลึกใช้ระดับประเมินเดิม โดยระบุไว้ใน popup</p>
                                </div>
                            )}
                            {showDiseaseReportLayer && (
                                <div>
                                    <p className="font-semibold text-gray-800 mb-2">ระดับรายงานโรคระบาด</p>
                                    <div className="flex flex-wrap gap-2 text-xs">
                                        {['severe', 'moderate', 'mild'].map((level) => {
                                            const meta = getDiseaseSeverityMeta(level);
                                            return (
                                                <div key={level} className="inline-flex items-center gap-1.5">
                                                    <span className="h-3 w-3 rounded-full" style={{ backgroundColor: meta.color }} aria-hidden="true"></span>
                                                    <span>{meta.label}</span>
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>
                            )}
                            {showWaterwayLayer && (
                                <div>
                                    <p className="font-semibold text-gray-800 mb-2">เส้นทางน้ำ</p>
                                    <div className="flex flex-wrap gap-2 text-xs">
                                        <div className="inline-flex items-center gap-1.5">
                                            <span className="h-1 w-8 rounded bg-sky-700" aria-hidden="true"></span>
                                            <span>แม่น้ำ/คลองหลัก</span>
                                        </div>
                                        <div className="inline-flex items-center gap-1.5">
                                            <span className="h-1 w-8 rounded bg-sky-400" aria-hidden="true"></span>
                                            <span>ลำธาร/ทางระบายน้ำ</span>
                                        </div>
                                    </div>
                                </div>
                            )}
                            <div>
                                <p className="font-semibold text-gray-800 mb-2">ประเภทรายงาน</p>
                                <div className="grid gap-1.5">
                                    <div className="flex items-center gap-2">
                                        <span className="h-3 w-3 rounded-full bg-red-500" aria-hidden="true"></span>
                                        <span className="inline-flex items-center gap-1.5"><AppIcon icon="siren" className="h-4 w-4" /> แจ้งความช่วยเหลือ</span>
                                    </div>
                                    <div className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-gray-600">
                                        <span className="inline-flex items-center gap-1"><AppIcon icon="checkCircle" className="h-3.5 w-3.5 text-green-600" /> สัญจรได้</span>
                                        <span className="inline-flex items-center gap-1"><AppIcon icon="alert" className="h-3.5 w-3.5 text-yellow-600" /> สัญจรลำบาก</span>
                                        <span className="inline-flex items-center gap-1"><AppIcon icon="xCircle" className="h-3.5 w-3.5 text-red-600" /> สัญจรไม่ได้</span>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </details>
                )}

                {/* Map */}
                <div className={`${isFullscreen ? 'h-screen' : heightClass || 'h-[460px] md:h-[560px]'} overflow-visible`}>
                    <MapContainer center={[6.6238, 100.0673]} zoom={10} zoomControl={zoomControlPosition === 'topleft'} style={{ height: '100%', width: '100%' }}>
                        {zoomControlPosition !== 'topleft' && <ZoomControl position={zoomControlPosition} />}
                        <TileLayer attribution={selectedBaseLayer.attribution} url={selectedBaseLayer.url} />
                        {extraTileLayers.map((layer) => (
                            <TileLayer
                                key={`${layer.key}-${layer.url}`}
                                attribution={layer.attribution}
                                url={layer.url}
                                opacity={layer.opacity ?? 0.7}
                                maxNativeZoom={layer.maxNativeZoom}
                                zIndex={layer.zIndex ?? 300}
                            />
                        ))}

                        {/* District Layer */}
                        {showDistrictLayer && districtPolygons.map((item, idx) => {
                            if (!item.geojson) return null;
                            const center = getPolygonCenter(item.geojson);
                            return (
                                <div key={`district-${idx}`}>
                                    <GeoJSON
                                        data={item.geojson}
                                        style={{ color: districtBoundaryColor, weight: 3, opacity: 0.95, fillOpacity: 0, interactive: true }}
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
                                        style={{ color: '#059669', weight: 2.5, opacity: 0.95, fillOpacity: 0, dashArray: '5, 5', interactive: true }}
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
                                    style={{ color: '#64748B', weight: 1, opacity: 0.8, fillOpacity: 0 }}
                                    onEachFeature={(feature, layer) => {
                                        layer.bindPopup(`<div class="text-center" style="font-family: var(--font-kanit)"><strong>${item.name}</strong><p class="text-xs">ต.${item.tambon_name} อ.${item.district_name}</p></div>`);
                                    }}
                                />
                            );
                        })}

                        {/* Flood Area Layer */}
                        {showFloodAreaLayer && floodAreas.map((area) => {
                            if (!area.geometry) return null;
                            const meta = floodAreaMapMeta(area);
                            return (
                                <GeoJSON
                                    key={`flood-area-${area.id || area.vid}`}
                                    data={area.geometry}
                                    style={{
                                        color: meta.color,
                                        weight: 2,
                                        fillColor: meta.color,
                                        fillOpacity: meta.source === 'status' ? 0.18 : meta.source === 'unknown' ? 0.08 : 0.48
                                    }}
                                    onEachFeature={(feature, layer) => {
                                        layer.bindPopup(`
                                            <div style="font-family: var(--font-kanit); min-width: 180px">
                                                <strong>พื้นที่อุทกภัยน้ำท่วม</strong>
                                                <p style="margin: 4px 0 0">อ.${area.district || '-'} ต.${area.tambon || '-'} ${area.villname || ''}</p>
                                                <p style="margin: 4px 0 0"><strong>ระดับ:</strong> ${meta.description || meta.label || 'ไม่มีข้อมูลระดับน้ำ'}</p>
                                                <p style="margin: 4px 0 0"><strong>วันที่:</strong> ${area.recorded_day ? new Date(area.recorded_day).toLocaleDateString('th-TH') : '-'}</p>
                                                ${area.water_level > 0 ? `<p style="margin: 4px 0 0"><strong>ระดับน้ำ:</strong> ${area.water_level} ม.</p>` : ''}
                                                ${area.affected_population > 0 ? `<p style="margin: 4px 0 0"><strong>ผู้ได้รับผลกระทบ:</strong> ${Number(area.affected_population).toLocaleString('th-TH')} คน</p>` : ''}
                                            </div>
                                        `);
                                    }}
                                />
                            );
                        })}

                        {showWaterwayLayer && waterways?.features?.length > 0 && (
                            <GeoJSON
                                key={`waterways-${waterways.features.length}`}
                                data={waterways}
                                style={getWaterwayStyle}
                                onEachFeature={(feature, layer) => {
                                    const props = feature.properties || {};
                                    layer.bindPopup(`
                                        <div style="font-family: var(--font-kanit); min-width: 160px">
                                            <strong>${props.name || props.label || 'เส้นทางน้ำ'}</strong>
                                            <p style="margin: 4px 0 0"><strong>ประเภท:</strong> ${props.label || props.waterway || '-'}</p>
                                            <p style="margin: 4px 0 0"><strong>แหล่งข้อมูล:</strong> ${props.source || 'OpenStreetMap'}</p>
                                        </div>
                                    `);
                                }}
                            />
                        )}

                        {/* Disease Report Markers */}
                        {showDiseaseReportLayer && diseaseReports.map((report) => {
                            const lat = Number.parseFloat(report.lat);
                            const lon = Number.parseFloat(report.lng);
                            if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null;
                            const severity = report.severity_level || getDiseaseSeverityLevel(report.patient_count);
                            const meta = getDiseaseSeverityMeta(severity);
                            return (
                                <Marker key={`disease-report-${report.id}`} position={[lat, lon]} icon={createDiseaseReportIcon(report)}>
                                    <Popup maxWidth={260} autoPanPaddingTopLeft={popupPanPadding} autoPanPaddingBottomRight={[72, 90]}>
                                        <div className="p-2" style={{ fontFamily: 'var(--font-kanit)' }}>
                                            <h4 className="font-bold text-gray-800">{report.disease_name || 'รายงานโรคระบาด'}</h4>
                                            <p className="mt-1 text-sm text-gray-600">
                                                {report.village_name
                                                    ? `หมู่ ${report.moo || '-'} ${report.village_name}`
                                                    : report.facility_name || (report.moo ? `หมู่ ${report.moo}` : 'พื้นที่รายงานโรค')}
                                            </p>
                                            <p className="mt-1 text-sm">ต.{report.tambon || '-'} อ.{report.district || '-'}</p>
                                            <p className="mt-1 text-sm"><strong>ผู้ป่วย:</strong> {Number(report.patient_count || 0).toLocaleString('th-TH')} ราย</p>
                                            <p className="text-sm" style={{ color: meta.color }}><strong>ระดับ:</strong> {meta.label}</p>
                                            <p className="text-sm"><strong>วันที่รายงาน:</strong> {report.report_date ? new Date(report.report_date).toLocaleDateString('th-TH') : '-'}</p>
                                            {report.notes && <p className="mt-2 border-t pt-2 text-sm"><strong>หมายเหตุ:</strong><br />{report.notes}</p>}
                                        </div>
                                    </Popup>
                                </Marker>
                            );
                        })}

                        {/* ความสูงพื้นที่ (ระบายสีตามช่วงความสูง + กล่องบอกความสูง ณ จุดที่ชี้) */}
                        {activeLayers.elevation ? <ElevationLayer /> : null}

                        {/* ฝนวัดจริง (หยดน้ำ) และระดับน้ำ–ตลิ่ง (สี่เหลี่ยม) จาก ThaiWater */}
                        <Pane name="rain-stations" style={{ zIndex: 450 }}>
                            {showRainStations && rainStations.length > 0 ? <RainStationLayer stations={rainStations} /> : null}
                        </Pane>
                        {showWaterStations && waterStations.length > 0 ? <WaterStationLayer stations={waterStations} /> : null}

                        {/* รายงานระดับน้ำจากประชาชน: วงกลมสีตามระดับน้ำ จางลงตามเวลา (pane แยกเหนือพื้นที่น้ำท่วม/ขอบเขต) */}
                        <Pane name="water-reports" style={{ zIndex: 460 }}>
                            {filteredIncidents.filter(isWaterReport).map((incident) => (
                                <WaterReportMarker key={`wr-${incident.id}`} incident={incident} panPadding={popupPanPadding} />
                            ))}
                        </Pane>

                        {/* Incident Markers */}
                        {filteredIncidents.filter((incident) => !isWaterReport(incident)).map((incident) => (
                            <Marker
                                key={incident.id}
                                position={[parseFloat(incident.latitude), parseFloat(incident.longitude)]}
                                icon={getMarkerIcon(incident)}
                            >
                                <Popup maxWidth={260} autoPanPaddingTopLeft={popupPanPadding} autoPanPaddingBottomRight={[72, 90]}>
                                    <CitizenPointPopup incident={incident} />
                                </Popup>
                            </Marker>
                        ))}

                        {/* Shelter Markers */}
                        {showShelterLayer && shelters.map((shelter) => {
                            const lat = Number.parseFloat(shelter.lat);
                            const lon = Number.parseFloat(shelter.lon);
                            if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null;
                            return (
                                <Marker key={`shelter-${shelter.id}`} position={[lat, lon]} icon={createShelterIcon()}>
                                    <Popup maxWidth={270} minWidth={240} autoPanPaddingTopLeft={popupPanPadding} autoPanPaddingBottomRight={[72, 90]}>
                                        <ShelterPopup shelter={shelter} />
                                    </Popup>
                                </Marker>
                            );
                        })}

                        {/* Health Facility Markers */}
                        {showHospitalLayer && healthFacilities.map((facility) => {
                            const lat = Number.parseFloat(facility.lat);
                            const lon = Number.parseFloat(facility.lon);
                            if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null;
                            const isHospital = facilityTypeInfo(facility.typecode).level === 'hospital';
                            return (
                                <Marker
                                    key={`hospital-${facility.id}-${facility.service_status || ''}-${facility.flood_status || ''}`}
                                    position={[lat, lon]}
                                    icon={createHospitalIcon(facility)}
                                    zIndexOffset={isHospital ? 400 : 0}
                                >
                                    {!isHospital && <Tooltip direction="top">{facility.name}</Tooltip>}
                                    <Popup maxWidth={280} autoPanPaddingTopLeft={popupPanPadding} autoPanPaddingBottomRight={[72, 90]}>
                                        <HealthFacilityPopup
                                            facility={facility}
                                            floodAreas={showFloodAreaLayer ? floodAreas : []}
                                            waterReports={filteredIncidents.filter(isWaterReport)}
                                            waterStations={showWaterStations ? waterStations : []}
                                        />
                                    </Popup>
                                </Marker>
                            );
                        })}
                    </MapContainer>
                </div>

                {filteredIncidents.length === 0 && chrome !== 'full' && (
                    <div className="mt-4 text-center text-gray-500 p-4 bg-white rounded-lg">
                        <p>ไม่มีรายงานที่ยืนยันแล้วในช่วงเวลานี้</p>
                    </div>
                )}
            </div>
        </div>
    );
}
