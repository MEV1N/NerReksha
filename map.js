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
        
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            maxZoom: 19,
            attribution: '© OpenStreetMap'
        }).addTo(map);

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

        function isRouteSafe(coordinates) {
            for (let i = 0; i < coordinates.length; i++) {
                const point = L.latLng(coordinates[i][1], coordinates[i][0]); // OSRM is [lng, lat]
                for (let j = 0; j < activeHazards.length; j++) {
                    const hazardCenter = L.latLng(activeHazards[j].lat, activeHazards[j].lng);
                    if (point.distanceTo(hazardCenter) <= activeHazards[j].radius) {
                        return { safe: false, hazard: activeHazards[j] };
                    }
                }
            }
            return { safe: true };
        }

        window.routeTo = async function(lat, lng) {
            // Remove old routes
            routingLines.forEach(l => map.removeLayer(l));
            routingLines = [];
            
            if (!userLocation) return alert("User location not available yet.");

            if (!navigator.onLine) {
                alert("You are offline. Showing direct path. Proceed with caution.");
                const routeLine = L.polyline([userLocation, [lat, lng]], {color: '#1976D2', weight: 6, opacity: 0.8, dashArray: '10, 10'}).addTo(map);
                routingLines.push(routeLine);
                map.fitBounds(routeLine.getBounds());
                return;
            }

            try {
                // Fetch primary and up to 3 alternative routes
                const url = `https://router.project-osrm.org/route/v1/driving/${userLocation[1]},${userLocation[0]};${lng},${lat}?overview=full&geometries=geojson&alternatives=3`;
                const response = await fetch(url);
                const data = await response.json();

                if (!data.routes || data.routes.length === 0) {
                    alert("Routing server returned no routes.");
                    return;
                }

                let safeRoute = null;
                let isAlternative = false;
                let hitHazard = null;

                // 1. Evaluate default routes
                for (let i = 0; i < data.routes.length; i++) {
                    const route = data.routes[i];
                    const safetyCheck = isRouteSafe(route.geometry.coordinates);
                    if (safetyCheck.safe) {
                        safeRoute = route;
                        isAlternative = (i > 0);
                        break;
                    } else if (!hitHazard) {
                        hitHazard = safetyCheck.hazard; // track the first hazard we hit for a detour attempt
                    }
                }

                // 2. Detour Attempt if all defaults fail
                if (!safeRoute && hitHazard) {
                    // Heuristic detour: attempt to route via a point outside the hazard radius
                    // We offset the longitude by approx (radius * 1.5) in degrees
                    const offsetDeg = (hitHazard.radius * 1.5) / 111320; 
                    const detourLng = hitHazard.lng + offsetDeg;
                    
                    const detourUrl = `https://router.project-osrm.org/route/v1/driving/${userLocation[1]},${userLocation[0]};${detourLng},${hitHazard.lat};${lng},${lat}?overview=full&geometries=geojson`;
                    const detourRes = await fetch(detourUrl);
                    const detourData = await detourRes.json();
                    
                    if (detourData.routes && detourData.routes.length > 0) {
                        const safetyCheck = isRouteSafe(detourData.routes[0].geometry.coordinates);
                        if (safetyCheck.safe) {
                            safeRoute = detourData.routes[0];
                            isAlternative = true;
                        }
                    }
                }

                // 3. Render or Fail
                if (safeRoute) {
                    // Convert [lng, lat] to [lat, lng] for Leaflet polyline
                    const latLngs = safeRoute.geometry.coordinates.map(coord => [coord[1], coord[0]]);
                    const routeLine = L.polyline(latLngs, {color: '#1976D2', weight: 6, opacity: 0.9}).addTo(map);
                    routingLines.push(routeLine);
                    map.fitBounds(routeLine.getBounds());

                    if (isAlternative) {
                        alert("Safer alternative route selected to avoid reported hazards.");
                    }
                } else {
                    alert("No safe route currently available.");
                }

            } catch (err) {
                console.error("Routing error:", err);
                alert("Routing failed. Please check your connection.");
            }
        };

        // Search Bar Logic
        const searchInput = document.getElementById('map-search-input');
        const searchBtn = document.getElementById('map-search-btn');

        if (searchBtn && searchInput) {
            searchBtn.addEventListener('click', async () => {
                const query = searchInput.value;
                if (!query) return;

                if (navigator.onLine) {
                    try {
                        const response = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}`);
                        const data = await response.json();
                        if (data && data.length > 0) {
                            const lat = parseFloat(data[0].lat);
                            const lon = parseFloat(data[0].lon);
                            
                            map.setView([lat, lon], 14);
                            window.routeTo(lat, lon);
                        } else {
                            alert("Location not found.");
                        }
                    } catch (e) {
                        console.error("Search failed", e);
                        alert("Search failed. Check connection.");
                    }
                } else {
                    alert("Cannot search external locations while offline.");
                }
            });
        }

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

        // Get User Location
        if ('geolocation' in navigator) {
            map.locate({setView: false, maxZoom: 13, enableHighAccuracy: navigator.onLine});

            map.on('locationfound', function(e) {
                userLocation = [e.latlng.lat, e.latlng.lng];
                
                if (userMarker) {
                    map.removeLayer(userMarker);
                }
                
                userMarker = L.marker(e.latlng, {
                    icon: createCustomIcon('user'),
                    zIndexOffset: 1000
                }).addTo(map)
                .bindPopup('<div class="popup-content"><h3>You are here</h3></div>').openPopup();

                renderMarkers('all');
                
                // Only pan to user if they are roughly in Kerala bounds
                if (e.latlng.lat > 8 && e.latlng.lat < 13 && e.latlng.lng > 74 && e.latlng.lng < 78) {
                    map.setView(e.latlng, 13);
                }
            });

            map.on('locationerror', function(e) {
                console.log("Location access denied or unavailable.");
                renderMarkers('all');
            });
        } else {
            renderMarkers('all');
        }

        window.addEventListener('nerreksha-data-ready', () => {
            const activeChip = document.querySelector('.filter-chip.active');
            const activeFilter = activeChip ? activeChip.getAttribute('data-filter') : 'all';
            renderMarkers(activeFilter);
        });
        
        renderMarkers('all');
    }
});
