/* ═══════════════════════════════════════
   ORBIX 1.0 — NeoMap Explorer
   app.js — entièrement reécrit, sans bugs
   ═══════════════════════════════════════ */

// ── Carte ──────────────────────────────
const map = L.map('map').setView([46.6, 1.89], 6);

let tileLayer = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
  attribution: '© OpenStreetMap', maxZoom: 19
}).addTo(map);

// ── DOM ────────────────────────────────
const cityInput      = document.getElementById('cityInput');
const searchBtn      = document.getElementById('searchBtn');
const locateBtn      = document.getElementById('locateBtn');
const mapTypeSelect  = document.getElementById('mapType');
const routeFromInput = document.getElementById('routeFrom');
const routeToInput   = document.getElementById('routeTo');
const routeBtn       = document.getElementById('routeBtn');
const clearRouteBtn  = document.getElementById('clearRouteBtn');
const routeResult    = document.getElementById('routeResult');
const cityInfoDiv    = document.getElementById('cityInfo');
const cityInfoSection= document.getElementById('cityInfoSection');
const historyList    = document.getElementById('historyList');
const markerList     = document.getElementById('markerList');
const clearMarkersBtn= document.getElementById('clearMarkersBtn');
const meteoBox       = document.getElementById('meteoBox');

// ── État ───────────────────────────────
let cityMarker    = null;
let routeControl  = null;
let customMarkers = [];
let colorIdx      = 0;
let history       = JSON.parse(localStorage.getItem('orbix1_history') || '[]');

const COLORS = ['#00f0ff','#2979ff','#00e5a0','#ffb400','#ff3b5c','#b388ff','#ff7043'];

// ══════════════════════════════════════
//  FOND DE CARTE
// ══════════════════════════════════════
const tileSources = {
  streets:   'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
  satellite: 'https://{s}.google.com/vt/lyrs=s&x={x}&y={y}&z={z}',
  topo:      'https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png'
};

const tileOptions = {
  streets:   { maxZoom: 19, attribution: '© OpenStreetMap' },
  satellite: { maxZoom: 20, subdomains: ['mt0','mt1','mt2','mt3'], attribution: '© Google' },
  topo:      { maxZoom: 17, attribution: '© OpenTopoMap' }
};

mapTypeSelect.addEventListener('change', () => {
  const t = mapTypeSelect.value;
  map.removeLayer(tileLayer);
  tileLayer = L.tileLayer(tileSources[t], tileOptions[t]).addTo(map);
});

// ══════════════════════════════════════
//  HISTORIQUE
// ══════════════════════════════════════
function saveHistory(city, lat, lng) {
  history = history.filter(h => h.city.toLowerCase() !== city.toLowerCase());
  history.unshift({ city, lat, lng });
  if (history.length > 8) history = history.slice(0, 8);
  localStorage.setItem('orbix1_history', JSON.stringify(history));
  renderHistory();
}

function renderHistory() {
  if (!history.length) {
    historyList.innerHTML = '<p class="muted">Aucune ville consultée.</p>';
    return;
  }
  historyList.innerHTML = history.map(h =>
    `<div class="history-item" onclick="searchByName('${h.city.replace(/'/g,"\\'")}',${h.lat},${h.lng})">
       <i class="fa fa-location-dot"></i>${h.city}
     </div>`
  ).join('');
}
renderHistory();

// ══════════════════════════════════════
//  MÉTÉO  (Open-Meteo, sans clé API)
// ══════════════════════════════════════
const WX_ICONS = {
  0:'☀️',1:'🌤️',2:'⛅',3:'☁️',
  45:'🌫️',48:'🌫️',
  51:'🌦️',53:'🌦️',55:'🌧️',
  61:'🌧️',63:'🌧️',65:'🌧️',
  71:'❄️',73:'❄️',75:'❄️',
  80:'🌦️',81:'🌧️',82:'⛈️',
  95:'⛈️',96:'⛈️',99:'⛈️'
};
const WX_DESC = {
  0:'Ciel dégagé',1:'Peu nuageux',2:'Partiellement nuageux',3:'Couvert',
  45:'Brouillard',48:'Brouillard givrant',
  51:'Bruine légère',53:'Bruine modérée',55:'Bruine dense',
  61:'Pluie légère',63:'Pluie modérée',65:'Pluie forte',
  71:'Neige légère',73:'Neige modérée',75:'Neige forte',
  80:'Averses légères',81:'Averses modérées',82:'Averses violentes',
  95:'Orage',96:'Orage avec grêle',99:'Orage violent'
};

async function loadWeather(lat, lng) {
  meteoBox.innerHTML = '<p class="muted">Chargement météo…</p>';
  try {
    const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lng}` +
      `&current_weather=true&hourly=relativehumidity_2m,apparent_temperature,precipitation_probability,windspeed_10m` +
      `&timezone=auto&forecast_days=1`;
    const r = await fetch(url);
    const d = await r.json();
    const cw   = d.current_weather;
    const hour = new Date(cw.time).getHours();
    const hum  = d.hourly.relativehumidity_2m[hour] ?? '--';
    const feel = d.hourly.apparent_temperature[hour] ?? '--';
    const rain = d.hourly.precipitation_probability[hour] ?? '--';
    const temp = Math.round(cw.temperature);
    const wind = Math.round(cw.windspeed);
    const icon = WX_ICONS[cw.weathercode] || '🌡️';
    const desc = WX_DESC[cw.weathercode]  || 'Inconnu';

    meteoBox.innerHTML = `
      <div class="meteo-card">
        <div class="meteo-top">
          <div class="meteo-emoji">${icon}</div>
          <div>
            <div class="meteo-temp">${temp}°C</div>
            <div class="meteo-desc">${desc}</div>
          </div>
        </div>
        <div class="meteo-row">
          <div class="meteo-stat"><div class="ms-label">🌡️ Ressenti</div><div class="ms-value">${feel}°C</div></div>
          <div class="meteo-stat"><div class="ms-label">💧 Humidité</div><div class="ms-value">${hum}%</div></div>
          <div class="meteo-stat"><div class="ms-label">💨 Vent</div><div class="ms-value">${wind} km/h</div></div>
          <div class="meteo-stat"><div class="ms-label">🌂 Pluie</div><div class="ms-value">${rain}%</div></div>
        </div>
      </div>`;
  } catch {
    meteoBox.innerHTML = '<p class="muted">Météo indisponible.</p>';
  }
}

// ══════════════════════════════════════
//  INFOS VILLE  (Wikipedia + Wikidata)
// ══════════════════════════════════════
async function loadCityInfo(cityName) {
  cityInfoDiv.innerHTML = '<p class="muted">Chargement…</p>';
  cityInfoSection.style.display = 'block';

  try {
    // Wikipedia résumé
    const wikiR = await fetch(`https://fr.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(cityName)}`);
    const wiki  = await wikiR.json();
    const img   = wiki.thumbnail?.source || null;
    const desc  = wiki.extract?.slice(0, 220) + (wiki.extract?.length > 220 ? '…' : '') || '';

    // Wikidata pop + superficie
    let pop = 'N/A', area = 'N/A';
    const wdR  = await fetch(`https://www.wikidata.org/w/api.php?action=wbsearchentities&search=${encodeURIComponent(cityName)}&language=fr&format=json&origin=*`);
    const wdD  = await wdR.json();
    if (wdD.search?.length) {
      const id   = wdD.search[0].id;
      const sparql = `SELECT ?p ?a WHERE {
        OPTIONAL { wd:${id} wdt:P1082 ?p. }
        OPTIONAL { wd:${id} wdt:P2046 ?a. }
      }`;
      const spR  = await fetch(`https://query.wikidata.org/sparql?query=${encodeURIComponent(sparql)}&format=json`);
      const spD  = await spR.json();
      const b    = spD.results.bindings[0];
      if (b?.p) pop  = Number(b.p.value).toLocaleString('fr-FR');
      if (b?.a) area = parseFloat(b.a.value).toLocaleString('fr-FR') + ' km²';
    }

    cityInfoDiv.innerHTML = `
      <h3>${wiki.title || cityName}</h3>
      ${img ? `<img src="${img}" alt="${cityName}">` : ''}
      <div class="badge-grid">
        <div class="badge"><div class="b-label">👥 Population</div><div class="b-value">${pop}</div></div>
        <div class="badge"><div class="b-label">📐 Superficie</div><div class="b-value">${area}</div></div>
      </div>
      ${desc ? `<p>${desc}</p>` : ''}
      <p class="source-note">Source : Wikipédia · Wikidata · OpenStreetMap</p>
    `;
  } catch {
    cityInfoDiv.innerHTML = '<p class="muted">Données introuvables.</p>';
  }
}

// ══════════════════════════════════════
//  MARQUEUR COLORÉ
// ══════════════════════════════════════
function colorIcon(color) {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="26" height="34" viewBox="0 0 26 34">
    <path d="M13 0C5.8 0 0 5.8 0 13c0 8.8 13 21 13 21S26 21.8 26 13C26 5.8 20.2 0 13 0z" fill="${color}"/>
    <circle cx="13" cy="13" r="5" fill="white" opacity="0.85"/>
  </svg>`;
  return L.divIcon({ html: svg, className:'', iconSize:[26,34], iconAnchor:[13,34], popupAnchor:[0,-34] });
}

// ══════════════════════════════════════
//  RECHERCHE
// ══════════════════════════════════════
async function geocode(query) {
  const r = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}`);
  const d = await r.json();
  if (!d.length) throw new Error('Lieu introuvable : ' + query);
  return { lat: parseFloat(d[0].lat), lng: parseFloat(d[0].lon), name: d[0].display_name.split(',')[0] };
}

async function searchByName(cityName, lat, lng) {
  // Place le marqueur
  if (cityMarker) map.removeLayer(cityMarker);
  cityMarker = L.marker([lat, lng], { icon: colorIcon('#00f0ff') })
    .addTo(map).bindPopup(`<b>${cityName}</b>`).openPopup();
  map.setView([lat, lng], 12);

  // Pré-remplir itinéraire départ
  if (!routeFromInput.value) routeFromInput.value = cityName;

  saveHistory(cityName, lat, lng);
  loadCityInfo(cityName);
  loadWeather(lat, lng);
}

async function doSearch() {
  const q = cityInput.value.trim();
  if (!q) return;
  try {
    const { lat, lng, name } = await geocode(q);
    searchByName(name, lat, lng);
  } catch {
    alert('❌ Ville introuvable.');
  }
}

searchBtn.addEventListener('click', doSearch);
cityInput.addEventListener('keydown', e => { if (e.key === 'Enter') doSearch(); });

// ══════════════════════════════════════
//  LOCALISER
// ══════════════════════════════════════
locateBtn.addEventListener('click', () => {
  map.locate({ setView: true, maxZoom: 14 });
});

map.on('locationfound', e => {
  searchByName('Ma position', e.latlng.lat, e.latlng.lng);
});

map.on('locationerror', () => alert('❌ Géolocalisation indisponible.'));

// ══════════════════════════════════════
//  ITINÉRAIRE
// ══════════════════════════════════════
routeBtn.addEventListener('click', async () => {
  const from = routeFromInput.value.trim();
  const to   = routeToInput.value.trim();
  if (!from || !to) return alert('Renseignez un départ et une arrivée.');

  try {
    const [cFrom, cTo] = await Promise.all([geocode(from), geocode(to)]);
    if (routeControl) map.removeControl(routeControl);

    routeControl = L.Routing.control({
      waypoints: [L.latLng(cFrom.lat, cFrom.lng), L.latLng(cTo.lat, cTo.lng)],
      routeWhileDragging: true,
      lineOptions: { styles: [{ color: '#00f0ff', weight: 4, opacity: 0.85 }] },
      createMarker: () => null
    }).addTo(map);

    routeControl.on('routesfound', e => {
      const s   = e.routes[0].summary;
      const km  = (s.totalDistance / 1000).toFixed(1);
      const h   = Math.floor(s.totalTime / 3600);
      const min = Math.floor((s.totalTime % 3600) / 60);
      const dur = h > 0 ? `${h}h ${min}min` : `${min} min`;
      routeResult.innerHTML =
        `📍 <strong>${from}</strong> → <strong>${to}</strong><br>` +
        `🛣️ Distance : <strong>${km} km</strong><br>` +
        `⏱️ Durée : <strong>${dur}</strong>`;
      routeResult.classList.add('visible');
    });
  } catch (e) {
    alert('❌ ' + e.message);
  }
});

clearRouteBtn.addEventListener('click', () => {
  if (routeControl) { map.removeControl(routeControl); routeControl = null; }
  routeResult.classList.remove('visible');
});

// ══════════════════════════════════════
//  MARQUEURS PERSONNALISÉS
// ══════════════════════════════════════
function renderMarkerList() {
  markerList.innerHTML = customMarkers.map(m =>
    `<div class="marker-item">
       <div class="dot" style="background:${m.color}"></div>
       <span>${m.name}</span>
     </div>`
  ).join('');
}

map.on('click', e => {
  const lat  = e.latlng.lat.toFixed(5);
  const lng  = e.latlng.lng.toFixed(5);
  const name = prompt(`📍 Nom du lieu (${parseFloat(lat).toFixed(3)}, ${parseFloat(lng).toFixed(3)}) :`);
  if (!name) return;

  const color = COLORS[colorIdx++ % COLORS.length];
  const m = L.marker([lat, lng], { icon: colorIcon(color), draggable: true })
    .addTo(map)
    .bindPopup(`<b>${name}</b><br><small>${lat}, ${lng}</small>`);

  const entry = { marker: m, name, color };
  customMarkers.push(entry);
  renderMarkerList();

  m.on('contextmenu', () => {
    map.removeLayer(m);
    customMarkers = customMarkers.filter(x => x !== entry);
    renderMarkerList();
  });
});

clearMarkersBtn.addEventListener('click', () => {
  customMarkers.forEach(x => map.removeLayer(x.marker));
  customMarkers = [];
  renderMarkerList();
});