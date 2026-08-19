/**
 * Dynamic caching of the OSM road network for offline routing.
 */
const OverpassCacher = {
    isFetching: false,
    lastBbox: null,

    init: function(mapInstance) {
        let debounceTimer;
        mapInstance.on('moveend', () => {
            if (!navigator.onLine) return; // Only cache when online
            
            clearTimeout(debounceTimer);
            debounceTimer = setTimeout(() => {
                this.cacheCurrentView(mapInstance);
            }, 2000); // 2 second debounce
        });
    },

    cacheCurrentView: async function(mapInstance) {
        if (this.isFetching) return;
        
        // Don't fetch if the view is too zoomed out (to prevent massive queries)
        const zoom = mapInstance.getZoom();
        if (zoom < 14) return;

        const bounds = mapInstance.getBounds();
        const s = bounds.getSouth();
        const n = bounds.getNorth();
        const w = bounds.getWest();
        const e = bounds.getEast();
        
        const bboxStr = `${s},${w},${n},${e}`;
        if (this.lastBbox === bboxStr) return;
        this.lastBbox = bboxStr;

        this.isFetching = true;
        console.log(`Fetching road network for offline caching... bbox: ${bboxStr}`);

        try {
            const query = `
                [out:json][timeout:25];
                (
                  way["highway"](${bboxStr});
                );
                (._;>;);
                out body;
            `;
            
            const url = `https://overpass-api.de/api/interpreter?data=${encodeURIComponent(query)}`;
            const response = await fetch(url);
            if (!response.ok) throw new Error("Overpass API error");
            
            const data = await response.json();
            
            const nodes = [];
            const nodeMap = new Map();
            const edges = [];
            
            // First pass: collect nodes
            for (const el of data.elements) {
                if (el.type === 'node') {
                    nodes.push({ id: 'n_' + el.id, lat: el.lat, lon: el.lon });
                    nodeMap.set(el.id, el);
                }
            }
            
            // Second pass: create edges from ways
            for (const el of data.elements) {
                if (el.type === 'way' && el.nodes && el.nodes.length > 1) {
                    const highwayTag = el.tags?.highway || 'residential';
                    const oneway = el.tags?.oneway === 'yes';
                    
                    for (let i = 0; i < el.nodes.length - 1; i++) {
                        const n1Id = el.nodes[i];
                        const n2Id = el.nodes[i+1];
                        
                        const n1 = nodeMap.get(n1Id);
                        const n2 = nodeMap.get(n2Id);
                        
                        if (n1 && n2) {
                            const dist = window.GeoDistance.haversine(n1.lat, n1.lon, n2.lat, n2.lon);
                            
                            edges.push({
                                id: `e_${el.id}_${i}_fwd`,
                                from: 'n_' + n1Id,
                                to: 'n_' + n2Id,
                                distance: dist,
                                roadType: highwayTag,
                                oneWay: oneway,
                                hazardPenalty: 0
                            });
                            
                            if (!oneway) {
                                edges.push({
                                    id: `e_${el.id}_${i}_rev`,
                                    from: 'n_' + n2Id,
                                    to: 'n_' + n1Id,
                                    distance: dist,
                                    roadType: highwayTag,
                                    oneWay: false,
                                    hazardPenalty: 0
                                });
                            }
                        }
                    }
                }
            }
            
            const uniqueNodes = Array.from(new Map(nodes.map(n => [n.id, n])).values());
            const uniqueEdges = Array.from(new Map(edges.map(e => [e.id, e])).values());

            if (uniqueNodes.length > 0) {
                await window.NerRekshaData.saveMany(STORES.ROAD_NODES, uniqueNodes).catch(e => console.warn("Caching nodes warning:", e));
                await window.NerRekshaData.saveMany(STORES.ROAD_EDGES, uniqueEdges).catch(e => console.warn("Caching edges warning:", e));
                console.log(`Cached ${uniqueNodes.length} nodes and ${uniqueEdges.length} edges for offline use.`);
                
                if (window.Routing) {
                    window.Routing.init(); // Reloads graph from DB
                }
            }
        } catch (err) {
            console.error("Failed to cache road network:", err);
        } finally {
            this.isFetching = false;
        }
    }
};
window.OverpassCacher = OverpassCacher;
