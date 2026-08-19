/**
 * ML Feature Extraction Module
 */

const MLFeatureExtraction = {
    /**
     * Extracts features for a given road edge and the current active hazards
     * @param {Object} edge The graph edge {from, to, distance, roadType, oneWay, hazardPenalty}
     * @param {Object} fromNode The start node {lat, lon}
     * @param {Object} toNode The end node {lat, lon}
     * @param {Array} activeHazards Array of current reports
     * @returns {Object} Feature vector
     */
    extract: function(edge, fromNode, toNode, activeHazards) {
        // Base road features
        const features = {
            roadType: edge.roadType || 'unclassified',
            distance: edge.distance || 0,
            isOneWay: edge.oneWay ? 1 : 0,
            
            // Hazard features
            floodDistance: 99999, // Meters to nearest flood
            floodSeverity: 0,
            
            landslideDistance: 99999,
            landslideSeverity: 0,
            
            hazardCount: 0, // Total nearby hazards
            confirmationCount: 0, // Max confirmations among nearby hazards
            reportAgeHours: 999 // Age of nearest hazard
        };

        const MAX_CONSIDERATION_RADIUS = 2000; // Only consider hazards within 2km
        const NOW = Date.now();

        // Process hazards relative to this segment
        for (const h of activeHazards) {
            // Distance from segment to hazard
            const dist = window.GeoDistance.distanceToSegment(
                h.lat, h.lon, 
                fromNode.lat, fromNode.lon, 
                toNode.lat, toNode.lon
            );

            if (dist > MAX_CONSIDERATION_RADIUS) continue;
            
            features.hazardCount++;
            
            const confs = h.confirmations || 0;
            if (confs > features.confirmationCount) {
                features.confirmationCount = confs;
            }

            // Calculate age in hours (assuming h.timestamp exists, else assume fresh)
            const ageMs = h.timestamp ? (NOW - h.timestamp) : 0;
            const ageHours = ageMs / (1000 * 60 * 60);
            if (ageHours < features.reportAgeHours) {
                features.reportAgeHours = ageHours;
            }

            const sev = h.severity || 1;

            if (h.type === 'flood') {
                if (dist < features.floodDistance) {
                    features.floodDistance = dist;
                    features.floodSeverity = sev;
                }
            } else if (h.type === 'landslide') {
                if (dist < features.landslideDistance) {
                    features.landslideDistance = dist;
                    features.landslideSeverity = sev;
                }
            }
        }

        return features;
    }
};

window.MLFeatureExtraction = MLFeatureExtraction;
