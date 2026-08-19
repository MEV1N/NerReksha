/**
 * Offline Search Engine for Places and Resources
 */

const OfflineSearch = {
    places: [], // Loaded from IndexedDB

    init: async function() {
        if (typeof NerRekshaData !== 'undefined') {
            this.places = await NerRekshaData.loadPlaces();
        }
    },

    /**
     * Normalize a string for searching
     */
    _normalize: function(str) {
        if (!str) return '';
        return str.toLowerCase()
                  .replace(/[^\w\s\u0D00-\u0D7F]/g, '') // Keep alphanumeric and Malayalam
                  .replace(/\s+/g, ' ')
                  .trim();
    },

    /**
     * Search places by query
     * @param {String} query 
     * @param {Object} userLocation {lat, lon} optional for distance sorting
     */
    searchPlaces: function(query, userLocation = null) {
        const normQuery = this._normalize(query);
        if (!normQuery) return [];

        const tokens = normQuery.split(' ');

        const results = this.places.map(place => {
            let score = 0;
            const normName = this._normalize(place.name);
            const aliases = (place.aliases || []).map(a => this._normalize(a));
            
            // 1. Exact match
            if (normName === normQuery || aliases.includes(normQuery)) {
                score += 100;
            }
            
            // 2. Prefix match
            if (normName.startsWith(normQuery)) {
                score += 50;
            } else {
                for (const alias of aliases) {
                    if (alias.startsWith(normQuery)) {
                        score += 40;
                        break;
                    }
                }
            }

            // 3. Token match
            let tokensMatched = 0;
            for (const token of tokens) {
                if (normName.includes(token) || aliases.some(a => a.includes(token))) {
                    tokensMatched++;
                }
            }
            if (tokensMatched > 0) {
                score += (tokensMatched / tokens.length) * 30;
            }

            // 4. Distance bonus (if location provided)
            let distance = null;
            if (userLocation) {
                distance = window.GeoDistance.haversine(userLocation.lat, userLocation.lon, place.lat, place.lon);
                // Bonus for closer places (max 20 points for within 1km, degrading up to 50km)
                if (distance < 50000) {
                    score += Math.max(0, 20 * (1 - (distance / 50000)));
                }
            }

            // Priority bonus
            if (place.priority) {
                score += place.priority * 2;
            }

            return { place, score, distance };
        });

        // Filter out zero scores and sort
        const filtered = results.filter(r => r.score > 0);
        filtered.sort((a, b) => b.score - a.score);

        return filtered;
    }
};

window.OfflineSearch = OfflineSearch;
