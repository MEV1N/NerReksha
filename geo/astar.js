/**
 * A* Pathfinding Engine
 */

class AStarEngine {
    /**
     * @param {RoadGraph} graph 
     * @param {Object} activeHazards active hazards list to apply penalties
     */
    constructor(graph, hazards = []) {
        this.graph = graph;
        this.hazards = hazards; // Array of {lat, lon, radius, severity, type}
        this.MAX_ACCEPTABLE_EDGE_RISK = 0.25; // Safety-first: matches evaluate.js threshold
        this.RISK_WEIGHT = 10000; // 1.0 risk = 10km of distance penalty
    }

    /**
     * Calculate dynamic penalty for an edge based on ML risk prediction
     */
    getEdgePenalty(edge, fromNode, toNode) {
        let isBlocked = edge.blocked || false;

        // Base graph hard-blocks
        if (edge.hazardPenalty === -1) isBlocked = true;

        // 1. Check Hard Hazards
        for (const h of this.hazards) {
            const dist = window.GeoDistance.distanceToSegment(h.lat, h.lon, fromNode.lat, fromNode.lon, toNode.lat, toNode.lon);
            if (dist <= h.radius) {
                if ((h.type === 'road-blocked' || h.type === 'bridge-damaged' || h.type === 'landslide') && h.severity >= 3) {
                    isBlocked = true;
                    break;
                }
            }
        }

        if (isBlocked) {
            return { penalty: Infinity, isBlocked: true, risk: 1.0 };
        }

        // 2. Extract Features
        const features = window.MLFeatureExtraction.extract(edge, fromNode, toNode, this.hazards);

        // 3. Predict Risk
        const prediction = window.MLRiskPredictor.predict(features);
        let risk = prediction.risk;

        // 4. Threshold check
        if (risk >= this.MAX_ACCEPTABLE_EDGE_RISK) {
            return { penalty: Infinity, isBlocked: true, risk };
        }

        // 5. Convert Risk to Cost
        const riskCost = risk * this.RISK_WEIGHT;

        return { penalty: riskCost, isBlocked: false, risk };
    }

    findRoute(startId, endId) {
        const startNode = this.graph.getNode(startId);
        const endNode = this.graph.getNode(endId);
        if (!startNode || !endNode) return null;

        // Min-priority queue (naive array implementation for simplicity, could be optimized)
        const openSet = new Set([startId]);
        const closedSet = new Set();
        
        const gScore = new Map();
        gScore.set(startId, 0);
        
        const fScore = new Map();
        fScore.set(startId, window.GeoDistance.haversine(startNode.lat, startNode.lon, endNode.lat, endNode.lon));
        
        const cameFrom = new Map();

        let hazardsEncountered = 0;

        while (openSet.size > 0) {
            // Get node with lowest fScore
            let currentId = null;
            let lowestF = Infinity;
            for (const id of openSet) {
                const f = fScore.get(id) || Infinity;
                if (f < lowestF) {
                    lowestF = f;
                    currentId = id;
                }
            }

            if (currentId === endId) {
                // Reconstruct path
                const path = [currentId];
                let curr = currentId;
                let totalDistance = 0;
                let totalSafetyPenalty = 0;

                while (cameFrom.has(curr)) {
                    const edgeData = cameFrom.get(curr);
                    totalDistance += edgeData.distance;
                    totalSafetyPenalty += edgeData.penalty;
                    curr = edgeData.fromId;
                    path.unshift(curr);
                }
                // Calculate safety stats
                let avgRisk = 0;
                let maxRisk = 0;
                let hazardsCount = 0;
                
                if (path.length > 1) {
                    let totalRisk = 0;
                    let currNode = path[0];
                    for (let i = 1; i < path.length; i++) {
                        const nextNode = path[i];
                        const edgeData = cameFrom.get(nextNode);
                        if (edgeData) {
                            totalRisk += edgeData.risk;
                            if (edgeData.risk > maxRisk) maxRisk = edgeData.risk;
                            if (edgeData.risk > 0.1) hazardsCount++;
                        }
                    }
                    avgRisk = totalRisk / (path.length - 1);
                }
                
                let safetyScore = Math.max(0, 100 - (avgRisk * 100));

                return {
                    path,
                    totalDistance,
                    safetyScore,
                    avgRisk,
                    maxRisk,
                    hazardsCount,
                    geometry: path.map(id => {
                        const n = this.graph.getNode(id);
                        return [n.lat, n.lon]; // Leaflet uses [lat, lng]
                    })
                };
            }

            openSet.delete(currentId);
            closedSet.add(currentId);

            const currentNode = this.graph.getNode(currentId);
            const neighbors = this.graph.getNeighbors(currentId);

            for (const edge of neighbors) {
                if (closedSet.has(edge.to)) continue;

                const toNode = this.graph.getNode(edge.to);
                const { penalty, isBlocked, risk } = this.getEdgePenalty(edge, currentNode, toNode);
                
                if (isBlocked) continue; // Skip blocked edges completely

                // Cost = riskCost + smallDistancePenalty
                // smallDistancePenalty = just the physical distance
                const baseCost = edge.distance;
                const tentativeG = gScore.get(currentId) + baseCost + penalty;

                if (!openSet.has(edge.to)) {
                    openSet.add(edge.to);
                } else if (tentativeG >= (gScore.get(edge.to) || Infinity)) {
                    continue; // Not a better path
                }

                cameFrom.set(edge.to, { fromId: currentId, distance: edge.distance, penalty, risk });
                gScore.set(edge.to, tentativeG);
                fScore.set(edge.to, tentativeG + window.GeoDistance.haversine(toNode.lat, toNode.lon, endNode.lat, endNode.lon));
            }
        }

        return null; // No route found
    }
}

window.AStarEngine = AStarEngine;
