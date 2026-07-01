"use client";
import { MapContainer, TileLayer, Polygon, Popup, CircleMarker, Marker, LayerGroup, useMap } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { useState, useEffect, Fragment } from "react";

// แก้ไข icon default ของ Leaflet
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
    iconRetinaUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png",
    iconUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png",
    shadowUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png",
});

// Component สำหรับปรับ bounds ของแผนที่
function MapBounds({ polygons }) {
    const map = useMap();

    useEffect(() => {
        if (polygons && polygons.length > 0) {
            const bounds = [];
            polygons.forEach(polygon => {
                polygon.coordinates.forEach(coord => {
                    bounds.push(coord);
                });
            });

            if (bounds.length > 0) {
                const latLngBounds = L.latLngBounds(bounds);
                map.fitBounds(latLngBounds, { padding: [50, 50] });
            }
        }
    }, [polygons, map]);

    return null;
}

export default function HybridDisasterMap({
    polygons = [],
    events = [],
    colorMode = 'risk', // 'risk', 'district', 'population'
    showColors = true, // แสดงสีหรือเฉพาะขอบเขต
    disasterType = 'flood', // 'flood' or 'drought'
    onPolygonClick,
    onEventClick,
    gistdaData = null,
    floodFreqData = null, // ข้อมูลน้ำท่วมซ้ำซาก
    startDate = '',
    endDate = ''
}) {
    const [selectedPolygon, setSelectedPolygon] = useState(null);
    const [selectedEvent, setSelectedEvent] = useState(null);
    const [showDistrictLabels, setShowDistrictLabels] = useState(false);
    const [showTambonLabels, setShowTambonLabels] = useState(true);
    const [showVillageLabels, setShowVillageLabels] = useState(true);

    // ศูนย์กลางของจังหวัดสตูล
    const satunCenter = [6.6238, 100.0673];

    // ฟังก์ชันเลือกสีตามระดับความเสี่ยงน้ำท่วม
    const getFloodRiskColor = (riskLevel) => {
        const colors = {
            'สูงมาก': '#DC2626', // แดงเข้ม
            'สูง': '#F59E0B', // ส้ม
            'ปานกลาง': '#FCD34D', // เหลือง
            'ต่ำ': '#10B981', // เขียว
            'ปลอดภัย': '#6EE7B7', // เขียวอ่อน
        };
        return colors[riskLevel] || '#6B7280';
    };

    // ฟังก์ชันเลือกสีตามระดับความเสี่ยงภัยแล้ง
    const getDroughtRiskColor = (riskLevel) => {
        const colors = {
            'สูงมาก': '#7C2D12', // น้ำตาลเข้ม
            'สูง': '#EA580C', // ส้มแดง
            'ปานกลาง': '#FB923C', // ส้มอ่อน
            'ต่ำ': '#FDE047', // เหลือง
            'ปลอดภัย': '#86EFAC', // เขียวอ่อน
        };
        return colors[riskLevel] || '#6B7280';
    };

    // ฟังก์ชันเลือกสีตามเขต
    const getColorByDistrict = (distname) => {
        const colors = {
            'เมืองสตูล': '#3B82F6',
            'ควนโดน': '#10B981',
            'ควนกาหลง': '#F59E0B',
            'ท่าแพ': '#8B5CF6',
            'ละงู': '#EC4899',
            'ทุ่งหว้า': '#14B8A6',
            'มะนัง': '#F97316',
        };
        return colors[distname] || '#6B7280';
    };

    // ฟังก์ชันเลือกสีตามตำบล (แบบ hash-based color)
    const getColorByTambon = (tambonName) => {
        // ตรวจสอบว่ามีชื่อตำบลหรือไม่
        if (!tambonName || typeof tambonName !== 'string') {
            return '#6B7280'; // สีเทาเป็นค่า default
        }

        // สร้างสีจาก hash ของชื่อตำบล
        let hash = 0;
        for (let i = 0; i < tambonName.length; i++) {
            hash = tambonName.charCodeAt(i) + ((hash << 5) - hash);
        }

        // แปลง hash เป็นสี HSL เพื่อให้สีสดใสและแตกต่างกัน
        const hue = Math.abs(hash % 360);
        const saturation = 65 + (Math.abs(hash) % 20); // 65-85%
        const lightness = 50 + (Math.abs(hash >> 8) % 15); // 50-65%

        return `hsl(${hue}, ${saturation}%, ${lightness}%)`;
    };

    // ฟังก์ชันเลือกสีตามจำนวนครัวเรือน
    const getColorByPopulation = (numHH) => {
        if (numHH <= 50) return '#FEF3C7';
        if (numHH <= 100) return '#FCD34D';
        if (numHH <= 150) return '#F59E0B';
        return '#DC2626';
    };

    // เลือกสีตาม mode และประเภทภัย
    const getPolygonColor = (polygon) => {
        if (!polygon) return '#6B7280'; // สีเทาเป็นค่า default

        if (colorMode === 'risk') {
            // ใช้ข้อมูลความเสี่ยงจาก polygon หรือคำนวณจากข้อมูลอื่น
            const riskLevel = polygon.riskLevel || calculateRiskLevel(polygon);
            if (disasterType === 'flood') {
                return getFloodRiskColor(riskLevel);
            } else {
                return getDroughtRiskColor(riskLevel);
            }
        } else if (colorMode === 'tambon') {
            return getColorByTambon(polygon.subdistnam || polygon.tambon);
        } else if (colorMode === 'population') {
            return getColorByPopulation(polygon.num_hh || 0);
        }
        return getColorByDistrict(polygon.distname || polygon.district);
    };

    // คำนวณระดับความเสี่ยง (ตัวอย่าง - ควรใช้ข้อมูลจริงจากฐานข้อมูล)
    const calculateRiskLevel = (polygon) => {
        const risks = ['ปลอดภัย', 'ต่ำ', 'ปานกลาง', 'สูง', 'สูงมาก'];
        const seed = Number(polygon.id || polygon.num_hh || polygon.num_build || 0);
        return risks[Math.abs(seed) % risks.length];
    };

    // Style สำหรับ polygon
    const getPolygonStyle = (polygon) => {
        const isSelected = selectedPolygon?.id === polygon.id;

        if (!showColors) {
            // แสดงเฉพาะขอบเขต
            return {
                fillColor: 'transparent',
                fillOpacity: 0,
                color: isSelected ? '#000000' : '#2563EB',
                weight: isSelected ? 3 : 2,
            };
        }

        return {
            fillColor: getPolygonColor(polygon),
            fillOpacity: isSelected ? 0.7 : 0.5,
            color: isSelected ? '#000000' : '#ffffff',
            weight: isSelected ? 3 : 1.5,
        };
    };

    // Event handlers
    const handlePolygonClick = (polygon) => {
        setSelectedPolygon(polygon);
        if (onPolygonClick) {
            onPolygonClick(polygon);
        }
    };

    const handlePolygonMouseOver = (e) => {
        const layer = e.target;
        if (!showColors) {
            layer.setStyle({
                fillOpacity: 0,
                weight: 3,
                color: '#000000'
            });
        } else {
            layer.setStyle({
                fillOpacity: 0.7,
                weight: 3,
                color: '#000000'
            });
        }
    };

    const handlePolygonMouseOut = (e, polygon) => {
        const layer = e.target;
        const style = getPolygonStyle(polygon);
        layer.setStyle(style);
    };

    // สร้าง label icon
    const createLabelIcon = (text, type = 'village') => {
        const styles = {
            village: {
                fontSize: '11px',
                color: '#1F2937',
                fontWeight: '500',
                backgroundColor: 'rgba(255, 255, 255, 0.85)',
                padding: '2px 6px',
                borderRadius: '4px',
                border: '1px solid rgba(59, 130, 246, 0.5)',
                textShadow: '1px 1px 2px rgba(255,255,255,0.8)'
            },
            tambon: {
                fontSize: '13px',
                color: '#065F46',
                fontWeight: '600',
                backgroundColor: 'rgba(255, 255, 255, 0.9)',
                padding: '3px 8px',
                borderRadius: '5px',
                border: '2px solid rgba(16, 185, 129, 0.6)',
                textShadow: '1px 1px 2px rgba(255,255,255,0.9)'
            },
            district: {
                fontSize: '15px',
                color: '#9A3412',
                fontWeight: '700',
                backgroundColor: 'rgba(255, 255, 255, 0.95)',
                padding: '4px 10px',
                borderRadius: '6px',
                border: '2px solid rgba(234, 88, 12, 0.7)',
                textShadow: '1px 1px 3px rgba(255,255,255,1)'
            }
        };

        const style = styles[type];
        const styleString = Object.entries(style).map(([key, value]) =>
            `${key.replace(/([A-Z])/g, '-$1').toLowerCase()}: ${value}`
        ).join('; ');

        return L.divIcon({
            className: 'label-icon',
            html: `<div style="${styleString}; white-space: nowrap;">${text}</div>`,
            iconSize: null,
            iconAnchor: [0, 0]
        });
    };

    // Event marker handlers
    const handleEventClick = (event) => {
        setSelectedEvent(event);
        if (onEventClick) {
            onEventClick(event);
        }
    };

    // สีสำหรับ event markers
    const getEventColor = (severity) => {
        const colors = {
            'สูงมาก': '#7F1D1D',
            'สูง': '#DC2626',
            'ปานกลาง': '#F59E0B',
            'ต่ำ': '#10B981',
        };
        return colors[severity] || '#6B7280';
    };

    // สีสำหรับความถี่ของน้ำท่วมซ้ำซาก
    const getFloodFreqColor = (frequency) => {
        if (frequency >= 7) return '#7C2D12'; // สูงมาก (น้ำตาลเข้ม)
        if (frequency >= 5) return '#DC2626'; // สูง (แดงเข้ม)
        if (frequency >= 3) return '#F59E0B'; // ปานกลาง (ส้ม)
        if (frequency >= 1) return '#FCD34D'; // ต่ำ (เหลือง)
        return '#10B981'; // ไม่มี (เขียว)
    };

    return (
        <div className="relative w-full h-full">
            <MapContainer
                center={satunCenter}
                zoom={10}
                className="w-full h-full z-0"
                scrollWheelZoom={true}
            >
                <TileLayer
                    attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                    url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                />

                {/* Polygon Layer */}
                {polygons.map((polygon) => (
                    <Polygon
                        key={polygon.id}
                        positions={polygon.coordinates}
                        pathOptions={getPolygonStyle(polygon)}
                        eventHandlers={{
                            click: () => handlePolygonClick(polygon),
                            mouseover: handlePolygonMouseOver,
                            mouseout: (e) => handlePolygonMouseOut(e, polygon),
                        }}
                    >
                        <Popup>
                            <div className="min-w-[200px]" style={{ fontFamily: 'var(--font-kanit)' }}>
                                <h3 className="font-bold text-lg mb-2 text-gray-800">
                                    {polygon.villname}
                                </h3>
                                <div className="space-y-1 text-sm">
                                    <p><span className="font-semibold">ตำบล:</span> {polygon.subdistnam}</p>
                                    <p><span className="font-semibold">อำเภอ:</span> {polygon.distname}</p>
                                    <hr className="my-2" />
                                    <p><span className="font-semibold">จำนวนครัวเรือน:</span> {(polygon.num_hh || 0).toLocaleString()} ครัวเรือน</p>
                                    {colorMode === 'risk' && (
                                        <p className="font-semibold text-red-600">
                                            ระดับความเสี่ยง: {polygon.riskLevel || calculateRiskLevel(polygon)}
                                        </p>
                                    )}
                                </div>
                            </div>
                        </Popup>
                    </Polygon>
                ))}

                {/* Event Markers */}
                {events.map((event) => (
                    <CircleMarker
                        key={event.id}
                        center={[event.lat, event.lng]}
                        radius={8}
                        pathOptions={{
                            fillColor: getEventColor(event.severity),
                            fillOpacity: 0.8,
                            color: '#ffffff',
                            weight: 2,
                        }}
                        eventHandlers={{
                            click: () => handleEventClick(event),
                        }}
                    >
                        <Popup>
                            <div className="min-w-[200px]" style={{ fontFamily: 'var(--font-kanit)' }}>
                                <h3 className="font-bold text-lg mb-2 text-gray-800">
                                    {event.type}
                                </h3>
                                <div className="space-y-1 text-sm">
                                    <p><span className="font-semibold">ความรุนแรง:</span>
                                        <span className={`ml-1 px-2 py-0.5 rounded text-white ${event.severity === 'สูงมาก' ? 'bg-red-800' :
                                            event.severity === 'สูง' ? 'bg-red-600' :
                                                event.severity === 'ปานกลาง' ? 'bg-orange-500' : 'bg-green-500'
                                            }`}>
                                            {event.severity}
                                        </span>
                                    </p>
                                    <p><span className="font-semibold">สถานที่:</span> {event.village}, {event.tambon}, {event.district}</p>
                                    <p><span className="font-semibold">วันที่:</span> {new Date(event.date).toLocaleDateString('th-TH')}</p>
                                    <p><span className="font-semibold">รายละเอียด:</span> {event.description}</p>
                                    <p><span className="font-semibold">ผู้ได้รับผลกระทบ:</span> {event.affected} คน</p>
                                    <p><span className="font-semibold">สถานะ:</span> {event.status}</p>
                                </div>
                            </div>
                        </Popup>
                    </CircleMarker>
                ))}

                {/* GISTDA Flood Data Layer */}
                {gistdaData?.features
                    ?.filter((feature) => {
                        const props = feature.properties;
                        const geom = feature.geometry;
                        const geometryType = geom?.type;

                        // กรองตามช่วงวันที่
                        if (startDate && props.date && new Date(props.date) < new Date(startDate)) {
                            return false;
                        }
                        if (endDate && props.date && new Date(props.date) > new Date(endDate)) {
                            return false;
                        }

                        // ตรวจสอบว่ามี coordinates ที่ถูกต้อง
                        if (!geom || !geom.coordinates || geom.coordinates.length === 0) {
                            return false;
                        }

                        return true;
                    })
                    .map((feature, idx) => {
                        const geom = feature.geometry;
                        const props = feature.properties;
                        const geometryType = geom?.type;

                        // สร้าง unique key จากหลายค่า
                        const uniqueKey = `gistda-${props.district || ''}-${props.tambon || ''}-${props.date || ''}-${idx}`;

                        // แปลง coordinates
                        let coordinates = [];

                        if (geometryType === 'Polygon') {
                            coordinates = geom.coordinates[0].map(([lng, lat]) => [lat, lng]);
                        } else if (geometryType === 'MultiPolygon') {
                            coordinates = geom.coordinates[0][0].map(([lng, lat]) => [lat, lng]);
                        }

                        const floodColor = getFloodRiskColor(props.flood_level || 'ปานกลาง');

                        return (
                            <Polygon
                                key={uniqueKey}
                                positions={coordinates}
                                pathOptions={{
                                    color: floodColor,
                                    fillColor: floodColor,
                                    fillOpacity: 0.4,
                                    weight: 2,
                                    dashArray: '5, 5'
                                }}
                            >
                                <Popup>
                                    <div className="min-w-[250px]" style={{ fontFamily: 'var(--font-kanit)' }}>
                                        <div className="flex items-center gap-2 mb-2">
                                            <span className="text-lg">🌊</span>
                                            <h3 className="font-bold text-lg text-gray-800">
                                                {props.tambon || props.name || 'พื้นที่น้ำท่วม GISTDA'}
                                            </h3>
                                        </div>
                                        <div className="space-y-1 text-sm">
                                            {props.province && <p><strong>จังหวัด:</strong> {props.province}</p>}
                                            {props.district && <p><strong>อำเภอ:</strong> {props.district}</p>}
                                            <p>
                                                <strong>ระดับน้ำท่วม:</strong>{' '}
                                                <span
                                                    className="px-2 py-1 rounded text-white text-xs"
                                                    style={{ backgroundColor: floodColor }}
                                                >
                                                    {props.flood_level || 'ปานกลาง'}
                                                </span>
                                            </p>
                                            {props.water_depth && (
                                                <p><strong>ความลึก:</strong> {props.water_depth} ซม.</p>
                                            )}
                                            {props.affected_area && (
                                                <p><strong>พื้นที่:</strong> {props.affected_area.toLocaleString()} ตร.ม.</p>
                                            )}
                                            {props.description && (
                                                <p className="text-gray-600 mt-2">{props.description}</p>
                                            )}
                                            {props.date && (
                                                <p className="text-xs text-gray-500 mt-2 border-t pt-1">
                                                    แหล่งข้อมูล: GISTDA | {new Date(props.date).toLocaleDateString('th-TH')}
                                                </p>
                                            )}
                                        </div>
                                    </div>
                                </Popup>
                            </Polygon>
                        );
                    })}

                {/* Flood Frequency Layer */}
                {floodFreqData?.features
                    ?.filter((feature) => {
                        const geom = feature.geometry;
                        // ตรวจสอบว่ามี geometry และ coordinates ที่ถูกต้อง
                        if (!geom || !geom.coordinates || geom.coordinates.length === 0) {
                            return false;
                        }
                        return true;
                    })
                    .map((feature, idx) => {
                        const geom = feature.geometry;
                        const props = feature.properties;
                        const geometryType = geom?.type;

                        // สร้าง unique key
                        const uniqueKey = `freq-${props.district || ''}-${props.tambon || ''}-${idx}`;

                        // แปลง coordinates
                        let coordinates = [];

                        if (geometryType === 'Polygon') {
                            coordinates = geom.coordinates[0].map(([lng, lat]) => [lat, lng]);
                        } else if (geometryType === 'MultiPolygon') {
                            coordinates = geom.coordinates[0][0].map(([lng, lat]) => [lat, lng]);
                        }

                        const freqColor = getFloodFreqColor(props.frequency || 0);

                        return (
                            <Polygon
                                key={uniqueKey}
                                positions={coordinates}
                                pathOptions={{
                                    color: freqColor,
                                    fillColor: freqColor,
                                    fillOpacity: 0.5,
                                    weight: 2,
                                }}
                            >
                                <Popup>
                                    <div className="min-w-[250px]" style={{ fontFamily: 'var(--font-kanit)' }}>
                                        <div className="flex items-center gap-2 mb-2">
                                            <span className="text-lg">🔄</span>
                                            <h3 className="font-bold text-lg text-gray-800">
                                                พื้นที่น้ำท่วมซ้ำซาก
                                            </h3>
                                        </div>
                                        <div className="space-y-1 text-sm">
                                            {props.province && <p><strong>จังหวัด:</strong> {props.province}</p>}
                                            {props.district && <p><strong>อำเภอ:</strong> {props.district}</p>}
                                            {props.tambon && <p><strong>ตำบล:</strong> {props.tambon}</p>}
                                            <p>
                                                <strong>ความถี่:</strong>{' '}
                                                <span
                                                    className="px-2 py-1 rounded text-white text-xs font-semibold"
                                                    style={{ backgroundColor: freqColor }}
                                                >
                                                    {props.frequency || 0} ครั้ง/10 ปี
                                                </span>
                                            </p>
                                            {props.frequency_level && (
                                                <p><strong>ระดับ:</strong> {props.frequency_level}</p>
                                            )}
                                            {props.last_flood_year && (
                                                <p><strong>น้ำท่วมครั้งล่าสุด:</strong> {parseInt(props.last_flood_year) + 543}</p>
                                            )}
                                            {props.description && (
                                                <p className="text-gray-600 mt-2">{props.description}</p>
                                            )}
                                            <p className="text-xs text-gray-500 mt-2 border-t pt-1">
                                                แหล่งข้อมูล: GISTDA Flood Frequency
                                            </p>
                                        </div>
                                    </div>
                                </Popup>
                            </Polygon>
                        );
                    })}

                {/* แสดงชื่อหมู่บ้าน */}
                {showVillageLabels && (
                    <LayerGroup>
                        {polygons.map((polygon) => (
                            polygon.lat && polygon.lng && (
                                <Marker
                                    key={`village-label-${polygon.id}`}
                                    position={[parseFloat(polygon.lat), parseFloat(polygon.lng)]}
                                    icon={createLabelIcon(polygon.villname, 'village')}
                                />
                            )
                        ))}
                    </LayerGroup>
                )}

                {/* แสดงชื่อตำบล */}
                {showTambonLabels && (
                    <LayerGroup>
                        {Array.from(new Set(polygons.map(p => `${p.distname}|${p.subdistnam}`))).map((key) => {
                            const [distname, subdistnam] = key.split('|');
                            const tambonPolygons = polygons.filter(p => p.distname === distname && p.subdistnam === subdistnam && p.lat && p.lng);
                            if (tambonPolygons.length > 0) {
                                const avgLat = tambonPolygons.reduce((sum, p) => sum + parseFloat(p.lat), 0) / tambonPolygons.length;
                                const avgLng = tambonPolygons.reduce((sum, p) => sum + parseFloat(p.lng), 0) / tambonPolygons.length;
                                return (
                                    <Marker
                                        key={`tambon-label-${key}`}
                                        position={[avgLat, avgLng]}
                                        icon={createLabelIcon(`ต.${subdistnam}`, 'tambon')}
                                    />
                                );
                            }
                            return null;
                        })}
                    </LayerGroup>
                )}

                {/* แสดงชื่ออำเภอ */}
                {showDistrictLabels && (
                    <LayerGroup>
                        {Array.from(new Set(polygons.map(p => p.distname))).map((distname) => {
                            const districtPolygons = polygons.filter(p => p.distname === distname && p.lat && p.lng);
                            if (districtPolygons.length > 0) {
                                const avgLat = districtPolygons.reduce((sum, p) => sum + parseFloat(p.lat), 0) / districtPolygons.length;
                                const avgLng = districtPolygons.reduce((sum, p) => sum + parseFloat(p.lng), 0) / districtPolygons.length;
                                return (
                                    <Marker
                                        key={`district-label-${distname}`}
                                        position={[avgLat, avgLng]}
                                        icon={createLabelIcon(`อ.${distname}`, 'district')}
                                    />
                                );
                            }
                            return null;
                        })}
                    </LayerGroup>
                )}

                <MapBounds polygons={polygons} />
            </MapContainer>

            {/* Controls สำหรับแสดง/ซ่อน labels */}
            <div className="absolute top-6 right-6 bg-white p-3 rounded-lg shadow-lg z-[1000] space-y-2">
                <h4 className="font-bold text-sm text-gray-800 mb-2">แสดงชื่อ</h4>
                <label className="flex items-center gap-2 text-sm cursor-pointer">
                    <input
                        type="checkbox"
                        checked={showVillageLabels}
                        onChange={(e) => setShowVillageLabels(e.target.checked)}
                        className="w-4 h-4 text-blue-600 rounded"
                    />
                    <span>หมู่บ้าน</span>
                </label>
                <label className="flex items-center gap-2 text-sm cursor-pointer">
                    <input
                        type="checkbox"
                        checked={showTambonLabels}
                        onChange={(e) => setShowTambonLabels(e.target.checked)}
                        className="w-4 h-4 text-green-600 rounded"
                    />
                    <span>ตำบล</span>
                </label>
                <label className="flex items-center gap-2 text-sm cursor-pointer">
                    <input
                        type="checkbox"
                        checked={showDistrictLabels}
                        onChange={(e) => setShowDistrictLabels(e.target.checked)}
                        className="w-4 h-4 text-orange-600 rounded"
                    />
                    <span>อำเภอ</span>
                </label>
            </div>

            {/* Legend */}
            <div className="absolute bottom-6 right-6 bg-white p-4 rounded-lg shadow-lg z-[1000] max-w-xs">
                <h4 className="font-bold mb-3 text-gray-800">
                    {floodFreqData ? 'ความถี่น้ำท่วมซ้ำซาก' :
                        colorMode === 'risk'
                            ? (disasterType === 'flood' ? 'ระดับความเสี่ยงน้ำท่วม' : 'ระดับความเสี่ยงภัยแล้ง')
                            : colorMode === 'tambon' ? 'ตำบล'
                                : colorMode === 'district' ? 'อำเภอ'
                                    : 'จำนวนครัวเรือน'
                    }
                </h4>
                <div className="space-y-2">
                    {floodFreqData ? (
                        <Fragment key="freq-legend">
                            <LegendItem key="freq-very-high" color="#7C2D12" label="สูงมาก (7+ ครั้ง/10 ปี)" />
                            <LegendItem key="freq-high" color="#DC2626" label="สูง (5-6 ครั้ง/10 ปี)" />
                            <LegendItem key="freq-medium" color="#F59E0B" label="ปานกลาง (3-4 ครั้ง/10 ปี)" />
                            <LegendItem key="freq-low" color="#FCD34D" label="ต่ำ (1-2 ครั้ง/10 ปี)" />
                            <LegendItem key="freq-none" color="#10B981" label="ไม่มี" />
                        </Fragment>
                    ) : colorMode === 'risk' ? (
                        disasterType === 'flood' ? (
                            <Fragment key="flood-risk-legend">
                                <LegendItem key="flood-severe" color="#DC2626" label="สูงมาก" />
                                <LegendItem key="flood-high" color="#F59E0B" label="สูง" />
                                <LegendItem key="flood-medium" color="#FCD34D" label="ปานกลาง" />
                                <LegendItem key="flood-low" color="#10B981" label="ต่ำ" />
                                <LegendItem key="flood-safe" color="#6EE7B7" label="ปลอดภัย" />
                            </Fragment>
                        ) : (
                            <Fragment key="drought-risk-legend">
                                <LegendItem key="drought-severe" color="#7C2D12" label="สูงมาก" />
                                <LegendItem key="drought-high" color="#EA580C" label="สูง" />
                                <LegendItem key="drought-medium" color="#FB923C" label="ปานกลาง" />
                                <LegendItem key="drought-low" color="#FDE047" label="ต่ำ" />
                                <LegendItem key="drought-safe" color="#86EFAC" label="ปลอดภัย" />
                            </Fragment>
                        )
                    ) : colorMode === 'tambon' ? (
                        <div key="tambon-legend" className="text-sm text-gray-600">
                            <p>แต่ละสีแทนตำบลต่างกัน</p>
                            <p className="text-xs mt-1">(สีจัดแบบอัตโนมัติ)</p>
                        </div>
                    ) : colorMode === 'district' ? (
                        <Fragment key="district-legend">
                            <LegendItem key="district-mueang" color="#3B82F6" label="เมืองสตูล" />
                            <LegendItem key="district-khuan" color="#10B981" label="ควนโดน" />
                            <LegendItem key="district-kalong" color="#F59E0B" label="ควนกาหลง" />
                            <LegendItem key="district-thaphae" color="#8B5CF6" label="ท่าแพ" />
                            <LegendItem key="district-langu" color="#EC4899" label="ละงู" />
                            <LegendItem key="district-thungwa" color="#14B8A6" label="ทุ่งหว้า" />
                            <LegendItem key="district-manang" color="#F97316" label="มะนัง" />
                        </Fragment>
                    ) : (
                        <Fragment key="population-legend">
                            <LegendItem key="pop-0-50" color="#FEF3C7" label="0-50 ครัวเรือน" />
                            <LegendItem key="pop-51-100" color="#FCD34D" label="51-100 ครัวเรือน" />
                            <LegendItem key="pop-101-150" color="#F59E0B" label="101-150 ครัวเรือน" />
                            <LegendItem key="pop-151plus" color="#DC2626" label="151+ ครัวเรือน" />
                        </Fragment>
                    )}
                </div>
                {gistdaData && (
                    <div className="mt-3 pt-3 border-t">
                        <div className="flex items-center gap-2 mb-2">
                            <span className="text-sm font-semibold text-gray-700">ข้อมูล GISTDA:</span>
                        </div>
                        <div className="flex items-center gap-2">
                            <div className="w-8 h-3 border-2 border-blue-600" style={{ borderStyle: 'dashed' }}></div>
                            <span className="text-xs text-gray-600">พื้นที่น้ำท่วม</span>
                        </div>
                    </div>
                )}
            </div>

            {/* Selected Info */}
            {(selectedPolygon || selectedEvent) && (
                <div className="absolute top-6 right-6 bg-white p-4 rounded-lg shadow-lg z-[1000] max-w-sm">
                    <div className="flex justify-between items-start mb-2">
                        <h4 className="font-bold text-lg text-gray-800">
                            {selectedEvent ? `🚨 ${selectedEvent.type}` : selectedPolygon?.villname}
                        </h4>
                        <button
                            onClick={() => {
                                setSelectedPolygon(null);
                                setSelectedEvent(null);
                            }}
                            className="text-gray-500 hover:text-gray-700"
                        >
                            ✕
                        </button>
                    </div>
                    <div className="space-y-1 text-sm text-gray-600">
                        {selectedEvent ? (
                            <>
                                <p className="font-semibold text-red-600">ความรุนแรง: {selectedEvent.severity}</p>
                                <p>{selectedEvent.village}, {selectedEvent.tambon}</p>
                                <p>ผู้ได้รับผลกระทบ: {selectedEvent.affected} คน</p>
                                <p>สถานะ: {selectedEvent.status}</p>
                            </>
                        ) : (
                            <>
                                <p>{selectedPolygon?.subdistnam}, {selectedPolygon?.distname}</p>
                                <p className="font-semibold text-blue-600">
                                    {(selectedPolygon?.num_hh || 0).toLocaleString()} ครัวเรือน
                                </p>
                                {colorMode === 'risk' && (
                                    <p className="font-semibold text-red-600">
                                        ระดับความเสี่ยง: {selectedPolygon?.riskLevel || calculateRiskLevel(selectedPolygon)}
                                    </p>
                                )}
                            </>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}

// Component สำหรับแสดง legend item
function LegendItem({ color, label }) {
    return (
        <div className="flex items-center gap-2 text-sm">
            <div
                className="w-6 h-6 rounded border border-gray-300"
                style={{ backgroundColor: color }}
            />
            <span className="text-gray-700">{label}</span>
        </div>
    );
}
