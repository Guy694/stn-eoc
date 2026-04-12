"use client";
import { useEffect, useState, useRef } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

// Fix for default marker icons
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
});

const accidentIcon = new L.Icon({
  iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-red.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
  iconSize: [25, 41], iconAnchor: [12, 41], popupAnchor: [1, -34], shadowSize: [41, 41]
});

const servicePointIcon = new L.Icon({
  iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-green.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
  iconSize: [25, 41], iconAnchor: [12, 41], popupAnchor: [1, -34], shadowSize: [41, 41]
});

// Invalidate map size when fullscreen state changes
function MapResizer({ trigger }) {
  const map = useMap();
  useEffect(() => {
    setTimeout(() => map.invalidateSize(), 100);
  }, [trigger, map]);
  return null;
}

export default function FestivalMap({ accidents = [], servicePoints = [] }) {
  const defaultCenter = [6.6231, 100.0674];
  const defaultZoom = 10;
  const [isFullscreen, setIsFullscreen] = useState(false);
  const containerRef = useRef(null);

  // Toggle native fullscreen (falls back to CSS fullscreen)
  const toggleFullscreen = () => {
    if (!isFullscreen) {
      if (containerRef.current?.requestFullscreen) {
        containerRef.current.requestFullscreen();
      } else {
        setIsFullscreen(true);
      }
    } else {
      if (document.exitFullscreen) {
        document.exitFullscreen();
      } else {
        setIsFullscreen(false);
      }
    }
  };

  // Sync state with native fullscreen events
  useEffect(() => {
    const onFsChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };
    document.addEventListener('fullscreenchange', onFsChange);
    return () => document.removeEventListener('fullscreenchange', onFsChange);
  }, []);

  // ESC key closes CSS fallback fullscreen
  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') setIsFullscreen(false); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  return (
    <div
      ref={containerRef}
      className={isFullscreen
        ? 'fixed inset-0 z-[99999] bg-black flex flex-col'
        : 'relative w-full rounded-xl overflow-hidden shadow-md border border-gray-200'}
      style={{ height: isFullscreen ? '100vh' : '500px' }}
    >
      {/* Fullscreen Button */}
      <button
        onClick={toggleFullscreen}
        title={isFullscreen ? 'ออกจากเต็มจอ' : 'ดูแบบเต็มจอ'}
        className="absolute top-3 right-3 z-[9999] bg-white hover:bg-gray-100 border border-gray-300 shadow-md rounded-lg px-3 py-1.5 text-sm font-medium text-gray-700 flex items-center gap-1.5 transition"
      >
        {isFullscreen ? '✕ ออกจากเต็มจอ' : '⛶ เต็มจอ'}
      </button>

      <MapContainer
        center={defaultCenter}
        zoom={defaultZoom}
        style={{ height: '100%', width: '100%', zIndex: 0 }}
      >
        <MapResizer trigger={isFullscreen} />
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />

        {servicePoints.map((point) => {
          if (!point.lat || !point.lng) return null;
          return (
            <Marker
              key={`sp-${point.id}`}
              position={[parseFloat(point.lat), parseFloat(point.lng)]}
              icon={servicePointIcon}
            >
              <Popup>
                <div className="font-sans">
                  <h3 className="font-bold text-green-700 mb-1">🏕️ {point.name}</h3>
                  <p className="text-sm">ประเภท: {point.point_type}</p>
                  <p className="text-sm">อ.{point.district} ต.{point.tambon}</p>
                  <p className="text-xs text-gray-500 mt-1">เจ้าหน้าที่: {point.officer_count} นาย</p>
                </div>
              </Popup>
            </Marker>
          );
        })}

        {accidents.map((accident) => {
          if (!accident.lat || !accident.lng) return null;
          return (
            <Marker
              key={`acc-${accident.id}`}
              position={[parseFloat(accident.lat), parseFloat(accident.lng)]}
              icon={accidentIcon}
            >
              <Popup>
                <div className="font-sans">
                  <h3 className="font-bold text-red-600 mb-1">💥 {accident.accident_type || 'อุบัติเหตุ'}</h3>
                  <p className="text-sm">วันที่: {accident.report_date ? new Date(accident.report_date).toLocaleDateString('th-TH') : ''} {accident.report_time || ''}</p>
                  <p className="text-sm">สถานที่: {accident.location_name || 'ไม่ระบุ'}</p>
                  <div className="flex gap-2 mt-1">
                    {accident.deaths > 0 && <span className="bg-gray-800 text-white text-xs px-2 rounded-full">เสียชีวิต: {accident.deaths}</span>}
                    {accident.injuries > 0 && <span className="bg-yellow-100 text-yellow-800 text-xs px-2 rounded-full border border-yellow-200">บาดเจ็บ: {accident.injuries}</span>}
                  </div>
                  {(accident.drunk_driving || accident.no_helmet || accident.speeding) && (
                    <div className="mt-2 text-xs text-red-500">
                      ปัจจัย: {accident.drunk_driving ? 'เมา ' : ''}{accident.no_helmet ? 'ไม่สวมหมวก ' : ''}{accident.speeding ? 'ขับเร็ว ' : ''}
                    </div>
                  )}
                </div>
              </Popup>
            </Marker>
          );
        })}
      </MapContainer>
    </div>
  );
}
