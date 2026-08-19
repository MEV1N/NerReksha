/**
 * Routing Controller
 * Orchestrates offline A* routing and online fallback
 */

const Routing = {
    graph: null,
    isGraphLoaded: false,

    init: async function() {
        if (typeof RoadGraph !== 'undefined' && typeof NerRekshaData !== 'undefined') {
            this.graph = new RoadGraph();
            const nodes = await NerRekshaData.loadRoadNodes();
            const edges = await NerRekshaData.loadRoadEdges();
            
            if (nodes.length > 0 && edges.length > 0) {
                this.graph.loadNodes(nodes);
                this.graph.loadEdges(edges);
                this.isGraphLoaded = true;
                console.log(`Loaded offline road graph: ${nodes.length} nodes, ${edges.length} edges.`);
            } else {
                console.warn("No offline road graph data available.");
            }
        }
    },

    /**
     * Calculate lowest-risk viable route from origin to destination
     * @param {Array} origin [lat, lon]
     * @param {Array} destination [lat, lon]
     * @param {Array} activeHazards Array of current hazards
     */
    calculateRoute: async function(origin, destination, activeHazards = []) {
        if (navigator.onLine && window.OverpassCacher) {
            try {
                // Ensure the routing engine has graph data for this area before running the algorithm
                await window.OverpassCacher.ensureCoverage(origin, destination);
            } catch (e) {
                console.warn("Failed to fetch fresh network data. Proceeding with cached graph if available.", e);
            }
        }
        
        if (this.isGraphLoaded) {
            // We have a graph! ALWAYS use the safe algorithm. If it fails (no safe path exists), bubble up the error.
            return await this._calculateOfflineRoute(origin, destination, activeHazards);
        } else {
            if (navigator.onLine) {
                return await this._calculateOnlineRoute(origin, destination, activeHazards);
            } else {
                throw new Error("You are offline and no road network is cached for this area.");
            }
        }
    },

    _calculateOfflineRoute: async function(origin, destination, activeHazards) {
        if (!this.graph) return null;

        const startNodeId = this.graph.findClosestNode(origin[0], origin[1]);
        const endNodeId = this.graph.findClosestNode(destination[0], destination[1]);

        if (!startNodeId || !endNodeId) {
            throw new Error("Could not find nearby road network nodes.");
        }

        const engine = new AStarEngine(this.graph, activeHazards);
        const routeData = engine.findRoute(startNodeId, endNodeId);

        if (!routeData) {
            throw new Error("No sufficiently safe route is currently available.\nConditions may change. Check again when new reports are available.");
        }

        // Calculate a rough estimated time (assuming avg speed 30km/h -> 8.33 m/s)
        const estimatedSeconds = routeData.totalDistance / 8.33;

        return {
            source: 'offline',
            geometry: routeData.geometry, // array of [lat, lon]
            distance: routeData.totalDistance,
            duration: estimatedSeconds,
            safetyScore: routeData.safetyScore,
            avgRisk: routeData.avgRisk,
            maxRisk: routeData.maxRisk,
            hazardsCount: routeData.hazardsCount
        };
    },

    _calculateOnlineRoute: async function(origin, destination, activeHazards) {
        if (!navigator.onLine) {
            throw new Error("Offline region not downloaded and no internet connection.");
        }

        // Basic online fallback to OSRM
        // Note: OSRM uses lon,lat!
        const url = `https://router.project-osrm.org/route/v1/driving/${origin[1]},${origin[0]};${destination[1]},${destination[0]}?overview=full&geometries=geojson`;
        
        try {
            const response = await fetch(url);
            const data = await response.json();
            
            if (!data.routes || data.routes.length === 0) {
                throw new Error("Online routing failed to find a path.");
            }

            const route = data.routes[0];
            const coordinates = route.geometry.coordinates.map(c => [c[1], c[0]]); // Convert back to [lat, lon]

            // Calculate approximate safety score based on hazards along the returned route
            let totalPenalty = 0;
            for (let i = 0; i < coordinates.length - 1; i++) {
                for (const h of activeHazards) {
                    const dist = window.GeoDistance.distanceToSegment(h.lat, h.lon, coordinates[i][0], coordinates[i][1], coordinates[i+1][0], coordinates[i+1][1]);
                    if (dist < h.radius) {
                        totalPenalty += h.severity * 50;
                    }
                }
            }
            
            let safetyScore = 100;
            if (totalPenalty > 0) {
                safetyScore = Math.max(0, 100 - (totalPenalty / 10));
            }

            if (safetyScore < 50) {
                console.warn("Online route intersects significant hazards, but we cannot recalculate without an offline graph.");
            }

            return {
                source: 'online',
                geometry: coordinates,
                distance: route.distance,
                duration: route.duration,
                safetyScore: safetyScore
            };
        } catch (e) {
            console.error(e);
            throw new Error("Online routing request failed.");
        }
    }
};

window.Routing = Routing;
