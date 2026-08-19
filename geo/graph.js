/**
 * Road Graph representation for offline routing
 */

class RoadGraph {
    constructor() {
        this.nodes = new Map(); // id -> {lat, lon}
        this.edges = new Map(); // from_id -> [{to_id, distance, type, oneWay, hazardPenalty}]
    }

    loadNodes(nodesArray) {
        for (const n of nodesArray) {
            this.nodes.set(n.id, { lat: n.lat, lon: n.lon });
        }
    }

    loadEdges(edgesArray) {
        for (const e of edgesArray) {
            if (!this.edges.has(e.from)) this.edges.set(e.from, []);
            this.edges.get(e.from).push(e);

            // If it's not strictly one way, add the reverse edge too
            if (!e.oneWay) {
                if (!this.edges.has(e.to)) this.edges.set(e.to, []);
                // Copy edge and reverse from/to
                this.edges.get(e.to).push({
                    from: e.to,
                    to: e.from,
                    distance: e.distance,
                    roadType: e.roadType,
                    oneWay: false,
                    hazardPenalty: e.hazardPenalty || 0
                });
            }
        }
    }

    getNeighbors(nodeId) {
        return this.edges.get(nodeId) || [];
    }

    getNode(nodeId) {
        return this.nodes.get(nodeId);
    }
    
    findClosestNode(lat, lon) {
        let closestId = null;
        let minDistance = Infinity;
        // Naive linear search, spatial index would be better here for large graphs
        for (const [id, node] of this.nodes.entries()) {
            const d = window.GeoDistance.haversine(lat, lon, node.lat, node.lon);
            if (d < minDistance) {
                minDistance = d;
                closestId = id;
            }
        }
        return closestId;
    }
}

window.RoadGraph = RoadGraph;
