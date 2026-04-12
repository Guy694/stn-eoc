"use client";
import React, { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

// Fix for default marker icon
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
    iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
    iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
    shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
});

const MapSelector = ({ position, onPositionChange }) => {
    const mapRef = useRef(null);
    const mapInstanceRef = useRef(null);
    const markerRef = useRef(null);
    const [gpsLoading, setGpsLoading] = useState(false);
    const [gpsError, setGpsError] = useState(null);

    // Helper: add/move draggable marker
    const setMarker = (map, lat, lng) => {
        if (markerRef.current) {
            map.removeLayer(markerRef.current);
        }
        markerRef.current = L.marker([lat, lng], { draggable: true }).addTo(map);
        markerRef.current.on('dragend', function (e) {
            const newPos = e.target.getLatLng();
            onPositionChange({ lat: newPos.lat, lng: newPos.lng });
        });
        onPositionChange({ lat, lng });
    };

    // GPS auto-detect
    const handleGPS = () => {
        if (!navigator.geolocation) {
            setGpsError('อุปกรณ์ไม่รองรับ GPS');
            return;
        }
        setGpsLoading(true);
        setGpsError(null);
        navigator.geolocation.getCurrentPosition(
            (pos) => {
                const lat = pos.coords.latitude;
                const lng = pos.coords.longitude;
                setGpsLoading(false);
                if (mapInstanceRef.current) {
                    mapInstanceRef.current.setView([lat, lng], 16);
                    setMarker(mapInstanceRef.current, lat, lng);
                }
            },
            (err) => {
                setGpsLoading(false);
                setGpsError('ไม่สามารถดึง GPS ได้: ' + err.message);
            },
            { enableHighAccuracy: true, timeout: 10000 }
        );
    };

    useEffect(() => {
        // Only create map once
        if (!mapInstanceRef.current && mapRef.current) {
            const defaultCenter = [6.6238, 100.0673];
            const initialPosition = position || { lat: defaultCenter[0], lng: defaultCenter[1] };

            const map = L.map(mapRef.current).setView(
                [initialPosition.lat, initialPosition.lng],
                position ? 15 : 11
            );

            L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
                attribution: '© OpenStreetMap contributors',
                maxZoom: 19,
            }).addTo(map);

            if (position) {
                markerRef.current = L.marker([position.lat, position.lng], { draggable: true }).addTo(map);
                markerRef.current.on('dragend', function (e) {
                    const newPos = e.target.getLatLng();
                    onPositionChange({ lat: newPos.lat, lng: newPos.lng });
                });
            }

            map.on('click', function (e) {
                const { lat, lng } = e.latlng;
                setMarker(map, lat, lng);
            });

            mapInstanceRef.current = map;

            // Auto-detect GPS on mount (only if no initial position)
            if (!position && navigator.geolocation) {
                navigator.geolocation.getCurrentPosition(
                    (pos) => {
                        const lat = pos.coords.latitude;
                        const lng = pos.coords.longitude;
                        map.setView([lat, lng], 16);
                        setMarker(map, lat, lng);
                    },
                    () => { /* silent fail on mount */ },
                    { enableHighAccuracy: true, timeout: 6000 }
                );
            }
        }

        // Update marker position if prop changes
        if (mapInstanceRef.current && position) {
            if (markerRef.current) {
                markerRef.current.setLatLng([position.lat, position.lng]);
            } else {
                markerRef.current = L.marker([position.lat, position.lng], { draggable: true }).addTo(mapInstanceRef.current);
                markerRef.current.on('dragend', function (e) {
                    const newPos = e.target.getLatLng();
                    onPositionChange({ lat: newPos.lat, lng: newPos.lng });
                });
            }
            mapInstanceRef.current.setView([position.lat, position.lng], 15);
        }
    }, [position, onPositionChange]);

    return (
        <div className="relative">
            {/* GPS Button */}
            <div className="mb-2 flex items-center gap-2">
                <button
                    type="button"
                    onClick={handleGPS}
                    disabled={gpsLoading}
                    className="flex items-center gap-2 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-sm rounded-lg transition disabled:opacity-60 shadow"
                >
                    {gpsLoading ? (
                        <>
                            <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                            กำลังหาตำแหน่ง...
                        </>
                    ) : (
                        <>📍 ใช้ GPS อุปกรณ์</>
                    )}
                </button>
                <span className="text-xs text-gray-500">หรือคลิกบนแผนที่ / ลากหมุดเพื่อเลือกตำแหน่ง</span>
            </div>
            {gpsError && (
                <div className="mb-2 flex items-center gap-2 text-xs text-red-600 bg-red-50 border border-red-200 px-3 py-1.5 rounded-lg">
                    ⚠️ {gpsError}
                </div>
            )}
            {position && (
                <div className="mb-2 text-xs text-green-700 bg-green-50 border border-green-200 px-3 py-1.5 rounded-lg flex items-center gap-2">
                    ✅ ตำแหน่งที่เลือก: {position.lat.toFixed(6)}, {position.lng.toFixed(6)}
                </div>
            )}
            <div
                ref={mapRef}
                style={{ height: '380px', width: '100%', borderRadius: '8px', zIndex: 1 }}
            />
        </div>
    );
};

export default MapSelector;
