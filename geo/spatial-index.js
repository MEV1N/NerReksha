/**
 * Basic Spatial Indexing / Bounding Box Utilities
 */

const SpatialIndex = {
    /**
     * Check if a point is within a bounding box
     * bbox: [minLat, minLon, maxLat, maxLon]
     */
    isPointInBounds: function(lat, lon, bbox) {
        return lat >= bbox[0] && lat <= bbox[2] && lon >= bbox[1] && lon <= bbox[3];
    },

    /**
     * Filter an array of items with {lat, lon} by bounding box
     */
    filterByBounds: function(items, bbox) {
        return items.filter(item => this.isPointInBounds(item.lat, item.lon, bbox));
    },
    
    /**
     * Create a bounding box around a center point with a given radius in meters
     */
    createBoundsAroundPoint: function(lat, lon, radiusMeters) {
        // Approximate degrees for lat/lon
        const latScale = 111320;
        const lonScale = latScale * Math.cos(lat * Math.PI / 180);
        
        const latOffset = radiusMeters / latScale;
        const lonOffset = radiusMeters / lonScale;
        
        return [
            lat - latOffset,
            lon - lonOffset,
            lat + latOffset,
            lon + lonOffset
        ];
    }
};

window.SpatialIndex = SpatialIndex;
