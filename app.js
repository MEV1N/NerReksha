/**
 * Main application logic for NerReksha (Premium UI)
 * Handles UI state, navigation sheets, and form submissions.
 */

document.addEventListener('DOMContentLoaded', () => {
    /* ---------- sheets & nav ---------- */
    const scrim = document.getElementById('scrim');
    const sheets = ['report','sos','resources','info'];
    
    function openSheet(name){
      sheets.forEach(s => {
          const sheet = document.getElementById('sheet-'+s);
          if (sheet) sheet.classList.toggle('open', s===name);
      });
      if (scrim) scrim.classList.add('show');
      document.querySelectorAll('.nav-item').forEach(n => n.classList.toggle('active', n.dataset.view===name));
      
      if(name==='resources') renderResourceList();
      if(name==='sos') renderSOSList();
    }
    
    window.closeSheets = function(){
      sheets.forEach(s => {
          const sheet = document.getElementById('sheet-'+s);
          if (sheet) sheet.classList.remove('open');
      });
      if (scrim) scrim.classList.remove('show');
      document.querySelectorAll('.nav-item').forEach(n => n.classList.toggle('active', n.dataset.view==='map'));
    }
    
    if (scrim) scrim.addEventListener('click', window.closeSheets);
    document.querySelectorAll('[data-close]').forEach(b => b.addEventListener('click', window.closeSheets));
    
    document.querySelectorAll('.nav-item').forEach(btn => {
      btn.addEventListener('click', () => {
        if(btn.dataset.view === 'map') window.closeSheets();
        else openSheet(btn.dataset.view);
      });
    });
    
    const fabSOS = document.getElementById('fabSOS');
    if (fabSOS) fabSOS.addEventListener('click', () => openSheet('sos'));

    /* ---------- toast ---------- */
    let toastTimer;
    window.showToast = function(msg){
      const t = document.getElementById('toast');
      const text = document.getElementById('toastText');
      if (!t || !text) return;
      text.textContent = msg;
      t.classList.add('show');
      clearTimeout(toastTimer);
      toastTimer = setTimeout(() => t.classList.remove('show'), 2200);
    }

    /* ---------- resource tabs ---------- */
    const tabbar = document.querySelector('.tabbar');
    if (tabbar) {
        tabbar.addEventListener('click', e => {
            const btn = e.target.closest('button'); 
            if(!btn) return;
            document.querySelectorAll('.tabbar button').forEach(b => b.dataset.selected = 'false');
            btn.dataset.selected = 'true';
            const isAdd = btn.dataset.tab === 'add';
            document.getElementById('resourceBrowse').style.display = isAdd ? 'none' : 'block';
            document.getElementById('resourceAdd').style.display = isAdd ? 'block' : 'none';
        });
    }

    /* ---------- UI State Variables ---------- */
    const state = {
        selectedSOSType: 'medical',
        selectedResourceType: 'relief',
        peopleCount: 1
    };

    /* ---------- type grids (sos / resource) ---------- */
    function buildTypeGrid(container, types, stateKey){
      if (!container) return;
      container.innerHTML='';
      types.forEach(t => {
        const el = document.createElement('button');
        el.type='button';
        el.className='type-opt';
        el.dataset.selected = (t.id === state[stateKey]) ? 'true' : 'false';
        el.innerHTML = `<span style="font-family:'IBM Plex Mono',monospace;font-weight:600;">${t.code}</span><span>${t.label}</span>`;
        el.addEventListener('click', () => {
          state[stateKey] = t.id;
          [...container.children].forEach(c => c.dataset.selected='false');
          el.dataset.selected='true';
        });
        container.appendChild(el);
      });
    }
    
    const SOS_TYPES = [
      { id:'medical', code:'MD', label:'Medical' },
      { id:'trapped', code:'TR', label:'Trapped' },
      { id:'flood', code:'FL', label:'Flood rescue' },
      { id:'fire', code:'FI', label:'Fire' },
      { id:'other', code:'OT', label:'Other' },
    ];
    const RESOURCE_TYPES = [
      { id:'relief', code:'RC', label:'Relief camp' },
      { id:'medical', code:'MC', label:'Medical camp' },
      { id:'food', code:'FD', label:'Food' },
      { id:'water', code:'DW', label:'Drinking water' },
      { id:'power', code:'CS', label:'Charging' },
      { id:'toilet', code:'PT', label:'Toilet' },
      { id:'volunteer', code:'VR', label:'Volunteers' },
      { id:'fuel', code:'FA', label:'Fuel' },
      { id:'supply', code:'SD', label:'Supplies' },
      { id:'other', code:'OT', label:'Other' },
    ];
    
    buildTypeGrid(document.getElementById('sosTypeGrid'), SOS_TYPES, 'selectedSOSType');
    buildTypeGrid(document.getElementById('resourceTypeGrid'), RESOURCE_TYPES, 'selectedResourceType');

    /* people stepper */
    const pMinus = document.getElementById('peopleMinus');
    const pPlus = document.getElementById('peoplePlus');
    const pCount = document.getElementById('peopleCount');
    if (pMinus && pPlus && pCount) {
        pMinus.addEventListener('click', () => {
          state.peopleCount = Math.max(1, state.peopleCount - 1);
          pCount.textContent = state.peopleCount;
        });
        pPlus.addEventListener('click', () => {
          state.peopleCount = Math.min(50, state.peopleCount + 1);
          pCount.textContent = state.peopleCount;
        });
    }

    /* ---------- Render Lists (SOS & Resources) ---------- */
    async function renderSOSList() {
        const wrap = document.getElementById('sosList');
        if (!wrap) return;
        
        const allSOS = await window.NerRekshaData.loadSOS();
        if(allSOS.length === 0){
          wrap.innerHTML = `<div class="empty-state"><svg viewBox="0 0 24 24" fill="none" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M10.3 3.9 2.4 18a1.6 1.6 0 0 0 1.4 2.4h16.4a1.6 1.6 0 0 0 1.4-2.4L13.7 3.9a1.6 1.6 0 0 0-2.8 0Z"/><path d="M12 9v4M12 16.5h.01"/></svg><p>No SOS requests yet</p></div>`;
          return;
        }
        
        wrap.innerHTML='';
        allSOS.reverse().forEach(s => {
          const t = SOS_TYPES.find(x => x.id === s.emergencyType?.toLowerCase()) || SOS_TYPES[4];
          const div = document.createElement('div');
          div.className='item-card';
          
          function escapeHTML(s){ const d=document.createElement('div'); d.textContent=s||''; return d.innerHTML; }
          function timeAgo(tsText){ return tsText; }
          function statusLabel(st){ return st === 'Waiting' ? 'Waiting' : st === 'Enroute' ? 'Rescue on the way' : 'Resolved'; }
          
          let stClass = s.status === 'Waiting' ? 'waiting' : s.status === 'Enroute' ? 'enroute' : 'resolved';

          div.innerHTML = `
            <div class="item-icon" style="background:var(--danger-soft);"><span style="font-family:'IBM Plex Mono',monospace;font-weight:600;font-size:12px;color:var(--danger-ink);">${t.code}</span></div>
            <div class="item-main">
              <div class="item-title">${t.label}<span class="status-tag ${stClass}">${statusLabel(s.status || 'Waiting')}</span></div>
              <div class="item-desc">${escapeHTML(s.description || (s.peopleCount+' people affected'))}</div>
              <div class="item-meta">${timeAgo(s.timeReported)}${s.contact? ' · '+escapeHTML(s.contact):''}</div>
            </div>
            <button class="status-cycle" data-id="${s.id}">Update</button>
          `;
          wrap.appendChild(div);
        });
        
        wrap.querySelectorAll('.status-cycle').forEach(btn => {
          btn.addEventListener('click', async () => {
            const id = btn.dataset.id;
            const s = allSOS.find(x => x.id == id);
            let nextStatus = s.status === 'Waiting' ? 'Enroute' : s.status === 'Enroute' ? 'Resolved' : 'Resolved';
            await window.updateSOSStatusMap(id, nextStatus);
            renderSOSList();
          });
        });
    }

    async function renderResourceList() {
        const wrap = document.getElementById('resourceList');
        if (!wrap) return;
        
        const resources = await window.NerRekshaData.loadSafePlaces();
        if(resources.length === 0){
          wrap.innerHTML = `<div class="empty-state"><svg viewBox="0 0 24 24" fill="none" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M3 10.5 12 3l9 7.5"/><path d="M5 9.5V20a1 1 0 0 0 1 1h4v-6h4v6h4a1 1 0 0 0 1-1V9.5"/></svg><p>No resources added yet</p></div>`;
          return;
        }
        
        wrap.innerHTML='';
        resources.reverse().forEach(r => {
          const t = RESOURCE_TYPES.find(x => x.id === (r.type||'').replace('-camp','')) || RESOURCE_TYPES.find(x => x.id==='other');
          const div = document.createElement('div');
          div.className='item-card';
          
          function escapeHTML(s){ const d=document.createElement('div'); d.textContent=s||''; return d.innerHTML; }
          
          div.innerHTML = `
            <div class="item-icon" style="background:var(--accent-soft);"><span style="font-family:'IBM Plex Mono',monospace;font-weight:600;font-size:12px;color:var(--accent-ink);">${t.code}</span></div>
            <div class="item-main">
              <div class="item-title">${escapeHTML(r.title)}</div>
              <div class="item-desc">${t.label}${r.capacity? ' · '+escapeHTML(r.capacity):''}${r.description? ' — '+escapeHTML(r.description):''}</div>
              <div class="item-meta">Added recently${r.contact? ' · '+escapeHTML(r.contact):''}</div>
              <button class="btn-secondary" onclick="window.closeSheets(); setTimeout(() => window.routeTo(${r.lat}, ${r.lng}), 300)" style="margin-top: 8px; padding: 6px; font-size: 12px; border: none; background: var(--surface-sunken);">Route Here</button>
            </div>
            <button class="status-cycle" data-id="${r.id}" style="color:var(--danger-ink);">Remove</button>
          `;
          wrap.appendChild(div);
        });
        
        wrap.querySelectorAll('.status-cycle').forEach(btn => {
            btn.addEventListener('click', async () => {
                await window.removeResourceMap(btn.dataset.id);
                renderResourceList();
            });
        });
    }

    /* ---------- Form Submissions ---------- */
    const submitSOS = document.getElementById('submitSOS');
    if (submitSOS) {
        submitSOS.addEventListener('click', async (e) => {
            e.preventDefault();
            submitSOS.disabled = true;
            submitSOS.innerHTML = 'Sending...';
            
            let lat = null, lng = null;
            if (window.nerRekshaMap) {
                const center = window.nerRekshaMap.getCenter();
                lat = center.lat; lng = center.lng;
            }
            
            const sosData = {
                type: 'sos',
                title: 'SOS Emergency',
                emergencyType: state.selectedSOSType,
                peopleCount: state.peopleCount,
                contact: document.getElementById('sosContact').value,
                description: document.getElementById('sosNotes').value || 'Immediate assistance required.',
                lat: lat, lng: lng,
                timeReported: new Date().toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}),
                status: 'Waiting',
                reporter: 'You',
                isUserCreated: true
            };
            
            try {
                await NerRekshaData.saveSOS(sosData);
                window.dispatchEvent(new Event('nerreksha-data-ready'));
                window.showToast('SOS sent — help is being notified');
                
                submitSOS.innerHTML = '✅ SOS SENT';
                submitSOS.style.backgroundColor = 'var(--success)';
                
                setTimeout(() => {
                    document.getElementById('sosContact').value = '';
                    document.getElementById('sosNotes').value = '';
                    state.peopleCount = 1;
                    if (pCount) pCount.textContent = '1';
                    
                    submitSOS.disabled = false;
                    submitSOS.innerHTML = 'Send SOS now';
                    submitSOS.style.backgroundColor = '';
                    window.closeSheets();
                }, 1500);
            } catch (err) {
                alert('Failed to send SOS.');
                submitSOS.disabled = false;
                submitSOS.innerHTML = 'Send SOS now';
            }
        });
    }

    const submitResource = document.getElementById('submitResource');
    if (submitResource) {
        submitResource.addEventListener('click', async (e) => {
            const name = document.getElementById('resourceName').value.trim();
            if(!name){ document.getElementById('resourceName').focus(); return; }
            
            let lat = null, lng = null;
            if (window.nerRekshaMap) {
                const center = window.nerRekshaMap.getCenter();
                lat = center.lat; lng = center.lng;
            }
            
            const newResource = {
                title: name,
                type: state.selectedResourceType,
                description: document.getElementById('resourceDesc').value.trim(),
                capacity: document.getElementById('resourceCapacity').value.trim(),
                contact: document.getElementById('resourceContact').value.trim(),
                hasFood: false, hasWater: false, hasPower: false,
                lat: lat, lng: lng,
                isUserCreated: true
            };
            
            await NerRekshaData.saveSafePlace(newResource);
            window.dispatchEvent(new Event('nerreksha-data-ready'));
            
            ['resourceName','resourceCapacity','resourceContact','resourceDesc'].forEach(id=>document.getElementById(id).value='');
            
            document.querySelector('.tabbar button[data-tab="browse"]').click();
            window.showToast('Resource added to map');
        });
    }

    // Connect Demo Data Buttons
    const demoBtn = document.getElementById('demoBtn');
    const loadDemoBtn2 = document.getElementById('loadDemoBtn2');
    const resetBtn = document.getElementById('resetBtn');

    async function handleLoadDemo() {
        const existing = await NerRekshaData.loadReports();
        if (existing.length > 0) {
            if (!confirm("Demo data already exists. Replace existing data?")) return;
            await NerRekshaData.clearAllData();
        }
        
        let centerLat = 9.5804, centerLng = 76.9734;
        if (window.nerRekshaMap) {
            const c = window.nerRekshaMap.getCenter();
            centerLat = c.lat; centerLng = c.lng;
        }
        
        const r = () => (Math.random() - 0.5) * 0.08;

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
        const types = ['relief', 'hospital', 'food', 'water', 'power', 'toilet', 'volunteer', 'fuel', 'supply', 'other'];
        for(let i=0; i<10; i++) {
            resources.push({
                type: types[i],
                title: `Community ${types[i].toUpperCase()}`,
                description: 'Simulated community resource.',
                lat: centerLat + r(),
                lng: centerLng + r(),
                capacity: 100 + (i*10),
                isUserCreated: false
            });
        }
        
        await NerRekshaData.saveBulkData(hazards, sosList, resources);
        window.dispatchEvent(new Event('nerreksha-data-ready'));
        window.showToast('Demo data loaded');
    }

    if (demoBtn) demoBtn.addEventListener('click', handleLoadDemo);
    if (loadDemoBtn2) loadDemoBtn2.addEventListener('click', handleLoadDemo);

    if (resetBtn) {
        resetBtn.addEventListener('click', async () => {
            if(!confirm('Clear all hazards, SOS requests and resources from this device?')) return;
            await NerRekshaData.clearAllData();
            window.dispatchEvent(new Event('nerreksha-data-ready'));
            window.showToast('Local data cleared');
        });
    }

    // Register Service Worker
    if ('serviceWorker' in navigator) {
        window.addEventListener('load', () => {
            navigator.serviceWorker.register('./service-worker.js').catch(err => console.log('SW failed', err));
        });
    }

    // Route feedback logic
    const viewFeedback = document.getElementById('view-route-feedback');
    const btnSkipFeedback = document.getElementById('btn-skip-feedback');
    const feedbackBtns = document.querySelectorAll('.btn-feedback');
    
    window.showRouteFeedbackPrompt = function(destLatLon) {
        if (!viewFeedback) return;
        window.currentFeedbackDest = destLatLon;
        viewFeedback.style.display = 'flex';
    };

    if (viewFeedback && btnSkipFeedback) {
        btnSkipFeedback.addEventListener('click', () => {
            viewFeedback.style.display = 'none';
            window.currentFeedbackDest = null;
        });

        feedbackBtns.forEach(btn => {
            btn.addEventListener('click', async (e) => {
                const feedbackVal = e.target.getAttribute('data-feedback');
                try {
                    await NerRekshaData.saveRouteFeedback({
                        destination: window.currentFeedbackDest,
                        feedback: feedbackVal
                    });
                    window.showToast("Thanks for the feedback!");
                } catch (err) {
                    console.error("Failed to save feedback", err);
                } finally {
                    viewFeedback.style.display = 'none';
                    window.currentFeedbackDest = null;
                }
            });
        });
    }
});
