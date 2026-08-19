/**
 * Geospatial distance utilities
 */

const GeoDistance = {
    // Earth radius in meters
    R: 6371000,

    /**
     * Calculate Haversine distance between two points in meters
     */
    haversine: function(lat1, lon1, lat2, lon2) {
        const dLat = (lat2 - lat1) * Math.PI / 180;
        const dLon = (lon2 - lon1) * Math.PI / 180;
        const a = 
            Math.sin(dLat/2) * Math.sin(dLat/2) +
            Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * 
            Math.sin(dLon/2) * Math.sin(dLon/2);
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
        return this.R * c;
    },

    /**
     * Helper to find distance to a line segment (used for hazard checking)
     */
    distanceToSegment: function(pointLat, pointLon, startLat, startLon, endLat, endLon) {
        const latScale = 111320;
        const lonScale = latScale * Math.cos(pointLat * Math.PI / 180);

        const px = pointLon * lonScale;
        const py = pointLat * latScale;
        const sx = startLon * lonScale;
        const sy = startLat * latScale;
        const ex = endLon * lonScale;
        const ey = endLat * latScale;

        const l2 = (ex - sx) * (ex - sx) + (ey - sy) * (ey - sy);
        if (l2 === 0) return this.haversine(pointLat, pointLon, startLat, startLon);

        let t = ((px - sx) * (ex - sx) + (py - sy) * (ey - sy)) / l2;
        t = Math.max(0, Math.min(1, t));

        const projx = sx + t * (ex - sx);
        const projy = sy + t * (ey - sy);

        return Math.hypot(px - projx, py - projy);
    }
};

window.GeoDistance = GeoDistance;
