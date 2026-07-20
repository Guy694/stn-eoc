'use client';

import { useCallback, useEffect, useState } from 'react';
import dynamic from 'next/dynamic';
import EOCLayout from '@/components/layouts/EOCLayout';
import AppIcon from "@/components/icons/AppIcon";
import { renderToStaticMarkup } from 'react-dom/server';

const MapContainer = dynamic(() => import('react-leaflet').then(mod => mod.MapContainer), { ssr: false });
const TileLayer = dynamic(() => import('react-leaflet').then(mod => mod.TileLayer), { ssr: false });
const Marker = dynamic(() => import('react-leaflet').then(mod => mod.Marker), { ssr: false });
const Popup = dynamic(() => import('react-leaflet').then(mod => mod.Popup), { ssr: false });
const Circle = dynamic(() => import('react-leaflet').then(mod => mod.Circle), { ssr: false });
const Polygon = dynamic(() => import('react-leaflet').then(mod => mod.Polygon), { ssr: false });

export default function GistdaFloodMapPage() {
    const [floodData, setFloodData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [selectedDays, setSelectedDays] = useState('30');
    const [isClient, setIsClient] = useState(false);
    const [L, setL] = useState(null);

    useEffect(() => {
        setIsClient(true);
        import('leaflet').then((leaflet) => {
            setL(leaflet.default);
        });
    }, []);

    const fetchFloodData = useCallback(async () => {
        try {
            setLoading(true);
            setError(null);

            const response = await fetch(`/stn-eoc/api/eoc/gistda/flood?days=${selectedDays}&limit=100&pv_idn=91`);
            const data = await response.json();

            if (data.success || data.useMockData) {
                setFloodData(data.useMockData ? data.data : data);
            } else {
                setError(data.error || 'Failed to fetch data');
            }
        } catch (err) {
            console.error('Error fetching flood data:', err);
            setError('ไม่สามารถโหลดข้อมูลได้');
        } finally {
            setLoading(false);
        }
    }, [selectedDays]);

    useEffect(() => {
        fetchFloodData();
    }, [fetchFloodData]);

    const getFloodColor = (level) => {
        const colors = {
            severe: '#DC2626',
            moderate: '#F59E0B',
            mild: '#10B981',
            safe: '#3B82F6'
        };
        return colors[level] || '#6B7280';
    };

    const getFloodRadius = (depth) => {
        // คำนวณรัศมีวงกลมตามความลึก (meter)
        return Math.min(Math.max(depth * 10, 100), 1000);
    };

    const createCustomIcon = (level) => {
        if (!L) return null;

        const color = getFloodColor(level);
        const iconHtml = `
            <div style="
                background-color: ${color};
 width: 30px;
 height: 30px;
 border-radius: 50%;
 border: 3px solid white;
 box-shadow: 0 2px 5px rgba(0,0,0,0.3);
 display: flex;
 align-items: center;
 justify-content: center;
 font-size: 16px;
 ">
 ${renderToStaticMarkup(<AppIcon icon="droplet" className="h-4 w-4 text-white" />)}
 </div>
 `;

        return L.divIcon({
            html: iconHtml,
            className: 'custom-flood-icon',
            iconSize: [30, 30],
            iconAnchor: [15, 15]
        });
    };

    if (!isClient) {
        return (
            <EOCLayout>
                <div className="flex items-center justify-center h-screen">
                    <div className="text-gray-500">กำลังโหลด...</div>
                </div>
            </EOCLayout>
        );
    }

    return (
        <EOCLayout>
            <div className="h-screen flex flex-col">
                {/* Header */}
                <div className="bg-white shadow-md p-4">
                    <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-between gap-4">
                        <div>
                            <h1 className="text-2xl font-bold text-gray-800">
                                <AppIcon icon="waves" className="inline-block h-[1em] w-[1em] shrink-0 align-[-0.125em]" /> แผนที่อุทกภัยน้ำท่วม GISTDA
                            </h1>
                            <p className="text-sm text-gray-600">
                                {floodData?.source === 'MOCK' ? (
                                    <span className="text-orange-600"><AppIcon icon="alert" className="inline-block h-[1em] w-[1em] shrink-0 align-[-0.125em]" /> กำลังใช้ข้อมูลจำลอง (ยังไม่มี API Key)</span>
                                ) : (
                                    `ข้อมูลจาก GISTDA - อัปเดตล่าสุด: ${floodData?.summary?.lastUpdate ? new Date(floodData.summary.lastUpdate).toLocaleString('th-TH') : '-'}`
                                )}
                            </p>
                        </div>

                        <div className="flex items-center gap-4">
                            <select
                                value={selectedDays}
                                onChange={(e) => setSelectedDays(e.target.value)}
                                className="px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                            >
                                <option value="1">1 วันล่าสุด</option>
                                <option value="7">7 วันล่าสุด</option>
                                <option value="30">30 วันล่าสุด</option>
                            </select>

                            <button
                                onClick={fetchFloodData}
                                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                            >
                                <AppIcon icon="refresh" className="inline-block h-[1em] w-[1em] shrink-0 align-[-0.125em]" /> รีเฟรช
                            </button>
                        </div>
                    </div>
                </div>

                {/* Stats Bar */}
                {floodData && (
                    <div className="bg-gray-50 border-b p-4">
                        <div className="max-w-7xl mx-auto grid grid-cols-3 gap-4">
                            <div className="bg-white p-3 rounded-lg shadow">
                                <div className="text-sm text-gray-600">พื้นที่อุทกภัยน้ำท่วมทั้งหมด</div>
                                <div className="text-2xl font-bold text-blue-600">
                                    {floodData.summary?.totalAreas || 0}
                                </div>
                            </div>
                            <div className="bg-white p-3 rounded-lg shadow">
                                <div className="text-sm text-gray-600">จังหวัดที่ได้รับผลกระทบ</div>
                                <div className="text-2xl font-bold text-orange-600">
                                    {floodData.summary?.provinces?.length || 0}
                                </div>
                            </div>
                            <div className="bg-white p-3 rounded-lg shadow">
                                <div className="text-sm text-gray-600">แหล่งข้อมูล</div>
                                <div className="text-xl font-bold text-green-600">
                                    {floodData.source}
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {/* Map */}
                <div className="flex-1 relative">
                    {loading ? (
                        <div className="absolute inset-0 flex items-center justify-center bg-gray-100">
                            <div className="text-center">
                                <div className="animate-spin rounded-full h-16 w-16 border-b border-blue-600 mx-auto mb-4"></div>
                                <div className="text-gray-600">กำลังโหลดข้อมูล...</div>
                            </div>
                        </div>
                    ) : error ? (
                        <div className="absolute inset-0 flex items-center justify-center bg-gray-100">
                            <div className="text-center text-red-600">
                                <div className="text-4xl mb-4"><AppIcon icon="alert" className="inline-block h-[1em] w-[1em] shrink-0 align-[-0.125em]" /></div>
                                <div className="text-xl font-semibold mb-2">เกิดข้อผิดพลาด</div>
                                <div>{error}</div>
                            </div>
                        </div>
                    ) : (
                        <MapContainer
                            center={[6.6238, 100.0673]}
                            zoom={10}
                            style={{ height: '100%', width: '100%' }}
                        >
                            <TileLayer
                                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                                attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
                            />

                            {/* แสดงข้อมูลอุทกภัยน้ำท่วม */}
                            {floodData?.features?.map((feature, idx) => {
                                const geom = feature.geometry;
                                const props = feature.properties;
                                const geometryType = geom?.type;

                                // แปลง coordinates ตาม geometry type
                                let coordinates = [];
                                let centerPoint = null;

                                if (geometryType === 'Point') {
                                    const [lng, lat] = geom.coordinates;
                                    centerPoint = [lat, lng];
                                } else if (geometryType === 'Polygon') {
                                    // Polygon: [[lng, lat], [lng, lat], ...]
                                    coordinates = geom.coordinates[0].map(([lng, lat]) => [lat, lng]);
                                    // หาจุดกึ่งกลาง
                                    const avgLat = coordinates.reduce((sum, [lat]) => sum + lat, 0) / coordinates.length;
                                    const avgLng = coordinates.reduce((sum, [, lng]) => sum + lng, 0) / coordinates.length;
                                    centerPoint = [avgLat, avgLng];
                                } else if (geometryType === 'MultiPolygon') {
                                    // MultiPolygon: [[[lng, lat], ...], [[lng, lat], ...]]
                                    coordinates = geom.coordinates[0][0].map(([lng, lat]) => [lat, lng]);
                                    const avgLat = coordinates.reduce((sum, [lat]) => sum + lat, 0) / coordinates.length;
                                    const avgLng = coordinates.reduce((sum, [, lng]) => sum + lng, 0) / coordinates.length;
                                    centerPoint = [avgLat, avgLng];
                                }

                                if (!centerPoint && coordinates.length === 0) return null;

                                return (
                                    <div key={`flood-${idx}`}>
                                        {/* แสดง Polygon ถ้าเป็น Polygon/MultiPolygon */}
                                        {(geometryType === 'Polygon' || geometryType === 'MultiPolygon') && coordinates.length > 0 && (
                                            <Polygon
                                                positions={coordinates}
                                                pathOptions={{
                                                    color: getFloodColor(props.flood_level || 'mild'),
                                                    fillColor: getFloodColor(props.flood_level || 'mild'),
                                                    fillOpacity: 0.5,
                                                    weight: 2
                                                }}
                                            >
                                                <Popup>
                                                    <div className="min-w-[250px]">
                                                        <h3 className="font-bold text-lg mb-2 text-gray-800">
                                                            {props.tambon || props.name || 'พื้นที่อุทกภัยน้ำท่วม'}
                                                        </h3>
                                                        <div className="space-y-1 text-sm">
                                                            {props.province && <p><strong>จังหวัด:</strong> {props.province}</p>}
                                                            {props.district && <p><strong>อำเภอ:</strong> {props.district}</p>}
                                                            <p>
                                                                <strong>ระดับอุทกภัยน้ำท่วม:</strong>{' '}
                                                                <span
                                                                    className="px-2 py-1 rounded text-white text-xs"
                                                                    style={{ backgroundColor: getFloodColor(props.flood_level || 'mild') }}
                                                                >
                                                                    {props.flood_level || 'mild'}
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
                                                                <p className="text-xs text-gray-500 mt-2">
                                                                    วันที่: {new Date(props.date).toLocaleDateString('th-TH')}
                                                                </p>
                                                            )}
                                                        </div>
                                                    </div>
                                                </Popup>
                                            </Polygon>
                                        )}

                                        {/* Circle แสดงขอบเขตพื้นที่อุทกภัยน้ำท่วม (เฉพาะ Point) */}
                                        {geometryType === 'Point' && centerPoint && (
                                            <Circle
                                                center={centerPoint}
                                                radius={getFloodRadius(props.water_depth || 50)}
                                                pathOptions={{
                                                    color: getFloodColor(props.flood_level || 'mild'),
                                                    fillColor: getFloodColor(props.flood_level || 'mild'),
                                                    fillOpacity: 0.5,
                                                    weight: 2
                                                }}
                                            >
                                                <Popup>
                                                    <div className="min-w-[250px]">
                                                        <h3 className="font-bold text-lg mb-2 text-gray-800">
                                                            {props.tambon || props.name || 'พื้นที่อุทกภัยน้ำท่วม'}
                                                        </h3>
                                                        <div className="space-y-1 text-sm">
                                                            {props.province && <p><strong>จังหวัด:</strong> {props.province}</p>}
                                                            {props.district && <p><strong>อำเภอ:</strong> {props.district}</p>}
                                                            <p>
                                                                <strong>ระดับอุทกภัยน้ำท่วม:</strong>{' '}
                                                                <span
                                                                    className="px-2 py-1 rounded text-white text-xs"
                                                                    style={{ backgroundColor: getFloodColor(props.flood_level || 'mild') }}
                                                                >
                                                                    {props.flood_level || 'mild'}
                                                                </span>
                                                            </p>
                                                            {props.water_depth && (
                                                                <p><strong>ความลึก:</strong> {props.water_depth} ซม.</p>
                                                            )}
                                                            {props.affected_area && (
                                                                <p><strong>พื้นที่ได้รับผลกระทบ:</strong> {props.affected_area.toLocaleString()} ตร.ม.</p>
                                                            )}
                                                            {props.description && (
                                                                <p className="text-gray-600 mt-2">{props.description}</p>
                                                            )}
                                                            {props.date && (
                                                                <p className="text-xs text-gray-500 mt-2">
                                                                    วันที่: {new Date(props.date).toLocaleDateString('th-TH')}
                                                                </p>
                                                            )}
                                                        </div>
                                                    </div>
                                                </Popup>
                                            </Circle>
                                        )}
                                    </div>
                                );
                            })}
                        </MapContainer>
                    )}

                    {/* Legend */}
                    {!loading && !error && (
                        <div className="absolute bottom-6 left-6 bg-white p-4 rounded-lg shadow-lg z-[1000]">
                            <h4 className="font-bold mb-3 text-gray-800">ระดับความรุนแรง</h4>
                            <div className="space-y-2">
                                <div className="flex items-center gap-2">
                                    <div className="w-4 h-4 rounded-full" style={{ backgroundColor: '#DC2626' }}></div>
                                    <span className="text-sm">รุนแรงมาก (Severe)</span>
                                </div>
                                <div className="flex items-center gap-2">
                                    <div className="w-4 h-4 rounded-full" style={{ backgroundColor: '#F59E0B' }}></div>
                                    <span className="text-sm">ปานกลาง (Moderate)</span>
                                </div>
                                <div className="flex items-center gap-2">
                                    <div className="w-4 h-4 rounded-full" style={{ backgroundColor: '#10B981' }}></div>
                                    <span className="text-sm">เล็กน้อย (Mild)</span>
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </EOCLayout>
    );
}
