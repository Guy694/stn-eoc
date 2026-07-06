export const MAP_BASE_LAYERS = {
    street: {
        label: 'แผนที่ถนน',
        url: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
    },
    topo: {
        label: 'Topographic Map',
        url: 'https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png',
        attribution: 'Map data: &copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>, SRTM | Map style: &copy; <a href="https://opentopomap.org">OpenTopoMap</a>'
    },
    satellite: {
        label: 'แผนที่ดาวเทียม',
        url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
        attribution: 'Tiles &copy; Esri'
    }
};

export const MAP_OVERLAY_LAYERS = {
    hillshade: {
        label: 'เงาภูมิประเทศ/ความสูง',
        url: 'https://services.arcgisonline.com/ArcGIS/rest/services/Elevation/World_Hillshade/MapServer/tile/{z}/{y}/{x}',
        attribution: 'Hillshade &copy; Esri',
        opacity: 0.42
    }
};

export function getMapBaseLayer(key) {
    return MAP_BASE_LAYERS[key] || MAP_BASE_LAYERS.street;
}

export function getMapOverlayLayer(key) {
    return MAP_OVERLAY_LAYERS[key] || null;
}
