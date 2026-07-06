"use client";

import { useEffect, useState } from 'react';
import dynamic from 'next/dynamic';
import { getMapOverlayLayer } from '@/lib/mapBaseLayers';

const TileLayer = dynamic(() => import('react-leaflet').then((mod) => mod.TileLayer), { ssr: false });
const GeoJSON = dynamic(() => import('react-leaflet').then((mod) => mod.GeoJSON), { ssr: false });

function getWaterwayStyle(feature) {
    const waterwayType = feature?.properties?.waterway;
    const isMain = waterwayType === 'river' || waterwayType === 'canal';
    return {
        color: isMain ? '#0369A1' : '#0EA5E9',
        weight: isMain ? 2.4 : 1.4,
        opacity: isMain ? 0.95 : 0.72,
        dashArray: feature?.properties?.intermittent ? '5, 6' : null
    };
}

export default function HydroTerrainOverlays({ showHillshade = false, showWaterways = false }) {
    const [waterways, setWaterways] = useState(null);
    const hillshadeLayer = getMapOverlayLayer('hillshade');

    useEffect(() => {
        if (!showWaterways || waterways) return;
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
    }, [showWaterways, waterways]);

    return (
        <>
            {showHillshade && hillshadeLayer && (
                <TileLayer
                    attribution={hillshadeLayer.attribution}
                    url={hillshadeLayer.url}
                    opacity={hillshadeLayer.opacity}
                    zIndex={250}
                />
            )}
            {showWaterways && waterways?.features?.length > 0 && (
                <GeoJSON
                    key={`hydro-waterways-${waterways.features.length}`}
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
        </>
    );
}
