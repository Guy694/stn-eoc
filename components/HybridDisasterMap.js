"use client";
import { MapContainer, TileLayer, Polygon, Popup, CircleMarker, useMap } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { useState, useEffect } from "react";

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
    startDate = '',
    endDate = ''
}) {
    const [selectedPolygon, setSelectedPolygon] = useState(null);
    const [selectedEvent, setSelectedEvent] = useState(null);

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

    // ฟังก์ชันเลือกสีตามจำนวนครัวเรือน
    const getColorByPopulation = (numHH) => {
        if (numHH <= 50) return '#FEF3C7';
        if (numHH <= 100) return '#FCD34D';
        if (numHH <= 150) return '#F59E0B';
        return '#DC2626';
    };

    // เลือกสีตาม mode และประเภทภัย
    const getPolygonColor = (polygon) => {
        if (colorMode === 'risk') {
            // ใช้ข้อมูลความเสี่ยงจาก polygon หรือคำนวณจากข้อมูลอื่น
            const riskLevel = polygon.riskLevel || calculateRiskLevel(polygon);
            if (disasterType === 'flood') {
                return getFloodRiskColor(riskLevel);
            } else {
                return getDroughtRiskColor(riskLevel);
            }
        } else if (colorMode === 'population') {
            return getColorByPopulation(polygon.num_hh);
        }
        return getColorByDistrict(polygon.distname);
    };

    // คำนวณระดับความเสี่ยง (ตัวอย่าง - ควรใช้ข้อมูลจริงจากฐานข้อมูล)
    const calculateRiskLevel = (polygon) => {
        // ตัวอย่างการคำนวณความเสี่ยง
        // ควรมีข้อมูลจริงจาก database หรือ API
        const risks = ['ปลอดภัย', 'ต่ำ', 'ปานกลาง', 'สูง', 'สูงมาก'];
        return risks[Math.floor(Math.random() * risks.length)];
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
                            <div className="min-w-[200px]">
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
                            <div className="min-w-[200px]">
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
                {gistdaData?.features?.map((feature, idx) => {
                    const geom = feature.geometry;
                    const props = feature.properties;
                    const geometryType = geom?.type;

                    // กรองตามช่วงวันที่ถ้ามีการตั้งค่า
                    if (startDate && props.date && new Date(props.date) < new Date(startDate)) {
                        return null;
                    }
                    if (endDate && props.date && new Date(props.date) > new Date(endDate)) {
                        return null;
                    }

                    // แปลง coordinates
                    let coordinates = [];

                    if (geometryType === 'Polygon') {
                        coordinates = geom.coordinates[0].map(([lng, lat]) => [lat, lng]);
                    } else if (geometryType === 'MultiPolygon') {
                        coordinates = geom.coordinates[0][0].map(([lng, lat]) => [lat, lng]);
                    }

                    if (coordinates.length === 0) return null;

                    const floodColor = getFloodRiskColor(props.flood_level || 'ปานกลาง');

                    return (
                        <Polygon
                            key={`gistda-${idx}`}
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
                                <div className="min-w-[250px]">
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

                <MapBounds polygons={polygons} />
            </MapContainer>

            {/* Legend */}
            <div className="absolute bottom-6 right-6 bg-white p-4 rounded-lg shadow-lg z-[1000] max-w-xs">
                <h4 className="font-bold mb-3 text-gray-800">
                    {colorMode === 'risk'
                        ? (disasterType === 'flood' ? 'ระดับความเสี่ยงน้ำท่วม' : 'ระดับความเสี่ยงภัยแล้ง')
                        : colorMode === 'district' ? 'อำเภอ' : 'จำนวนครัวเรือน'
                    }
                </h4>
                <div className="space-y-2">
                    {colorMode === 'risk' ? (
                        disasterType === 'flood' ? (
                            <>
                                <LegendItem key="flood-severe" color="#DC2626" label="สูงมาก" />
                                <LegendItem key="flood-high" color="#F59E0B" label="สูง" />
                                <LegendItem key="flood-medium" color="#FCD34D" label="ปานกลาง" />
                                <LegendItem key="flood-low" color="#10B981" label="ต่ำ" />
                                <LegendItem key="flood-safe" color="#6EE7B7" label="ปลอดภัย" />
                            </>
                        ) : (
                            <>
                                <LegendItem key="drought-severe" color="#7C2D12" label="สูงมาก" />
                                <LegendItem key="drought-high" color="#EA580C" label="สูง" />
                                <LegendItem key="drought-medium" color="#FB923C" label="ปานกลาง" />
                                <LegendItem key="drought-low" color="#FDE047" label="ต่ำ" />
                                <LegendItem key="drought-safe" color="#86EFAC" label="ปลอดภัย" />
                            </>
                        )
                    ) : colorMode === 'district' ? (
                        <>
                            <LegendItem key="district-mueang" color="#3B82F6" label="เมืองสตูล" />
                            <LegendItem key="district-khuan" color="#10B981" label="ควนโดน" />
                            <LegendItem key="district-kalong" color="#F59E0B" label="ควนกาหลง" />
                            <LegendItem key="district-thaphae" color="#8B5CF6" label="ท่าแพ" />
                            <LegendItem key="district-langu" color="#EC4899" label="ละงู" />
                            <LegendItem key="district-thungwa" color="#14B8A6" label="ทุ่งหว้า" />
                            <LegendItem key="district-manang" color="#F97316" label="มะนัง" />
                        </>
                    ) : (
                        <>
                            <LegendItem key="pop-0-50" color="#FEF3C7" label="0-50 ครัวเรือน" />
                            <LegendItem key="pop-51-100" color="#FCD34D" label="51-100 ครัวเรือน" />
                            <LegendItem key="pop-101-150" color="#F59E0B" label="101-150 ครัวเรือน" />
                            <LegendItem key="pop-151plus" color="#DC2626" label="151+ ครัวเรือน" />
                        </>
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
