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
    searchPlaces: async function(query, userLocation = null) {
        if (!query) return [];

        const normQuery = this._normalize(query);
        if (!normQuery) return [];

        if (navigator.onLine) {
            try {
                // Approximate bounding box for Kerala
                const viewbox = "74.5,12.8,77.5,8.0"; 
                const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(query)}&format=json&limit=10&countrycodes=in&viewbox=${viewbox}&bounded=1`;
                const response = await fetch(url);
                
                if (response.ok) {
                    const data = await response.json();
                    if (data.length > 0) {
                        return data.map(item => ({
                            place: {
                                id: `nom_${item.place_id}`,
                                name: item.display_name.split(',')[0],
                                type: item.type || 'place',
                                lat: parseFloat(item.lat),
                                lon: parseFloat(item.lon),
                                locality: item.display_name
                            },
                            score: 100, // Online exact results are generally high quality
                            distance: userLocation ? window.GeoDistance.haversine(userLocation.lat, userLocation.lon, parseFloat(item.lat), parseFloat(item.lon)) : null
                        }));
                    }
                }
            } catch (e) {
                console.warn("Online search failed, falling back to offline", e);
            }
        }

        // Offline Search Fallback (IndexedDB places)
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
