/**
 * UI logic for managing offline regions
 */

const OfflineRegionManager = {
    init: function() {
        const btnManage = document.getElementById('btn-manage-region');
        const viewRegion = document.getElementById('view-region-manager');
        const btnClose = document.getElementById('btn-close-region');
        
        if (btnManage && viewRegion && btnClose) {
            btnManage.addEventListener('click', () => {
                this.refreshStatus();
                viewRegion.style.display = 'block';
            });
            
            btnClose.addEventListener('click', () => {
                viewRegion.style.display = 'none';
            });
        }
        
        const btnDownloadMock = document.getElementById('btn-download-mock-region');
        if (btnDownloadMock) {
            btnDownloadMock.addEventListener('click', async () => {
                btnDownloadMock.innerHTML = 'Downloading...';
                btnDownloadMock.disabled = true;
                
                try {
                    // Try fetching from the tools output if we ran the generator
                    const response = await fetch('./data/mock_region.json');
                    if (!response.ok) throw new Error("Mock region data not found");
                    
                    const data = await response.json();
                    
                    // --- Validate Map Data Before Clearing Existing ---
                    
                    // Validate nodes
                    const nodeSet = new Set();
                    for (let i = 0; i < data.nodes.length; i++) {
                        const node = data.nodes[i];
                        if (!node.id) throw new Error(`Invalid road graph: node at index ${i} is missing an ID`);
                        if (nodeSet.has(node.id)) throw new Error(`Invalid road graph: duplicate node ID "${node.id}"`);
                        nodeSet.add(node.id);
                    }
                    
                    // Validate edges
                    const edgeSet = new Set();
                    for (let i = 0; i < data.edges.length; i++) {
                        const edge = data.edges[i];
                        if (!edge.id) throw new Error(`Invalid road graph: edge at index ${i} is missing an ID`);
                        if (edgeSet.has(edge.id)) throw new Error(`Invalid road graph: duplicate edge ID "${edge.id}"`);
                        if (!nodeSet.has(edge.from)) throw new Error(`Invalid road graph: edge ${edge.id} references missing node ${edge.from}`);
                        if (!nodeSet.has(edge.to)) throw new Error(`Invalid road graph: edge ${edge.id} references missing node ${edge.to}`);
                        edgeSet.add(edge.id);
                    }

                    // Validate places
                    const placeSet = new Set();
                    for (let i = 0; i < data.places.length; i++) {
                        const place = data.places[i];
                        if (!place.id) throw new Error(`Invalid region data: place at index ${i} is missing an ID`);
                        if (placeSet.has(place.id)) throw new Error(`Invalid region data: duplicate place ID "${place.id}"`);
                        placeSet.add(place.id);
                    }
                    
                    // Save to IndexedDB
                    await NerRekshaData.clearStore(STORES.PLACES);
                    await NerRekshaData.saveMany(STORES.PLACES, data.places);
                    
                    await NerRekshaData.clearStore(STORES.ROAD_NODES);
                    await NerRekshaData.saveMany(STORES.ROAD_NODES, data.nodes);
                    
                    await NerRekshaData.clearStore(STORES.ROAD_EDGES);
                    await NerRekshaData.saveMany(STORES.ROAD_EDGES, data.edges);
                    
                    await NerRekshaData.save(STORES.MAP_METADATA, {
                        id: 'current_region',
                        name: 'Mock Region (Peermade)',
                        bbox: data.bbox,
                        timestamp: Date.now()
                    });
                    
                    alert("Offline region downloaded successfully!");
                    window.dispatchEvent(new Event('nerreksha-data-ready'));
                    
                    // Also trigger the routing init so the new graph is loaded
                    if (typeof Routing !== 'undefined') await Routing.init();
                    if (typeof OfflineSearch !== 'undefined') await OfflineSearch.init();
                    
                } catch (e) {
                    console.error("Failed to download mock region:\n", e);
                    alert("Failed to download mock region. Check the console for details.\nError: " + e.message);
                } finally {
                    btnDownloadMock.innerHTML = 'Download Mock Region Data';
                    btnDownloadMock.disabled = false;
                    this.refreshStatus();
                }
            });
        }
    },

    refreshStatus: async function() {
        if (typeof NerRekshaData === 'undefined') return;
        
        const metadata = await NerRekshaData.loadMapMetadata();
        const region = metadata.find(m => m.id === 'current_region');
        
        const statusEl = document.getElementById('region-status');
        if (statusEl) {
            if (region) {
                statusEl.innerHTML = `
                    <div style="background: var(--light-gray); padding: 16px; border-radius: 8px; margin-bottom: 16px;">
                        <h3 style="margin-top:0;">${region.name}</h3>
                        <p>Map data ✓ Available</p>
                        <p>Places ✓ Available</p>
                        <p>Road network ✓ Available</p>
                        <p style="font-size: 12px; color: var(--gray-color); margin-bottom: 0;">Updated: ${new Date(region.timestamp).toLocaleString()}</p>
                    </div>
                `;
            } else {
                statusEl.innerHTML = `
                    <div style="background: #FFF3E0; padding: 16px; border-radius: 8px; margin-bottom: 16px;">
                        <h3 style="margin-top:0; color: #E65100;">No Region Downloaded</h3>
                        <p>Download a region to enable offline map, search, and routing.</p>
                    </div>
                `;
            }
        }
    }
};

document.addEventListener('DOMContentLoaded', () => {
    OfflineRegionManager.init();
});
