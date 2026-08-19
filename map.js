/**
 * Map initialization and logic for NerReksha
 * using Leaflet.js
 */

document.addEventListener('DOMContentLoaded', () => {
    const mapContainer = document.getElementById('map-container');
    
    if (mapContainer && typeof L !== 'undefined') {
        // Default location (Idukki / Kuttikkanam fallback)
        let defaultLocation = [9.5804, 76.9734];
        const map = L.map('map-container').setView(defaultLocation, 11);
        window.nerRekshaMap = map;
        
        // Use Offline Map strategy
        window.OfflineMap.init(map, defaultLocation);

        // Marker Icons Configuration
        const iconConfig = {
            'flood': { color: '#2196F3', icon: '🌊' },
            'landslide': { color: '#795548', icon: '⛰️' },
            'tree-fallen': { color: '#4CAF50', icon: '🌳' },
            'road-blocked': { color: '#F44336', icon: '🚧' },
            'bridge-damaged': { color: '#FF5722', icon: '🌉' },
            'other': { color: '#9E9E9E', icon: '❓' },
            'hospital': { color: '#E91E63', icon: '🏥' },
            'relief-camp': { color: '#FF9800', icon: '⛺' },
            'food-centre': { color: '#8BC34A', icon: '🍲' },
            'charging-station': { color: '#9C27B0', icon: '🔋' },
            'sos': { color: '#B71C1C', icon: '🚨' },
            'user': { color: '#1976D2', icon: '📍' }
        };

        const hazardRadii = {
            'flood': 150,
            'landslide': 300,
            'road-blocked': 100,
            'tree-fallen': 75,
            'bridge-damaged': 200,
            'other': 100
        };

        function createCustomIcon(type, options = {}) {
            const config = iconConfig[type] || { color: '#757575', icon: '📍' };
            const isUserCreated = options.isUserCreated || false;
            const isResolved = options.isResolved || false;
            
            // Safe spaces are blue or yellow
            let color = config.color;
            if (['hospital', 'relief-camp', 'food-centre', 'charging-station', 'toilet', 'volunteer', 'fuel', 'supply', 'drinking-water', 'food', 'other'].includes(type)) {
                color = '#FFD54F'; // Yellow-ish
            }
            
            // User created data is distinctly RED
            if (isUserCreated) {
                color = '#D32F2F'; // Red
            }

            if (isResolved) {
                color = '#9E9E9E'; // Grey
            }

            // Glow effect for user data to make it stand out
            let boxShadow = (isUserCreated && !isResolved) ? '0 0 10px 2px rgba(211,47,47,0.8)' : '0 2px 5px rgba(0,0,0,0.3)';
            let iconText = isResolved ? '✅' : config.icon;

            return L.divIcon({
                className: 'custom-marker',
                html: `<div style="background-color: ${color}; width: 32px; height: 32px; display: flex; align-items: center; justify-content: center; border-radius: 50%; border: 2px solid white; box-shadow: ${boxShadow}; font-size: 16px;">${iconText}</div>`,
                iconSize: [36, 36],
                iconAnchor: [18, 18],
                popupAnchor: [0, -18]
            });
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
        let activeHazards = [];
        let userMarker = null;
        let userLocation = defaultLocation;

        // Current Route State
        let currentRouteDest = null;

        window.routeTo = async function(lat, lng) {
            currentRouteDest = [lat, lng];
            
            // Remove old routes
            routingLines.forEach(l => map.removeLayer(l));
            routingLines = [];
            
            if (!userLocation) {
                alert("User location not available yet.");
                return;
            }

            try {
                const routeData = await window.Routing.calculateRoute(userLocation, [lat, lng], activeHazards);
                
                if (routeData) {
                    const latLngs = routeData.geometry;
                    const routeLine = L.polyline(latLngs, {
                        color: '#4CAF50', // Always green for safety
                        weight: 6, 
                        opacity: 0.9,
                        dashArray: routeData.source === 'offline' ? '10, 10' : null
                    }).addTo(map);
                    routingLines.push(routeLine);
                    map.fitBounds(routeLine.getBounds(), { padding: [50, 50] });

                    // Update UI
                    document.getElementById('route-controls').style.display = 'block';
                    document.getElementById('route-dist').textContent = (routeData.distance / 1000).toFixed(1) + ' km';
                    document.getElementById('route-time').textContent = Math.round(routeData.duration / 60) + ' min';
                    
                    const safetyEl = document.getElementById('route-safety');
                    safetyEl.textContent = `Safety Score: ${routeData.safetyScore ? routeData.safetyScore.toFixed(0) : 100}/100`;
                    safetyEl.style.color = routeData.safetyScore > 80 ? 'var(--success-color)' : (routeData.safetyScore > 50 ? 'var(--warning-color)' : 'var(--danger-color)');

                    const warningsEl = document.getElementById('route-warnings');
                    warningsEl.innerHTML = `
                        <div style="color: #666; margin-bottom: 4px;">Lowest-risk route based on available data. Actual conditions may differ.</div>
                        ${routeData.maxRisk > 0.5 ? '<div style="color: var(--warning-color);">⚠ Route contains potentially risky segments.</div>' : ''}
                    `;
                }
            } catch (err) {
                console.error("Routing error:", err);
                alert(err.message || "Routing failed.");
            }
        };

        // Route Controls UI
        const btnCancelRoute = document.getElementById('btn-cancel-route');
        if (btnCancelRoute) {
            btnCancelRoute.addEventListener('click', () => {
                routingLines.forEach(l => map.removeLayer(l));
                routingLines = [];
                
                // Prompt for feedback
                if (currentRouteDest) {
                    window.showRouteFeedbackPrompt(currentRouteDest);
                }
                
                currentRouteDest = null;
                document.getElementById('route-controls').style.display = 'none';
            });
        }

        // Search Bar Logic (Offline First)
        const searchInput = document.getElementById('map-search-input');
        const searchBtn = document.getElementById('map-search-btn');
        const searchResultsContainer = document.getElementById('search-results-container');
        const searchResultsList = document.getElementById('search-results-list');

        function performSearch() {
            const query = searchInput.value;
            if (!query) {
                searchResultsContainer.style.display = 'none';
                return;
            }

            const results = window.OfflineSearch.searchPlaces(query, userLocation ? {lat: userLocation[0], lon: userLocation[1]} : null);
            
            searchResultsList.innerHTML = '';
            if (results.length === 0) {
                searchResultsList.innerHTML = '<li style="padding: 12px; color: var(--gray-color);">No offline places found.</li>';
            } else {
                // Show top 5
                results.slice(0, 5).forEach(res => {
                    const li = document.createElement('li');
                    li.style.padding = '12px';
                    li.style.borderBottom = '1px solid #eee';
                    li.style.cursor = 'pointer';
                    
                    const distStr = res.distance !== null ? ` • ${(res.distance/1000).toFixed(1)} km` : '';
                    
                    li.innerHTML = `
                        <strong>${res.place.name}</strong>
                        <div style="font-size: 12px; color: var(--gray-color);">${(res.place.type || 'place').toUpperCase()}${distStr}</div>
                    `;
                    
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
                if (searchInput.value.length > 2) {
                    performSearch();
                } else {
                    searchResultsContainer.style.display = 'none';
                }
            });
        }
        
        // Hide search results on map click
        map.on('click', () => {
            if (searchResultsContainer) searchResultsContainer.style.display = 'none';
        });

        async function renderMarkers(filterCategory = 'all') {
            markers.forEach(m => map.removeLayer(m));
            markers = [];
            activeHazards = [];

            if (typeof NerRekshaData !== 'undefined') {
                try {
                    const reports = await NerRekshaData.loadReports();
                    reports.forEach(incident => {
                        // Allow 'all', 'hazard', or the specific incident category
                        if (filterCategory !== 'all' && filterCategory !== 'hazard' && incident.category !== filterCategory) return;
                        
                        const lat = incident.lat !== undefined ? incident.lat : (userLocation[0] + (incident.latOffset || 0));
                        const lng = incident.lng !== undefined ? incident.lng : (userLocation[1] + (incident.lngOffset || 0));

                        // 1. Draw Avoidance Circle for hazards
                        if (hazardRadii[incident.type]) {
                            const radius = hazardRadii[incident.type];
                            const circle = L.circle([lat, lng], {
                                color: 'red',
                                fillColor: '#f03',
                                fillOpacity: 0.25,
                                weight: 2,
                                radius: radius
                            }).addTo(map);
                            markers.push(circle);
                            activeHazards.push({ lat, lng, radius });
                        }

                        // 2. Draw Marker
                        const marker = L.marker([lat, lng], {
                            icon: createCustomIcon(incident.type, { isUserCreated: incident.isUserCreated })
                        });

                        const badgeColor = incident.isUserCreated ? '#D32F2F' : (iconConfig[incident.type] ? iconConfig[incident.type].color : '#757575');
                        const severityText = incident.severity ? ` | Severity: ${incident.severity}/5` : '';

                        const popupHtml = `
                            <div class="popup-content">
                                <span class="popup-badge" style="background-color: ${badgeColor}">${incident.type.replace('-', ' ').toUpperCase()}</span>
                                <h3>${incident.title}</h3>
                                <p>${incident.description}</p>
                                <div class="popup-meta">
                                    <strong>Status:</strong> ${incident.status || 'Pending'}${severityText}<br>
                                    <strong>Time:</strong> ${incident.timeReported || 'Just now'}<br>
                                    <strong>Reporter:</strong> ${incident.reporter || 'Anonymous'}<br>
                                    <strong>Confirmations:</strong> ${incident.confirmations || 0}
                                </div>
                            </div>
                        `;

                        marker.bindPopup(popupHtml);
                        marker.addTo(map);
                        markers.push(marker);
                    });

                    // Render Community Resources
                    if (['all', 'relief-camp', 'hospital', 'food', 'drinking-water', 'charging', 'toilet', 'volunteer', 'fuel', 'supply', 'other'].includes(filterCategory)) {
                        const safePlaces = await NerRekshaData.loadSafePlaces();
                        safePlaces.forEach(place => {
                            if (filterCategory !== 'all' && place.type !== filterCategory) return;

                            const lat = place.lat !== undefined ? place.lat : (userLocation[0] + (place.latOffset || 0));
                            const lng = place.lng !== undefined ? place.lng : (userLocation[1] + (place.lngOffset || 0));

                            const marker = L.marker([lat, lng], {
                                icon: createCustomIcon(place.type, { isUserCreated: place.isUserCreated })
                            });

                            const popupHtml = `
                                <div class="popup-content">
                                    <span class="popup-badge" style="background-color: #FFD54F; color:#000;">${(place.type||'RESOURCE').toUpperCase().replace('-', ' ')}</span>
                                    <h3 style="margin-bottom: 4px;">${place.title}</h3>
                                    ${place.capacity ? `<span style="font-size:12px; font-weight:bold;">Capacity: ${place.capacity}</span><br>` : ''}
                                    <p>${place.description}</p>
                                    <div style="display:flex; gap: 4px; margin-bottom: 8px;">
                                        ${place.hasFood ? '<span title="Food" style="font-size:16px;">🍲</span>' : ''}
                                        ${place.hasWater ? '<span title="Water" style="font-size:16px;">💧</span>' : ''}
                                        ${place.hasPower ? '<span title="Power" style="font-size:16px;">🔋</span>' : ''}
                                    </div>
                                    <button class="btn-secondary" onclick="window.routeTo(${lat}, ${lng})" style="margin-top:8px; padding: 8px; width:100%;">Route Here</button>
                                    ${place.isUserCreated ? `<button class="btn-danger" onclick="window.removeResourceMap('${place.id}')" style="margin-top:8px; padding: 8px; width:100%; border:none; border-radius:4px; color:white; background:#F44336; cursor:pointer;">Remove Resource</button>` : ''}
                                </div>
                            `;

                            marker.bindPopup(popupHtml);
                            marker.addTo(map);
                            markers.push(marker);
                        });
                    }

                    // Render SOS
                    if (filterCategory === 'all' || filterCategory === 'sos') {
                        const sosList = await NerRekshaData.loadSOS();
                        sosList.forEach(sos => {
                            const isResolved = sos.status === 'Resolved';
                            const marker = L.marker([sos.lat, sos.lng], {
                                icon: createCustomIcon('sos', { isUserCreated: true, isResolved: isResolved })
                            });

                            const statusColor = isResolved ? '#4CAF50' : '#B71C1C';
                            const statusSelect = `
                                <select onchange="window.updateSOSStatusMap('${sos.id}', this.value)" style="margin-top:4px; padding:4px; width:100%;">
                                    <option value="Waiting" ${sos.status==='Waiting'?'selected':''}>Waiting</option>
                                    <option value="Rescue On The Way" ${sos.status==='Rescue On The Way'?'selected':''}>Rescue On The Way</option>
                                    <option value="Resolved" ${sos.status==='Resolved'?'selected':''}>Resolved</option>
                                </select>
                            `;

                            const popupHtml = `
                                <div class="popup-content">
                                    <span class="popup-badge" style="background-color: ${statusColor}">🚨 SOS EMERGENCY</span>
                                    <h3>${sos.title}</h3>
                                    <p><strong>Type:</strong> ${sos.emergencyType || 'General'}<br>
                                       <strong>People:</strong> ${sos.peopleCount || 1}<br>
                                       <strong>Contact:</strong> ${sos.contact || 'N/A'}</p>
                                    <p>${sos.description}</p>
                                    <div class="popup-meta">
                                        <strong>Status:</strong> ${sos.status}<br>
                                        <strong>Time:</strong> ${sos.timeReported}
                                    </div>
                                    <div style="margin-top:8px;">
                                        <strong>Update Status:</strong>
                                        ${statusSelect}
                                    </div>
                                    <button class="btn-secondary" onclick="window.routeTo(${sos.lat}, ${sos.lng})" style="margin-top:8px; padding: 8px;">Route Here</button>
                                </div>
                            `;

                            marker.bindPopup(popupHtml);
                            marker.addTo(map);
                            markers.push(marker);
                            
                            // Add red pulsing circle for SOS if not resolved
                            if (!isResolved) {
                                const circle = L.circle([sos.lat, sos.lng], {
                                    color: 'red',
                                    fillColor: '#B71C1C',
                                    fillOpacity: 0.5,
                                    weight: 3,
                                    radius: 50
                                }).addTo(map);
                                markers.push(circle);
                            }
                        });
                    }

                } catch (error) {
                    console.error("Error loading markers:", error);
                }
            }
        }

        // Handle filters
        const filterChips = document.querySelectorAll('.filter-chip');
        filterChips.forEach(chip => {
            chip.addEventListener('click', (e) => {
                filterChips.forEach(c => c.classList.remove('active'));
                e.target.classList.add('active');
                renderMarkers(e.target.getAttribute('data-filter'));
            });
        });

        // GPS integration via our new GPS module
        window.GPS.init();
        window.GPS.subscribe((pos) => {
            if (!pos) return;
            userLocation = [pos.lat, pos.lon];
            
            if (userMarker) {
                map.removeLayer(userMarker);
            }
            
            userMarker = L.marker([pos.lat, pos.lon], {
                icon: createCustomIcon('user'),
                zIndexOffset: 1000
            }).addTo(map)
            .bindPopup('<div class="popup-content"><h3>You are here</h3></div>');

            // Optionally pan to user on first fix if not done yet
            if (!this._hasPannedToUser) {
                if (pos.lat > 8 && pos.lat < 13 && pos.lon > 74 && pos.lon < 78) {
                    map.setView([pos.lat, pos.lon], 14);
                }
                this._hasPannedToUser = true;
                renderMarkers('all'); // Re-render to sort/calculate relative things if needed
            }
        });
        
        const btnLocateMe = document.getElementById('btn-locate-me');
        if (btnLocateMe) {
            btnLocateMe.addEventListener('click', async () => {
                try {
                    const pos = await window.GPS.getPosition(true);
                    map.setView([pos.lat, pos.lon], 15);
                } catch (e) {
                    alert("Could not get your location. Please check permissions.");
                }
            });
        }

        window.addEventListener('nerreksha-data-ready', () => {
            const activeChip = document.querySelector('.filter-chip.active');
            const activeFilter = activeChip ? activeChip.getAttribute('data-filter') : 'all';
            renderMarkers(activeFilter);
        });
        
        renderMarkers('all');
    }
});
