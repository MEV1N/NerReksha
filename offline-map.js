/**
 * Offline Map Strategy for Leaflet
 */

const OfflineMap = {
    init: function(map, defaultLocation) {
        // We will use standard Leaflet tile layer, but rely on the Service Worker 
        // to intercept tile requests and serve them from the Cache API when offline.
        
        const tileLayer = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            maxZoom: 19,
            attribution: '© OpenStreetMap'
        }).addTo(map);

        // Add a visual bounding box for the offline region if it exists
        this._drawRegionBounds(map);
        
        // Listen for data ready to draw bounds if they arrive late
        window.addEventListener('nerreksha-data-ready', () => {
            this._drawRegionBounds(map);
        });
        
        return tileLayer;
    },
    
    _drawRegionBounds: async function(map) {
        if (typeof NerRekshaData === 'undefined') return;
        
        const metadata = await NerRekshaData.loadMapMetadata();
        if (metadata && metadata.length > 0) {
            const region = metadata.find(m => m.id === 'current_region');
            if (region && region.bbox) {
                // bbox is [minLat, minLon, maxLat, maxLon]
                const bounds = [
                    [region.bbox[0], region.bbox[1]],
                    [region.bbox[2], region.bbox[3]]
                ];
                
                // Remove existing bounds layer if any
                if (this.boundsLayer) {
                    map.removeLayer(this.boundsLayer);
                }
                
                this.boundsLayer = L.rectangle(bounds, {
                    color: '#FF9800', 
                    weight: 2, 
                    fillOpacity: 0.05,
                    dashArray: '5, 5'
                }).bindPopup("Available Offline Region").addTo(map);
            }
        }
    }
};

window.OfflineMap = OfflineMap;
