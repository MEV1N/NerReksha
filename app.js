/**
 * Main application logic for NerReksha
 * Handles UI state and navigation
 */

document.addEventListener('DOMContentLoaded', () => {
    // Navigation elements
    const navItems = document.querySelectorAll('.nav-item');
    const views = document.querySelectorAll('.view');
    
    // Setup Navigation
    navItems.forEach(item => {
        item.addEventListener('click', (e) => {
            const targetId = e.currentTarget.getAttribute('data-target');
            
            navItems.forEach(nav => nav.classList.remove('active'));
            e.currentTarget.classList.add('active');
            
            views.forEach(view => {
                view.classList.remove('active');
                if(view.id === targetId) {
                    view.classList.add('active');
                }
            });

            if (targetId === 'view-map' && window.nerRekshaMap) {
                setTimeout(() => {
                    window.nerRekshaMap.invalidateSize();
                }, 10);
            }
        });
    });

    // Render Community Resources dynamically
    window.addEventListener('nerreksha-data-ready', async () => {
        if (typeof NerRekshaData !== 'undefined') {
            const safePlaces = await NerRekshaData.loadSafePlaces();
            const listContainer = document.querySelector('#view-safe-places .resource-list');
            if (listContainer) {
                listContainer.innerHTML = '';
                if (safePlaces.length === 0) {
                    listContainer.innerHTML = '<p style="text-align:center; color: var(--gray-color); margin-top: 32px;">No resources available. Click + to add one.</p>';
                }
                
                safePlaces.forEach(place => {
                    const li = document.createElement('li');
                    li.className = 'resource-item';
                    
                    const facFood = place.hasFood ? '🍲 ' : '';
                    const facWater = place.hasWater ? '💧 ' : '';
                    const facPower = place.hasPower ? '🔋 ' : '';
                    
                    li.innerHTML = `
                        <div style="display: flex; justify-content: space-between; align-items: flex-start;">
                            <div>
                                <h3 style="margin: 0;">${place.title}</h3>
                                <span style="font-size: 12px; font-weight: bold; color: var(--primary-color);">${(place.type || '').toUpperCase().replace('-', ' ')}</span>
                            </div>
                            <button class="btn-remove-resource" data-id="${place.id}" style="background: none; border: none; font-size: 18px; color: var(--danger-color); cursor: pointer;">🗑️</button>
                        </div>
                        <p style="margin-top: 8px;">${place.description || 'No description provided.'}</p>
                        <p style="font-size: 12px; margin-top: 4px;">
                            ${place.capacity ? `<strong>Capacity:</strong> ${place.capacity}<br>` : ''}
                            ${place.contact ? `<strong>Contact:</strong> ${place.contact}<br>` : ''}
                            <strong>Facilities:</strong> ${facFood || facWater || facPower ? facFood + facWater + facPower : 'None specified'}
                        </p>
                        <button class="btn-secondary" onclick="window.routeTo(${place.lat}, ${place.lng})" style="margin-top: 12px; width: 100%;">Show on Map</button>
                    `;
                    listContainer.appendChild(li);
                });
                
                // Bind remove buttons
                document.querySelectorAll('.btn-remove-resource').forEach(btn => {
                    btn.addEventListener('click', async (e) => {
                        const id = e.currentTarget.getAttribute('data-id');
                        if (confirm("Are you sure you want to remove this resource?")) {
                            await NerRekshaData.deleteSafePlace(id);
                            window.dispatchEvent(new Event('nerreksha-data-ready'));
                        }
                    });
                });
            }
        }
    });

    // Add Resource Modal Logic
    const btnAddResourceFab = document.getElementById('btn-add-resource-fab');
    const viewAddResource = document.getElementById('view-add-resource');
    const btnCloseAddResource = document.getElementById('btn-close-add-resource');
    const addResourceForm = document.getElementById('add-resource-form');
    const btnResGps = document.getElementById('btn-res-gps');
    const resLocationInput = document.getElementById('res-location');

    let currentResLat = null;
    let currentResLng = null;

    if (btnAddResourceFab && viewAddResource && btnCloseAddResource) {
        btnAddResourceFab.addEventListener('click', () => {
            viewAddResource.style.display = 'block';
        });
        
        btnCloseAddResource.addEventListener('click', () => {
            viewAddResource.style.display = 'none';
        });
    }

    if (btnResGps) {
        btnResGps.addEventListener('click', async () => {
            btnResGps.innerHTML = 'Locating...';
            try {
                const pos = await new Promise((resolve, reject) => {
                    navigator.geolocation.getCurrentPosition(resolve, reject, {timeout: 5000});
                });
                currentResLat = pos.coords.latitude;
                currentResLng = pos.coords.longitude;
                resLocationInput.value = `GPS: ${currentResLat.toFixed(4)}, ${currentResLng.toFixed(4)}`;
                btnResGps.innerHTML = '📍 GPS Found';
            } catch(e) {
                btnResGps.innerHTML = 'Failed';
                setTimeout(() => btnResGps.innerHTML = '📍 Use GPS', 2000);
            }
        });
    }

    if (addResourceForm) {
        addResourceForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            
            let lat = currentResLat;
            let lng = currentResLng;
            
            if (lat === null || lng === null) {
                if (window.nerRekshaMap) {
                    const center = window.nerRekshaMap.getCenter();
                    lat = center.lat;
                    lng = center.lng;
                } else {
                    lat = 9.5804;
                    lng = 76.9734;
                }
            }
            
            const newResource = {
                title: document.getElementById('res-name').value.trim(),
                type: document.getElementById('res-type').value,
                description: document.getElementById('res-desc').value.trim(),
                locationText: resLocationInput.value.trim(),
                capacity: document.getElementById('res-capacity').value.trim(),
                contact: document.getElementById('res-contact').value.trim(),
                hasFood: document.getElementById('res-fac-food').checked,
                hasWater: document.getElementById('res-fac-water').checked,
                hasPower: document.getElementById('res-fac-power').checked,
                lat: lat,
                lng: lng,
                isUserCreated: true
            };
            
            await NerRekshaData.saveSafePlace(newResource);
            window.dispatchEvent(new Event('nerreksha-data-ready'));
            
            addResourceForm.reset();
            currentResLat = null;
            currentResLng = null;
            btnResGps.innerHTML = '📍 Use GPS';
            viewAddResource.style.display = 'none';
        });
    }

    // Load Demo Data Logic
    const btnLoadDemo = document.getElementById('btn-load-demo');
    if (btnLoadDemo) {
        btnLoadDemo.addEventListener('click', async () => {
            const existing = await NerRekshaData.loadReports();
            if (existing.length > 0) {
                if (!confirm("Demo data already exists. Replace existing data?")) {
                    return;
                }
                await NerRekshaData.clearAllData();
            }
            
            btnLoadDemo.innerHTML = 'Loading...';
            
            let centerLat = 9.5804;
            let centerLng = 76.9734;
            if (window.nerRekshaMap) {
                const c = window.nerRekshaMap.getCenter();
                centerLat = c.lat;
                centerLng = c.lng;
            }
            
            const r = () => (Math.random() - 0.5) * 0.08; // Roughly a few km radius

            const hazards = [];
            for(let i=0; i<8; i++) {
                hazards.push({
                    type: i%2===0 ? 'flood' : (i%3===0 ? 'landslide' : 'road-blocked'),
                    category: i%2===0 ? 'flood' : (i%3===0 ? 'landslide' : 'road'),
                    title: `Demo Hazard ${i+1}`,
                    description: 'Simulated hazard for testing.',
                    severity: Math.floor(Math.random() * 3) + 3,
                    lat: centerLat + r(),
                    lng: centerLng + r(),
                    timeReported: 'Just now',
                    status: 'Verified',
                    isUserCreated: false
                });
            }
            
            const sosList = [];
            for(let i=0; i<3; i++) {
                sosList.push({
                    type: 'sos',
                    emergencyType: 'Medical',
                    peopleCount: Math.floor(Math.random() * 5) + 1,
                    title: `SOS Request ${i+1}`,
                    description: 'Simulated SOS requiring assistance.',
                    lat: centerLat + r(),
                    lng: centerLng + r(),
                    timeReported: 'Just now',
                    status: 'Waiting',
                    isUserCreated: false
                });
            }
            
            const resources = [];
            const types = ['relief-camp', 'hospital', 'food', 'drinking-water', 'charging', 'toilet', 'volunteer', 'fuel', 'supply', 'other'];
            for(let i=0; i<10; i++) {
                resources.push({
                    type: types[i],
                    title: `Community ${types[i].toUpperCase().replace('-', ' ')}`,
                    description: 'Simulated community resource.',
                    lat: centerLat + r(),
                    lng: centerLng + r(),
                    hasFood: i%2===0,
                    hasWater: i%3===0,
                    hasPower: i%4===0,
                    capacity: 100 + (i*10),
                    isUserCreated: false
                });
            }
            
            await NerRekshaData.saveBulkData(hazards, sosList, resources);
            window.dispatchEvent(new Event('nerreksha-data-ready'));
            
            btnLoadDemo.innerHTML = 'Load Demo';
        });
    }

    // Register Service Worker
    if ('serviceWorker' in navigator) {
        window.addEventListener('load', () => {
            navigator.serviceWorker.register('./service-worker.js').catch(err => console.log('SW failed', err));
        });
    }

    // SOS Form Submission
    const btnSosTrigger = document.getElementById('btn-trigger-sos');
    if (btnSosTrigger) {
        btnSosTrigger.addEventListener('click', async (e) => {
            // Validate form
            const sosForm = document.getElementById('sos-form');
            if(!sosForm.checkValidity()) {
                sosForm.reportValidity();
                return;
            }
            e.preventDefault();
            
            btnSosTrigger.disabled = true;
            btnSosTrigger.innerHTML = 'Sending...';
            
            let lat = null, lng = null;
            if (window.nerRekshaMap) {
                const center = window.nerRekshaMap.getCenter();
                lat = center.lat;
                lng = center.lng;
            }
            if ('geolocation' in navigator) {
                try {
                    const pos = await new Promise((resolve, reject) => {
                        navigator.geolocation.getCurrentPosition(resolve, reject, {timeout: 5000});
                    });
                    lat = pos.coords.latitude;
                    lng = pos.coords.longitude;
                } catch(e) {}
            }
            
            const sosData = {
                type: 'sos',
                title: 'SOS Emergency',
                emergencyType: document.getElementById('sos-type').value,
                peopleCount: document.getElementById('sos-people').value,
                contact: document.getElementById('sos-contact').value,
                description: document.getElementById('sos-desc').value || 'Immediate assistance required.',
                lat: (lat || 9.5804) + ((Math.random() - 0.5) * 0.0005),
                lng: (lng || 76.9734) + ((Math.random() - 0.5) * 0.0005),
                timeReported: new Date().toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}),
                status: 'Waiting',
                reporter: 'You',
                isUserCreated: true
            };
            
            try {
                await NerRekshaData.saveSOS(sosData);
                window.dispatchEvent(new Event('nerreksha-data-ready'));
                
                btnSosTrigger.innerHTML = '✅ SOS SENT';
                btnSosTrigger.style.backgroundColor = 'var(--success-color)';
                
                setTimeout(() => {
                    document.querySelector('.nav-item[data-target="view-map"]').click();
                    btnSosTrigger.disabled = false;
                    btnSosTrigger.innerHTML = 'BROADCAST SOS NOW';
                    btnSosTrigger.style.backgroundColor = '';
                    sosForm.reset();
                }, 2000);
            } catch (err) {
                alert('Failed to send SOS.');
                btnSosTrigger.disabled = false;
                btnSosTrigger.innerHTML = 'BROADCAST SOS NOW';
            }
        });
    }
});
