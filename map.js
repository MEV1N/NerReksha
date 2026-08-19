/**
 * Map initialization and logic for NerReksha (Premium UI)
 * using Leaflet.js
 */

document.addEventListener('DOMContentLoaded', () => {
    const mapContainer = document.getElementById('map');
    
    if (mapContainer && typeof L !== 'undefined') {
        const CENTER = [9.585, 76.975];
        const map = L.map('map', { zoomControl:false, attributionControl:false }).setView(CENTER, 13);
        window.nerRekshaMap = map;
        
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom:19 }).addTo(map);
        L.control.attribution({ position:'bottomleft', prefix:false }).addAttribution('© OpenStreetMap').addTo(map);

        if (window.OfflineMap) window.OfflineMap.init(map, CENTER);
        if (window.OverpassCacher) window.OverpassCacher.init(map);
        if (window.Routing) window.Routing.init();

        const HAZARD_TYPES = [
          { id:'flood', code:'FL', color:'#2B6CB0' },
          { id:'landslide', code:'LS', color:'#8B5A2B' },
          { id:'tree', code:'FT', color:'#2F8F5B' },
          { id:'road', code:'RB', color:'#C6862A' },
          { id:'bridge', code:'BD', color:'#C8443A' },
          { id:'other', code:'OT', color:'#6B7570' },
        ];
        
        const RESOURCE_TYPES = [
          { id:'relief', code:'RC' },
          { id:'medical', code:'MC' },
          { id:'food', code:'FD' },
          { id:'water', code:'DW' },
          { id:'power', code:'CS' },
          { id:'toilet', code:'PT' },
          { id:'volunteer', code:'VR' },
          { id:'fuel', code:'FA' },
          { id:'supply', code:'SD' },
          { id:'other', code:'OT' },
        ];

        const SOS_TYPES = [
          { id:'medical', code:'MD' },
          { id:'trapped', code:'TR' },
          { id:'flood', code:'FL' },
          { id:'fire', code:'FI' },
          { id:'other', code:'OT' },
        ];

        const hazardRadii = { 'flood': 150, 'landslide': 300, 'road': 100, 'tree': 75, 'bridge': 200, 'other': 100 };

        function codeIcon(code, bg, size, ring){
          return L.divIcon({
            className: 'nk-marker-wrap',
            html: `<div class="nk-marker ${ring?'nk-sos-marker':''}" style="width:${size}px;height:${size}px;background:${bg};font-size:${size*0.34}px;">${code}</div>`,
            iconSize: [size,size],
            iconAnchor: [size/2, size/2],
          });
        }

        /* ---------- filter chips ---------- */
        const chipRow = document.getElementById('chipRow');
        const activeFilters = new Set(HAZARD_TYPES.map(t=>t.id).concat(['resource','sos']));
        
        const chipDefs = [
          ...HAZARD_TYPES.map(t=>({id:t.id, label:t.code, color:t.color})),
          {id:'sos', label:'SOS', color:'#C8443A'},
          {id:'resource', label:'Resources', color:'#1F6F63'},
        ];
        
        if (chipRow) {
            chipDefs.forEach(c => {
              const el = document.createElement('button');
              el.className='chip';
              el.dataset.on = 'true';
              el.innerHTML = `<span class="dot" style="background:${c.color}"></span>${c.label}`;
              el.addEventListener('click', () => {
                if(activeFilters.has(c.id)){ activeFilters.delete(c.id); el.dataset.on='false'; }
                else { activeFilters.add(c.id); el.dataset.on='true'; }
                renderMarkers();
              });
              chipRow.appendChild(el);
            });
        }

        function escapeHTML(s){ const d=document.createElement('div'); d.textContent=s||''; return d.innerHTML; }
        function popupHTML(title, line1, line2, lat, lng){
          const routeBtn = (lat && lng) ? `<button onclick="window.routeTo(${lat}, ${lng})" style="margin-top:10px; width:100%; padding:6px; border-radius:6px; border:1px solid #CBD5E1; background:#F4F8FB; font-size:12px; cursor:pointer; color:#0F172A; font-weight:600; display:flex; align-items:center; justify-content:center; gap:6px;"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M3 10.5 12 3l9 7.5"/><path d="M5 9.5V20a1 1 0 0 0 1 1h4v-6h4v6h4a1 1 0 0 0 1-1V9.5"/></svg> Route Here</button>` : '';
          return `<div style="font-family:'IBM Plex Sans',sans-serif;min-width:160px;">
            <div style="font-family:'Space Grotesk',sans-serif;font-weight:700;font-size:14.5px;margin-bottom:4px;color:#0F172A;">${escapeHTML(title)}</div>
            <div style="font-size:13px;color:#475569;line-height:1.4;">${escapeHTML(line1)}</div>
            <div style="font-family:'IBM Plex Mono',monospace;font-size:11px;color:#94A3B8;margin-top:6px;">${escapeHTML(line2)}</div>
            ${routeBtn}
          </div>`;
        }

        window.updateSOSStatusMap = async function(id, status) {
            await NerRekshaData.updateSOSStatus(id, status);
            window.dispatchEvent(new Event('nerreksha-data-ready'));
        };
        window.removeResourceMap = async function(id) {
            if (confirm('Are you sure you want to remove this resource?')) {
                await NerRekshaData.deleteSafePlace(id);
                window.dispatchEvent(new Event('nerreksha-data-ready'));
            }
        };

        let markers = [];
        let routingLines = [];
        let activeHazardsForRouting = [];
        let userMarker = null;
        let userLocation = CENTER;
        let currentRouteDest = null;

        window.routeTo = async function(lat, lng) {
            currentRouteDest = [lat, lng];
            routingLines.forEach(l => map.removeLayer(l));
            routingLines = [];
            
            if (!userLocation) return alert("User location not available yet.");

            try {
                const routeData = await window.Routing.calculateRoute(userLocation, [lat, lng], activeHazardsForRouting);
                if (routeData) {
                    const latLngs = routeData.geometry;
                    const routeLine = L.polyline(latLngs, {
                        color: '#4CAF50', weight: 6, opacity: 0.9,
                        dashArray: routeData.source === 'offline' ? '10, 10' : null
                    }).addTo(map);
                    routingLines.push(routeLine);
                    map.fitBounds(routeLine.getBounds(), { padding: [50, 50] });

                    document.getElementById('route-controls').style.display = 'block';
                    document.getElementById('route-dist').textContent = (routeData.distance / 1000).toFixed(1);
                    document.getElementById('route-time').textContent = Math.round(routeData.duration / 60);
                    
                    const badge = document.getElementById('route-safety-badge');
                    badge.textContent = `Safety Score: ${routeData.safetyScore ? routeData.safetyScore.toFixed(0) : 100}/100`;
                    badge.className = 'route-safety-badge ' + (routeData.safetyScore > 80 ? 'safe' : (routeData.safetyScore > 50 ? 'warn' : 'danger'));

                    const warningsEl = document.getElementById('route-warnings');
                    if (routeData.safetyScore < 50 || routeData.maxRisk > 0.6) {
                        warningsEl.innerHTML = '<span style="color:var(--danger-ink); font-weight:bold;">⚠️ Route traverses known hazards and may be unsafe!</span>';
                        alert("Warning: This route traverses known hazards and may be unsafe.");
                    } else if (routeData.hazardsCount > 0 || routeData.maxRisk > 0.5) {
                        warningsEl.innerHTML = `<span style="color:var(--warning-ink);">⚠️ Intersects lower-risk hazard area(s).</span>`;
                    } else {
                        warningsEl.innerHTML = '<span style="color:var(--success-ink);">✓ No reported hazards on route.</span>';
                    }
                }
            } catch (err) {
                alert(err.message || "Routing failed.");
            }
        };

        const btnCancelRoute = document.getElementById('btn-cancel-route');
        if (btnCancelRoute) {
            btnCancelRoute.addEventListener('click', () => {
                routingLines.forEach(l => map.removeLayer(l));
                routingLines = [];
                if (currentRouteDest) window.showRouteFeedbackPrompt(currentRouteDest);
                currentRouteDest = null;
                document.getElementById('route-controls').style.display = 'none';
            });
        }

        // Search Bar Logic
        const searchInput = document.getElementById('map-search-input');
        const searchBtn = document.getElementById('map-search-btn');
        const searchResultsContainer = document.getElementById('search-results-container');
        const searchResultsList = document.getElementById('search-results-list');

        async function performSearch() {
            if (!searchInput.value) { searchResultsContainer.style.display = 'none'; return; }
            const results = await window.OfflineSearch.searchPlaces(searchInput.value, userLocation ? {lat: userLocation[0], lon: userLocation[1]} : null);
            searchResultsList.innerHTML = '';
            
            if (results.length === 0) {
                searchResultsList.innerHTML = '<li class="search-result-item" style="color: var(--ink-faint);">No places found.</li>';
            } else {
                results.slice(0, 5).forEach(res => {
                    const li = document.createElement('li');
                    li.className = 'search-result-item';
                    const distStr = res.distance !== null ? ` • ${(res.distance/1000).toFixed(1)} km` : '';
                    li.innerHTML = `<strong>${res.place.name}</strong><span>${(res.place.type || 'place').toUpperCase()}${distStr}</span>`;
                    li.addEventListener('click', () => {
                        searchResultsContainer.style.display = 'none';
                        map.setView([res.place.lat, res.place.lon], 15);
                        window.routeTo(res.place.lat, res.place.lon);
                        searchInput.value = res.place.name;
                    });
                    searchResultsList.appendChild(li);
                });
            }
            searchResultsContainer.style.display = 'block';
        }

        if (searchBtn && searchInput) {
            searchBtn.addEventListener('click', performSearch);
            searchInput.addEventListener('input', () => {
                if (searchInput.value.length > 2) performSearch();
                else searchResultsContainer.style.display = 'none';
            });
        }
        
        map.on('click', () => { if (searchResultsContainer) searchResultsContainer.style.display = 'none'; });

        async function renderMarkers() {
            markers.forEach(m => map.removeLayer(m));
            markers = [];
            activeHazardsForRouting = [];
            
            let hazardsCount = 0;
            let sosCount = 0;
            let resourceCount = 0;

            if (typeof NerRekshaData !== 'undefined') {
                try {
                    const reports = await NerRekshaData.loadReports();
                    reports.forEach(incident => {
                        const typeId = incident.type === 'road-blocked' ? 'road' : incident.type;
                        const t = HAZARD_TYPES.find(x => x.id === typeId) || HAZARD_TYPES[5];
                        const lat = incident.lat; const lng = incident.lng;
                        
                        // For routing engine
                        if (hazardRadii[typeId]) {
                            activeHazardsForRouting.push({ lat, lng, radius: hazardRadii[typeId], type: incident.type, severity: incident.severity || 1 });
                        }

                        if (!activeFilters.has(typeId)) return;
                        
                        hazardsCount++;
                        const size = 26 + (incident.severity||1)*4;
                        const marker = L.marker([lat, lng], { icon: codeIcon(t.code, t.color, size) })
                            .bindPopup(popupHTML(incident.title, incident.description, `Severity ${incident.severity} · ${incident.timeReported}`));
                        marker.addTo(map);
                        markers.push(marker);
                    });

                    const safePlaces = await NerRekshaData.loadSafePlaces();
                    safePlaces.forEach(place => {
                        if (!activeFilters.has('resource')) return;
                        resourceCount++;
                        const t = RESOURCE_TYPES.find(x => x.id === (place.type||'').replace('-camp','')) || RESOURCE_TYPES[9];
                        const marker = L.marker([place.lat, place.lng], { icon: codeIcon(t.code, '#1F6F63', 26) })
                            .bindPopup(popupHTML(place.title, t.label + (place.capacity? ' · '+place.capacity : ''), place.description||'', place.lat, place.lng));
                        marker.addTo(map);
                        markers.push(marker);
                    });

                    const sosList = await NerRekshaData.loadSOS();
                    sosList.forEach(sos => {
                        if (!activeFilters.has('sos')) return;
                        if (sos.status !== 'Resolved') sosCount++;
                        
                        const t = SOS_TYPES.find(x => x.id === sos.emergencyType?.toLowerCase()) || SOS_TYPES[4];
                        const bg = sos.status === 'Resolved' ? '#2F8F5B' : '#C8443A';
                        const marker = L.marker([sos.lat, sos.lng], { icon: codeIcon(t.code, bg, 30, sos.status!=='Resolved') })
                            .bindPopup(popupHTML('SOS · '+t.label, sos.description, sos.status+' · '+sos.timeReported));
                        marker.addTo(map);
                        markers.push(marker);
                    });

                } catch (error) {
                    console.error("Error loading markers:", error);
                }
            }
            
            // Update stats
            const sh = document.getElementById('statHazards');
            const ss = document.getElementById('statSOS');
            const sr = document.getElementById('statResources');
            if (sh) sh.textContent = hazardsCount;
            if (ss) ss.textContent = sosCount;
            if (sr) sr.textContent = resourceCount;
        }

        window.GPS.init();
        window.GPS.subscribe((pos) => {
            if (!pos) return;
            userLocation = [pos.lat, pos.lon];
            if (userMarker) map.removeLayer(userMarker);
            const pinIcon = L.divIcon({
                className: '',
                html: `<svg viewBox="0 0 24 24" width="32" height="32" stroke="white" stroke-width="2" fill="#0284C7" stroke-linecap="round" stroke-linejoin="round" style="filter: drop-shadow(0px 4px 6px rgba(0,0,0,0.3));"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path><circle cx="12" cy="10" r="3"></circle></svg>`,
                iconSize: [32, 32],
                iconAnchor: [16, 32],
                popupAnchor: [0, -32]
            });
            userMarker = L.marker([pos.lat, pos.lon], {
                icon: pinIcon,
                zIndexOffset: 1000
            }).addTo(map).bindPopup(popupHTML('You are here', '', ''));

            if (!this._hasPannedToUser && pos.lat > 8 && pos.lat < 13 && pos.lon > 74 && pos.lon < 78) {
                map.setView([pos.lat, pos.lon], 14);
                this._hasPannedToUser = true;
            }
        });
        
        const btnLocateMe = document.getElementById('locateBtn');
        if (btnLocateMe) {
            btnLocateMe.addEventListener('click', async () => {
                try {
                    const pos = await window.GPS.getPosition(true);
                    map.setView([pos.lat, pos.lon], 15);
                    window.showToast('Centered on your location');
                } catch (e) {
                    window.showToast('Could not get your location');
                }
            });
        }

        window.addEventListener('nerreksha-data-ready', renderMarkers);
        renderMarkers();
    }
});
