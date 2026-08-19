const fs = require('fs');
const path = require('path');

// Target bounding box roughly around Peermade / Kuttikkanam
const bbox = [9.52, 76.90, 9.65, 77.05];
const centerLat = (bbox[0] + bbox[2]) / 2;
const centerLon = (bbox[1] + bbox[3]) / 2;

console.log("Generating mock offline region data...");

// 1. Generate Places
const places = [
    {
        id: "p1",
        name: "Peermade Government Hospital",
        aliases: ["govt hospital", "gh peermade", "taluk hospital"],
        type: "hospital",
        lat: 9.5744,
        lon: 76.9854,
        locality: "Peermade",
        priority: 10
    },
    {
        id: "p2",
        name: "Kuttikkanam Marian College",
        aliases: ["marian college", "kuttikkanam college", "relief camp"],
        type: "relief-camp",
        lat: 9.5804,
        lon: 76.9734,
        locality: "Kuttikkanam",
        priority: 8
    },
    {
        id: "p3",
        name: "Elappara Primary Health Centre",
        aliases: ["phc elappara", "elappara hospital"],
        type: "hospital",
        lat: 9.6350,
        lon: 76.9750,
        locality: "Elappara",
        priority: 9
    },
    {
        id: "p4",
        name: "Vagamon Police Station",
        aliases: ["police station", "vagamon police"],
        type: "police",
        lat: 9.6500,
        lon: 76.9000,
        locality: "Vagamon",
        priority: 5
    }
];

// Add some random places
for (let i = 0; i < 20; i++) {
    places.push({
        id: `p_rand_${i}`,
        name: `Local Shop ${i}`,
        aliases: [`shop ${i}`, "store"],
        type: "food",
        lat: centerLat + (Math.random() - 0.5) * 0.1,
        lon: centerLon + (Math.random() - 0.5) * 0.1,
        locality: "Unknown",
        priority: 1
    });
}

// 2. Generate a synthetic grid road network
const nodes = [];
const edges = [];
const GRID_SIZE = 20; // 20x20 grid

// Helper for distance
function haversine(lat1, lon1, lat2, lon2) {
    const R = 6371000;
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = 
        Math.sin(dLat/2) * Math.sin(dLat/2) +
        Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * 
        Math.sin(dLon/2) * Math.sin(dLon/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return R * c;
}

const latStep = (bbox[2] - bbox[0]) / GRID_SIZE;
const lonStep = (bbox[3] - bbox[1]) / GRID_SIZE;

// Create nodes
const nodeIds = [];
for (let i = 0; i < GRID_SIZE; i++) {
    nodeIds[i] = [];
    for (let j = 0; j < GRID_SIZE; j++) {
        const id = `n_${i}_${j}`;
        const lat = bbox[0] + (i * latStep);
        const lon = bbox[1] + (j * lonStep);
        nodes.push({ id, lat, lon });
        nodeIds[i][j] = id;
    }
}

// Create edges (connect grid)
for (let i = 0; i < GRID_SIZE; i++) {
    for (let j = 0; j < GRID_SIZE; j++) {
        const id1 = nodeIds[i][j];
        
        // Connect right
        if (j < GRID_SIZE - 1) {
            const id2 = nodeIds[i][j+1];
            const dist = haversine(bbox[0] + i * latStep, bbox[1] + j * lonStep, bbox[0] + i * latStep, bbox[1] + (j+1) * lonStep);
            edges.push({
                id: `e_${id1}_${id2}`,
                from: id1,
                to: id2,
                distance: dist,
                roadType: "residential",
                oneWay: false,
                hazardPenalty: 0
            });
        }
        
        // Connect down
        if (i < GRID_SIZE - 1) {
            const id2 = nodeIds[i+1][j];
            const dist = haversine(bbox[0] + i * latStep, bbox[1] + j * lonStep, bbox[0] + (i+1) * latStep, bbox[1] + j * lonStep);
            edges.push({
                id: `e_${id1}_${id2}`,
                from: id1,
                to: id2,
                distance: dist,
                roadType: "residential",
                oneWay: false,
                hazardPenalty: 0
            });
        }
        
        // Random diagonal connection to make it interesting
        if (i < GRID_SIZE - 1 && j < GRID_SIZE - 1 && Math.random() > 0.7) {
            const id2 = nodeIds[i+1][j+1];
            const dist = haversine(bbox[0] + i * latStep, bbox[1] + j * lonStep, bbox[0] + (i+1) * latStep, bbox[1] + (j+1) * lonStep);
            edges.push({
                id: `e_${id1}_${id2}`,
                from: id1,
                to: id2,
                distance: dist,
                roadType: "highway", // Make diagonals "highways" to encourage use
                oneWay: false,
                hazardPenalty: 0
            });
        }
    }
}

// 3. Output to JSON
const outputData = {
    bbox,
    places,
    nodes,
    edges
};

const outputDir = path.join(__dirname, '..', '..', 'data');
if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
}

const outputFile = path.join(outputDir, 'mock_region.json');
fs.writeFileSync(outputFile, JSON.stringify(outputData, null, 2));

console.log(`Generated mock region data at ${outputFile}`);
console.log(`- ${places.length} places`);
console.log(`- ${nodes.length} nodes`);
console.log(`- ${edges.length} edges`);
