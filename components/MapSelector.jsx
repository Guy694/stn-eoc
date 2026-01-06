"use client";
import React, { useEffect, useRef } from 'react';
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

    useEffect(() => {
        // Only create map once
        if (!mapInstanceRef.current && mapRef.current) {
            // Default center to Satun Province
            const defaultCenter = [6.6238, 100.0673];
            const initialPosition = position || { lat: defaultCenter[0], lng: defaultCenter[1] };

            // Initialize map
            const map = L.map(mapRef.current).setView(
                [initialPosition.lat, initialPosition.lng],
                position ? 15 : 11
            );

            // Add tile layer
            L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
                attribution: '© OpenStreetMap contributors',
                maxZoom: 19,
            }).addTo(map);

            // Add initial marker if position exists
            if (position) {
                markerRef.current = L.marker([position.lat, position.lng], {
                    draggable: true
                }).addTo(map);

                // Handle marker drag
                markerRef.current.on('dragend', function (e) {
                    const newPos = e.target.getLatLng();
                    onPositionChange({ lat: newPos.lat, lng: newPos.lng });
                });
            }

            // Handle map click
            map.on('click', function (e) {
                const { lat, lng } = e.latlng;

                // Remove existing marker
                if (markerRef.current) {
                    map.removeLayer(markerRef.current);
                }

                // Add new marker
                markerRef.current = L.marker([lat, lng], {
                    draggable: true
                }).addTo(map);

                // Handle marker drag
                markerRef.current.on('dragend', function (e) {
                    const newPos = e.target.getLatLng();
                    onPositionChange({ lat: newPos.lat, lng: newPos.lng });
                });

                // Update position
                onPositionChange({ lat, lng });
            });

            mapInstanceRef.current = map;
        }

        // Update marker position if prop changes
        if (mapInstanceRef.current && position) {
            if (markerRef.current) {
                markerRef.current.setLatLng([position.lat, position.lng]);
            } else {
                markerRef.current = L.marker([position.lat, position.lng], {
                    draggable: true
                }).addTo(mapInstanceRef.current);

                markerRef.current.on('dragend', function (e) {
                    const newPos = e.target.getLatLng();
                    onPositionChange({ lat: newPos.lat, lng: newPos.lng });
                });
            }

            mapInstanceRef.current.setView([position.lat, position.lng], 15);
        }

        // Cleanup
        return () => {
            // Don't cleanup on every render, only when component unmounts
        };
    }, [position, onPositionChange]);

    return (
        <div
            ref={mapRef}
            style={{
                height: '400px',
                width: '100%',
                borderRadius: '8px',
                zIndex: 1
            }}
        />
    );
};

export default MapSelector;
