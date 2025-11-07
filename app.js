// app.js - CarbuAlert Mali (frontend prototype)
// Features: Leaflet map, mock dataset, localStorage reports, filters, toast notifications, auto-refresh

(function(){
  const SITE_NAME = 'CarbuAlert Mali';
  const AUTO_REFRESH_MIN = 5; // minutes

  // mock initial stations (id, name, city, coords, fuel types, availability)
  const initial = [
    {id:1,name:'Station Bamako Nord',city:'Bamako',lat:12.6561,lon:-8.0,fuel:['essence','gazole'],available:{essence:true,gazole:false,gpl:false},updated:'2025-11-07T08:00:00Z'},
    {id:2,name:'Station Sikasso Centrale',city:'Sikasso',lat:11.317,lon:-5.666,fuel:['essence'],available:{essence:false,gazole:false,gpl:false},updated:'2025-11-06T14:30:00Z'},
    {id:3,name:'Station Kayes',city:'Kayes',lat:14.447,lon:-11.435,fuel:['gazole','essence'],available:{essence:true,gazole:true,gpl:false},updated:'2025-11-07T05:10:00Z'},
    {id:4,name:'Station Mopti Ouest',city:'Mopti',lat:14.491,lon:-4.176,fuel:['gazole'],available:{essence:false,gazole:true,gpl:false},updated:'2025-11-05T09:00:00Z'}
  ];

  const KEY_ST = 'carbustations_v2';
  const KEY_REPORTS = 'carbureports_v2';

  if(!localStorage.getItem(KEY_ST)) localStorage.setItem(KEY_ST, JSON.stringify(initial));

  function loadStations(){ try{ return JSON.parse(localStorage.getItem(KEY_ST)) || []; }catch(e){return []} }
  function saveStations(s){ localStorage.setItem(KEY_ST, JSON.stringify(s)); }
  function loadReports(){ try{ return JSON.parse(localStorage.getItem(KEY_REPORTS))||[] }catch(e){return []} }
  function saveReports(r){ localStorage.setItem(KEY_REPORTS, JSON.stringify(r)); }

  // Toast
  const toastEl = document.getElementById('toast');
  function showToast(msg, dur=2200){ toastEl.textContent = msg; toastEl.style.display='block'; clearTimeout(toastEl._t); toastEl._t=setTimeout(()=>{ toastEl.style.display='none'; }, dur); }

  // Map
  const map = L.map('map', {zoomControl:true}).setView([12.6392, -8.0029], 6);
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',{maxZoom:19,attribution:'© OpenStreetMap contributors'}).addTo(map);
  const markers = L.layerGroup().addTo(map);

  // Render markers and list
  function formatAvail(av){
    if(!av) return '—';
    const parts=[]; if(av.essence) parts.push('Essence'); if(av.gazole) parts.push('Gazole'); if(av.gpl) parts.push('GPL'); return parts.length?parts.join(', '):'Rupture';
  }

  function renderMarkers(stations){
    markers.clearLayers();
    stations.forEach(s=>{
      let status = (s.available && Object.values(s.available).some(v=>v)) ? 'ok' : 'empty';
      let color = status==='ok' ? '#2ecc71' : '#e74c3c';
      // partial
      if(s.available && Object.values(s.available).some(v=>v) && !Object.values(s.available).every(v=>v)) color = '#f1c40f';
      const m = L.circleMarker([s.lat,s.lon],{radius:9,fillColor:color,color:'#fff',weight:1,fillOpacity:0.95}).addTo(markers);
      const popupHTML = `<strong>${s.name}</strong><br/>${s.city}<br/>Disponibilités: ${formatAvail(s.available)}<br/><small>MAJ: ${s.updated ? new Date(s.updated).toLocaleString() : '—'}</small><br/><button onclick="window.__openReport(${s.id})">Signaler</button>`;
      m.bindPopup(popupHTML);
    });
  }

  window.__openReport = function(id){ openReportForm(id); }

  function renderList(filter='all', maxDist=9999){
    const list = document.getElementById('list'); list.innerHTML='';
    const stations = loadStations();
    const filtered = stations.filter(s=> filter==='all' ? true : s.fuel.includes(filter));
    document.getElementById('countStations').textContent = filtered.length;
    document.getElementById('lastUpdate').textContent = new Date().toLocaleString();

    filtered.forEach(s=>{
      const el = document.createElement('div'); el.className='station card';
      const h = document.createElement('h3'); h.textContent = s.name + ' — ' + s.city; el.appendChild(h);
      const tags = document.createElement('div');
      s.fuel.forEach(f=>{ const sp=document.createElement('span'); sp.className='tag'; sp.textContent=f; tags.appendChild(sp); });
      el.appendChild(tags);
      const p = document.createElement('div'); p.className='small muted'; p.textContent = 'Disponibilités: ' + formatAvail(s.available); el.appendChild(p);
      const row = document.createElement('div'); row.style.marginTop='8px';
      const goto = document.createElement('button'); goto.className='ghost'; goto.textContent='Aller'; goto.onclick=()=>{ map.setView([s.lat,s.lon],14); };
      const rep = document.createElement('button'); rep.className='btn'; rep.style.marginLeft='8px'; rep.textContent='Signaler'; rep.onclick=()=>openReportForm(s.id);
      row.appendChild(goto); row.appendChild(rep);
      el.appendChild(row);
      list.appendChild(el);
    });

    renderMarkers(filtered);
  }

  // Report form - simple modal via prompts (keeps project single-file)
  function openReportForm(id){
    const stations = loadStations();
    const s = stations.find(x=>x.id===id);
    if(!s) return alert('Station introuvable.');
    const msg = prompt(`Signaler la disponibilité pour ${s.name}\nFormat: essence=oui|non,gazole=oui|non,gpl=oui|non`,'essence=oui,gazole=no,gpl=no');
    if(!msg) return;
    const parts = msg.split(',').map(p=>p.split('='));
    const newAvail = {essence:false,gazole:false,gpl:false};
    parts.forEach(pp=>{ if(pp[0]&&pp[1]) newAvail[pp[0].trim()]= pp[1].trim().toLowerCase().startsWith('o'); });
    s.available = newAvail; s.updated = new Date().toISOString();
    saveStations(stations);
    const reports = loadReports(); reports.push({stationId:id,avail:newAvail,at:new Date().toISOString()}); saveReports(reports);
    showToast('Signalement enregistré (stocké localement)');
    renderList(document.getElementById('fuelFilter').value);
  }

  // Add quick new station near map center
  document.getElementById('reportBtn').addEventListener('click', ()=>{
    const c = map.getCenter();
    const name = prompt('Nom de la station (ex: Station X)'); if(!name) return;
    const city = prompt('Ville / localité (ex: Gao)') || '—';
    const fuels = prompt('Carburants (séparés par ,) ex: essence,gazole') || 'essence';
    const arr = fuels.split(',').map(x=>x.trim());
    const st = loadStations(); const id = Math.max(0,...st.map(s=>s.id))+1;
    const newS = {id:id,name:name,city:city,lat:c.lat,lon:c.lng,fuel:arr,available:{essence:arr.includes('essence'),gazole:arr.includes('gazole'),gpl:arr.includes('gpl')},updated:new Date().toISOString()};
    st.push(newS); saveStations(st);
    showToast('Nouvelle station ajoutée (local)');
    renderList(document.getElementById('fuelFilter').value);
  });

  // Locate user
  document.getElementById('locateBtn').addEventListener('click', ()=>{
    if(!navigator.geolocation) return alert('Géolocalisation non supportée.');
    navigator.geolocation.getCurrentPosition(p=>{ map.setView([p.coords.latitude,p.coords.longitude],13); L.circle([p.coords.latitude,p.coords.longitude],{radius:80}).addTo(map); }, err=>{ alert('Erreur géoloc: '+err.message); });
  });

  // Refresh
  document.getElementById('refreshBtn').addEventListener('click', ()=>{ renderList(document.getElementById('fuelFilter').value); showToast('Liste rafraîchie'); });

  // Filters
  document.getElementById('fuelFilter').addEventListener('change', (e)=> renderList(e.target.value));
  const distRange = document.getElementById('distanceRange'); const distVal = document.getElementById('distanceValue');
  distRange.addEventListener('input', ()=>{ distVal.textContent = distRange.value; /* could filter by distance when implemented */ });

  // Theme toggle (simple)
  const root = document.documentElement;
  const themeToggle = document.getElementById('themeToggle');
  function applyTheme(t){ if(t==='dark') root.style.background='#0b1220'; else root.style.background=''; localStorage.setItem('carbu_theme', t); }
  themeToggle.addEventListener('click', ()=>{ const cur = localStorage.getItem('carbu_theme')||'light'; const next = cur==='light'?'dark':'light'; applyTheme(next); showToast('Thème: '+next); });

  // Auto-refresh every AUTO_REFRESH_MIN minutes (soft)
  setInterval(()=>{ renderList(document.getElementById('fuelFilter').value); showToast('Mise à jour automatique'); }, AUTO_REFRESH_MIN*60*1000);

  // Initial render
  renderList('all');

  // Expose import function for external datasets (developer hook)
  window.__importExternal = function(arr){
    if(!Array.isArray(arr)) return false;
    const st = loadStations();
    arr.forEach(s=>{ const idx = st.findIndex(x=>x.id===s.id); if(idx>=0) st[idx]=Object.assign(st[idx],s); else st.push(s); });
    saveStations(st); renderList(document.getElementById('fuelFilter').value); return true;
  };

})();