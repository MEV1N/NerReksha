/**
 * Hazard reporting logic for NerReksha (Premium UI)
 */
document.addEventListener('DOMContentLoaded', () => {
    
    /* ---------- UI State Variables ---------- */
    const state = {
        selectedHazardType: 'flood',
        selectedHazardSeverity: 1
    };

    const HAZARD_TYPES = [
      { id:'flood', code:'FL', label:'Flood' },
      { id:'landslide', code:'LS', label:'Landslide' },
      { id:'tree', code:'FT', label:'Fallen tree' },
      { id:'road', code:'RB', label:'Road blocked' },
      { id:'bridge', code:'BD', label:'Bridge damage' },
      { id:'other', code:'OT', label:'Other' },
    ];

    /* ---------- type grids (report) ---------- */
    const container = document.getElementById('hazardTypeGrid');
    if (container) {
        container.innerHTML='';
        HAZARD_TYPES.forEach(t => {
            const el = document.createElement('button');
            el.type='button';
            el.className='type-opt';
            el.dataset.selected = (t.id === state.selectedHazardType) ? 'true' : 'false';
            el.innerHTML = `<span style="font-family:'IBM Plex Mono',monospace;font-weight:600;">${t.code}</span><span>${t.label}</span>`;
            el.addEventListener('click', () => {
                state.selectedHazardType = t.id;
                [...container.children].forEach(c => c.dataset.selected='false');
                el.dataset.selected='true';
            });
            container.appendChild(el);
        });
    }

    /* severity segmented */
    const sevContainer = document.getElementById('hazardSeverity');
    if (sevContainer) {
        sevContainer.addEventListener('click', e => {
            const btn = e.target.closest('button'); 
            if(!btn) return;
            [...e.currentTarget.children].forEach(c => c.dataset.selected='false');
            btn.dataset.selected='true';
            state.selectedHazardSeverity = Number(btn.dataset.val);
        });
    }

    const categoryTitles = {
        'flood': 'Flood Reported',
        'landslide': 'Landslide Reported',
        'tree': 'Tree Fallen',
        'road': 'Road Blocked',
        'bridge': 'Bridge Damaged',
        'other': 'Incident Reported'
    };

    /* ---------- Submit Handler ---------- */
    const submitHazard = document.getElementById('submitHazard');
    if (submitHazard) {
        submitHazard.addEventListener('click', async () => {
            const description = document.getElementById('hazardDesc').value.trim();
            const severityMap = { 1: 3, 2: 4, 3: 5 }; // Map 1-3 scale to old 3-5 severity
            
            submitHazard.disabled = true;
            submitHazard.innerHTML = 'Submitting...';

            let lat = null;
            let lng = null;

            if (window.nerRekshaMap) {
                const center = window.nerRekshaMap.getCenter();
                lat = center.lat;
                lng = center.lng;
            } else {
                lat = 9.5804;
                lng = 76.9734;
            }

            const reportData = {
                type: state.selectedHazardType,
                category: state.selectedHazardType === 'road' ? 'road' : state.selectedHazardType,
                title: categoryTitles[state.selectedHazardType] || 'Incident',
                description: description || 'No additional details provided.',
                severity: severityMap[state.selectedHazardSeverity],
                isUserCreated: true,
                lat: lat + ((Math.random() - 0.5) * 0.0005),
                lng: lng + ((Math.random() - 0.5) * 0.0005),
                timeReported: new Date().toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}),
                status: 'Pending',
                reporter: 'You',
                confirmations: 1
            };

            try {
                await NerRekshaData.saveReport(reportData);
                window.dispatchEvent(new Event('nerreksha-data-ready'));
                
                if (window.showToast) {
                    window.showToast(navigator.onLine ? 'Hazard report synced' : 'Hazard saved offline');
                }
                
                document.getElementById('hazardDesc').value = '';
                state.selectedHazardSeverity = 1;
                if (sevContainer) {
                    [...sevContainer.children].forEach(c => c.dataset.selected = (c.dataset.val == 1) ? 'true' : 'false');
                }
                
                if (window.closeSheets) window.closeSheets();
                
            } catch (err) {
                console.error('Error saving report', err);
                alert('Failed to save report.');
            } finally {
                submitHazard.disabled = false;
                submitHazard.innerHTML = 'Submit report';
            }
        });
    }
});
