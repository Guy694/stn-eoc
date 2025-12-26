"use client";
import { MapContainer, TileLayer, Polygon, Popup, Marker, LayerGroup, useMap } from "react-leaflet";
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

export default function PolygonMap({
    polygons = [],
    colorMode = 'district', // 'district' หรือ 'population'
    onPolygonClick
}) {
    const [selectedPolygon, setSelectedPolygon] = useState(null);
    const [showDistrictLabels, setShowDistrictLabels] = useState(false);
    const [showTambonLabels, setShowTambonLabels] = useState(true);
    const [showVillageLabels, setShowVillageLabels] = useState(true);

    // ศูนย์กลางของจังหวัดสตูล
    const satunCenter = [6.6238, 100.0673];

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

    // เลือกสีตาม mode
    const getPolygonColor = (polygon) => {
        if (colorMode === 'population') {
            return getColorByPopulation(polygon.num_hh);
        }
        return getColorByDistrict(polygon.distname);
    };

    // Style สำหรับ polygon
    const getPolygonStyle = (polygon) => {
        const isSelected = selectedPolygon?.id === polygon.id;
        return {
            fillColor: getPolygonColor(polygon),
            fillOpacity: isSelected ? 0.8 : 0.5,
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
        layer.setStyle({
            fillOpacity: 0.8,
            weight: 3,
            color: '#000000'
        });
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
                                    <p><span className="font-semibold">จังหวัด:</span> {polygon.provname}</p>
                                    <hr className="my-2" />
                                    <p><span className="font-semibold">จำนวนครัวเรือน:</span> {polygon.num_hh.toLocaleString()} ครัวเรือน</p>
                                    <p><span className="font-semibold">จำนวนอาคาร:</span> {polygon.num_build.toLocaleString()} หลัง</p>
                                    {polygon.mun_tao_na && (
                                        <p><span className="font-semibold">หน่วยปกครอง:</span> {polygon.mun_tao_na}</p>
                                    )}
                                </div>
                            </div>
                        </Popup>
                    </Polygon>
                ))}

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
                    {colorMode === 'district' ? 'อำเภอ' : 'จำนวนครัวเรือน'}
                </h4>
                <div className="space-y-2">
                    {colorMode === 'district' ? (
                        <>
                            <LegendItem color="#3B82F6" label="เมืองสตูล" />
                            <LegendItem color="#10B981" label="ควนโดน" />
                            <LegendItem color="#F59E0B" label="ควนกาหลง" />
                            <LegendItem color="#8B5CF6" label="ท่าแพ" />
                            <LegendItem color="#EC4899" label="ละงู" />
                            <LegendItem color="#14B8A6" label="ทุ่งหว้า" />
                            <LegendItem color="#F97316" label="มะนัง" />
                        </>
                    ) : (
                        <>
                            <LegendItem color="#FEF3C7" label="0-50 ครัวเรือน" />
                            <LegendItem color="#FCD34D" label="51-100 ครัวเรือน" />
                            <LegendItem color="#F59E0B" label="101-150 ครัวเรือน" />
                            <LegendItem color="#DC2626" label="151+ ครัวเรือน" />
                        </>
                    )}
                </div>
            </div>

            {/* Selected Info */}
            {selectedPolygon && (
                <div className="absolute top-6 right-6 bg-white p-4 rounded-lg shadow-lg z-[1000] max-w-sm">
                    <div className="flex justify-between items-start mb-2">
                        <h4 className="font-bold text-lg text-gray-800">
                            {selectedPolygon.villname}
                        </h4>
                        <button
                            onClick={() => setSelectedPolygon(null)}
                            className="text-gray-500 hover:text-gray-700"
                        >
                            ✕
                        </button>
                    </div>
                    <div className="space-y-1 text-sm text-gray-600">
                        <p>{selectedPolygon.subdistnam}, {selectedPolygon.distname}</p>
                        <p className="font-semibold text-blue-600">
                            {selectedPolygon.num_hh.toLocaleString()} ครัวเรือน
                        </p>
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
