// report.js
document.addEventListener('DOMContentLoaded', () => {
    const reportForm = document.getElementById('report-form');
    const categoryBtns = document.querySelectorAll('.category-btn');
    const locationStatus = document.getElementById('report-location-status');
    const feedbackEl = document.getElementById('report-feedback');
    
    let selectedCategory = 'flood';
    let currentLat = null;
    let currentLng = null;

    // Handle Category Selection
    categoryBtns.forEach(btn => {
        btn.addEventListener('click', (e) => {
            categoryBtns.forEach(b => b.classList.remove('active'));
            e.currentTarget.classList.add('active');
            selectedCategory = e.currentTarget.getAttribute('data-val');
        });
    });

    const btnUseGps = document.getElementById('btn-use-gps');
    const locationInput = document.getElementById('incident-location');

    if (btnUseGps) {
        btnUseGps.addEventListener('click', () => {
            locationStatus.style.display = 'block';
            locationStatus.innerHTML = `📍 Locating...`;
            locationStatus.style.color = 'var(--gray-color)';
            fetchLocation();
        });
    }

    function fetchLocation() {
        if ('geolocation' in navigator) {
            navigator.geolocation.getCurrentPosition(
                (position) => {
                    currentLat = position.coords.latitude;
                    currentLng = position.coords.longitude;
                    locationStatus.innerHTML = `📍 GPS Acquired`;
                    locationStatus.style.color = 'var(--success-color)';
                    if (locationInput) {
                        locationInput.value = `GPS: ${currentLat.toFixed(4)}, ${currentLng.toFixed(4)}`;
                    }
                },
                (error) => {
                    locationStatus.style.display = 'block';
                    locationStatus.innerHTML = `📍 Location unavailable (Ensure GPS is on)`;
                    locationStatus.style.color = 'var(--danger-color)';
                },
                { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
            );
        } else {
            locationStatus.style.display = 'block';
            locationStatus.innerHTML = `📍 Geolocation not supported`;
        }
    }

    // Map categories to titles for display
    const categoryTitles = {
        'flood': 'Flood Reported',
        'landslide': 'Landslide Reported',
        'tree-fallen': 'Tree Fallen',
        'road-blocked': 'Road Blocked',
        'bridge-damaged': 'Bridge Damaged',
        'other': 'Incident Reported'
    };

    // Handle Submission
    reportForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const description = document.getElementById('incident-desc').value.trim();
        const severity = document.getElementById('incident-severity').value;
        const locationText = locationInput ? locationInput.value.trim() : '';
        
        let lat = currentLat;
        let lng = currentLng;

        // Geocode manually entered text if online
        if (locationText && !locationText.startsWith("GPS:") && navigator.onLine) {
            try {
                locationStatus.style.display = 'block';
                locationStatus.innerHTML = `📍 Searching location...`;
                const response = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(locationText + ', Kerala')}`);
                const data = await response.json();
                if (data && data.length > 0) {
                    lat = parseFloat(data[0].lat);
                    lng = parseFloat(data[0].lon);
                    locationStatus.innerHTML = `📍 Location found`;
                } else {
                    locationStatus.innerHTML = `📍 Location not found, using map center`;
                }
            } catch (e) {
                console.error("Geocoding failed", e);
            }
        }

        if (lat === null || lng === null) {
            if (window.rainRouteMap) {
                const center = window.rainRouteMap.getCenter();
                lat = center.lat;
                lng = center.lng;
            } else {
                lat = 9.5804; // Kuttikkanam fallback
                lng = 76.9734;
            }
        }
        
        const finalDescription = (locationText && !locationText.startsWith("GPS:")) ? 
            `Location: ${locationText}\n${description}` : 
            (description || 'No additional details provided.');

        const reportData = {
            type: selectedCategory,
            category: selectedCategory,
            title: categoryTitles[selectedCategory] || 'Incident',
            description: finalDescription,
            severity: parseInt(severity, 10),
            isUserCreated: true,
            // Add slight jitter so the marker isn't completely hidden under the user's blue dot
            lat: lat + ((Math.random() - 0.5) * 0.0005),
            lng: lng + ((Math.random() - 0.5) * 0.0005),
            timeReported: new Date().toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}),
            status: 'Pending',
            reporter: 'Anonymous User',
            confirmations: 1
        };

        try {
            await RainRouteData.saveReport(reportData);
            
            // Show Feedback based on network status
            feedbackEl.style.display = 'block';
            if (navigator.onLine) {
                feedbackEl.textContent = '✅ Synced Successfully';
                feedbackEl.style.backgroundColor = '#e8f5e9'; // light green
                feedbackEl.style.color = 'var(--success-color)';
            } else {
                feedbackEl.textContent = '💾 Saved Offline';
                feedbackEl.style.backgroundColor = '#fff3e0'; // light orange
                feedbackEl.style.color = '#ef6c00'; // dark orange
            }

            // Trigger Map Update
            window.dispatchEvent(new Event('rainroute-data-ready'));

            // Reset form
            document.getElementById('incident-desc').value = '';
            if (locationInput) locationInput.value = '';
            locationStatus.style.display = 'none';
            
            // Switch back to Map view automatically after a short delay
            setTimeout(() => {
                feedbackEl.style.display = 'none';
                document.querySelector('.nav-item[data-target="view-map"]').click();
            }, 1500);

        } catch (err) {
            console.error('Error saving report', err);
            alert('Failed to save report to local storage.');
        }
    });
});
