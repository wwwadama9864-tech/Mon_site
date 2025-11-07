(function(){
  const initial = [
    {id:1,name:'Station Bamako Nord',city:'Bamako',lat:12.6561,lon:-8.0,fuel:['essence','gazole'],available:{essence:true,gazole:false,gpl:false},updated:'2025-11-07T08:00:00Z'},
    {id:2,name:'Station Sikasso Centrale',city:'Sikasso',lat:11.317,lon:-5.666,fuel:['essence'],available:{essence:false,gazole:false,gpl:false},updated:'2025-11-06T14:30:00Z'},
    {id:3,name:'Station Kayes',city:'Kayes',lat:14.447,lon:-11.435,fuel:['gazole','essence'],available:{essence:true,gazole:true,gpl:false},updated:'2025-11-07T05:10:00Z'},
    {id:4,name:'Station Mopti Ouest',city:'Mopti',lat:14.491,lon:-4.176,fuel:['gazole'],available:{essence:false,gazole:true,gpl:false},updated:'2025-11-05T09:00:00Z'}
  ];

  const KEY_ST = 'carbustations_v2';
  if(!localStorage.getItem(KEY_ST)) localStorage.setItem(KEY_ST, JSON.stringify(initial));

  function loadStations(){ return JSON.parse(localStorage.getItem(KEY_ST)) || []; }
  function saveStations(s){ localStorage.setItem(KEY_ST, JSON.stringify(s)); }

  const toastEl = document.getElementById('toast');
  function showToast(msg,dur=2200){ toastEl.textContent=msg; toastEl.style.display='block'; clearTimeout(toastEl._t); toastEl._t=setTimeout(()=>{toastEl.style.display='none'},dur); }

  // Leaflet Map
  const map = L.map('map').setView([12.6392,-8.0029],6);
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',{maxZoom:19,attribution:'© OpenStreetMap contributors'}).addTo(map);
  const markers = L.layerGroup().addTo(map);

  function formatAvail(av){ if(!av) return '—'; const parts=[]; if(av.essence) parts.push('Essence'); if(av.gazole) parts.push('Gazole'); if(av.gpl) parts.push('GPL'); return parts.length?parts.join(', '):'Rupture'; }

  function renderMarkers(stations){
    markers.clearLayers();
    stations.forEach(s=>{
      let status = (s.available && Object.values(s.available).some(v=>v)) ? 'ok' : 'empty';
      let color = status==='ok' ? '#2ecc71' : '#e74c3c';
      if(s.available && Object.values(s.available).some(v=>v) && !Object.values(s.available).every(v=>v)) color='#f1c40f';
      const m=L.circleMarker([s.lat,s.lon],{radius:9,fillColor:color,color:'#fff',weight:1,fillOpacity:0.95}).addTo(markers);
      const popupHTML = `<strong>${s.name}</strong><br/>${s.city}<br/>Disponibilités: ${formatAvail(s.available)}<br/><small>MAJ: ${s.updated?new Date(s.updated).toLocaleString():'—'}</small><br/><button onclick="window.__openReport(${s.id})">Signaler</button>`;
      m.bindPopup(popupHTML);
    });
  }

  window.__openReport=function(id){ openReportForm(id); }

  function renderTable(stations){
    const tbody=document.querySelector('#stationsTable tbody');
    tbody.innerHTML='';
    if(stations.length===0){ tbody.innerHTML='<tr><td colspan="5" style="text-align:center">Aucune station disponible</td></tr>'; return; }
    stations.forEach(s=>{
      const tr=document.createElement('tr');
      const statut=(s.available && Object.values(s.available).some(v=>v))?'Disponible':'Rupture';
      tr.innerHTML=`<td>${s.name}</td><td>${s.city}</td><td>${s.updated?new Date(s.updated).toLocaleString():'—'}</td><td>${statut}</td><td><button onclick="window.__openReport(${s.id})">Signaler</button></td>`;
      tbody.appendChild(tr);
    });
  }

  function renderList(filter='all'){
    const stations=loadStations();
    const filtered=stations.filter(s=>filter==='all'?true:s.fuel.includes(filter));
    renderMarkers(filtered); renderTable(filtered);
    document.getElementById('countStations').textContent=filtered.length;
    document.getElementById('lastUpdate').textContent=new Date().toLocaleString();
  }

  function openReportForm(id){
    const stations=loadStations(); const s=stations.find(x=>x.id===id);
    if(!s)return alert('Station introuvable.');
    const msg=prompt(`Signaler la disponibilité pour ${s.name}\nFormat: essence=oui|non,gazole=oui|non,gpl=oui|non`,'essence=oui,gazole=no,gpl=no');
    if(!msg) return;
    const parts=msg.split(',').map(p=>p.split('='));
    const newAvail={essence:false,gazole:false,gpl:false};
    parts.forEach(pp=>{ if(pp[0]&&pp[1]) newAvail[pp[0].trim()]=pp[1].trim().toLowerCase().startsWith('o'); });
    s.available=newAvail; s.updated=new Date().toISOString();
    saveStations(stations);
    showToast('Signalement enregistré (local)');
    renderList(document.getElementById('fuelFilter').value);
  }

  document.getElementById('reportBtn').addEventListener('click',()=>{
    const c=map.getCenter();
    const name=prompt('Nom de la station'); if(!name) return;
    const city=prompt('Ville / localité')||'—';
    const fuels=prompt('Carburants (séparés par ,) ex: essence,gazole')||'essence';
    const arr=fuels.split(',').map(x=>x.trim());
    const st=loadStations(); const id=Math.max(0,...st.map(s=>s.id))+1;
    const newS={id:id,name:name,city:city,lat:c.lat,lon:c.lng,fuel:arr,available:{essence:arr.includes('essence'),gazole:arr.includes('gazole'),gpl:arr.includes('gpl')},updated:new Date().toISOString()};
    st.push(newS); saveStations(st); showToast('Nouvelle station ajoutée'); renderList(document.getElementById('fuelFilter').value);
  });

  document.getElementById('locateBtn').addEventListener('click',()=>{
    if(!navigator.geolocation) return alert('Géolocalisation non supportée.');
    navigator.geolocation.getCurrentPosition(p=>{ map.setView([p.coords.latitude,p.coords.longitude],13); L.circle([p.coords.latitude,p.coords.longitude],{radius:80}).addTo(map); }, err=>{ alert('Erreur géoloc: '+err.message); });
  });

  document.getElementById('refreshBtn').addEventListener('click',()=>{ renderList(document.getElementById('fuelFilter').value); showToast('Liste rafraîchie'); });
  document.getElementById('fuelFilter').addEventListener('change',(e)=> renderList(e.target.value));
  const distRange=document.getElementById('distanceRange'); const distVal=document.getElementById('distanceValue');
  distRange.addEventListener('input',()=>{ distVal.textContent=distRange.value; });

  // Toggle map
  const mapEl=document.getElementById('map');
  const toggleMapBtn=document.getElementById('toggleMapBtn');
  toggleMapBtn.addEventListener('click',()=>{
    mapEl.classList.toggle('map-hidden');
    setTimeout(()=>{ map.invalidateSize(); },200);
  });

  renderList();
})();