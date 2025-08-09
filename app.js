const API_BASE = 'http://localhost:8080';

const API = (path)=> fetch(`${API_BASE}${path}`).then(r=>r.json());

// Map init
const map = new maplibregl.Map({
  container: 'map',
  style: {
    version: 8,
    sources: {
      osm: {
        type: 'raster',
        tiles: ['https://a.tile.openstreetmap.org/{z}/{x}/{y}.png'],
        tileSize: 256,
        attribution: '© OpenStreetMap contributors'
      }
    },
    layers: [{ id:'osm', type:'raster', source:'osm' }]
  },
  center: [46.6753, 24.7136],
  zoom: 10
});

function badge(text, cls=''){ return `<span class="badge ${cls}">${text}</span>`; }

async function refreshStatus(){
  try {
    const s = await API('/status');
    document.getElementById('sysStatus').textContent = `ملفات اليوم: ${s.pointsFiles} | مناديب حيّة: ${s.liveAgents}`;
  } catch {
    document.getElementById('sysStatus').textContent = 'تعذّر الاتصال';
  }
}
refreshStatus(); setInterval(refreshStatus, 5000);

let liveMarkers = {};

async function refreshLive(){
  const data = await API('/api/agents/live');
  const list = document.getElementById('agents');
  list.innerHTML = '';
  const bounds = new maplibregl.LngLatBounds();

  data.data.forEach(row=>{
    const spd = row.speed_kmh ?? 0;
    const status = spd >= 3 ? 'green' : 'gray';
    const li = document.createElement('li');
    li.className = 'agent';
    li.innerHTML = `<div><b>${row.agent_id}</b> ${badge(`${spd?.toFixed(1)||0} كم/س`, status)} ${badge(`🔋${row.battery ?? '—'}%`)}</div>
      <div style="font-size:12px;opacity:.8">آخر تحديث: ${row.ts}</div>`;
    list.appendChild(li);

    const key = row.agent_id;
    if (liveMarkers[key]) liveMarkers[key].remove();
    const el = document.createElement('div');
    el.style.cssText='width:12px;height:12px;background:#0bf;border:2px solid #fff;border-radius:50%';
    const mk = new maplibregl.Marker(el).setLngLat([row.lon,row.lat]).addTo(map);
    liveMarkers[key] = mk;
    bounds.extend([row.lon,row.lat]);
  });
  if (data.data.length) map.fitBounds(bounds, { padding: 80, maxZoom: 14 });
}
document.getElementById('refreshLive').onclick = refreshLive;
setInterval(refreshLive, 5000);

// Playback
document.getElementById('play').onclick = async ()=>{
  const agent = document.getElementById('agentId').value || 'A1';
  const from = document.getElementById('from').value;
  const to = document.getElementById('to').value;
  const smooth = document.getElementById('smooth').value || 'ma';
  if (!from || !to){ alert('اختر بداية ونهاية'); return; }

  const qs = new URLSearchParams({ from, to, smooth, format:'geojson' }).toString();
  const geo = await API(`/api/agents/${agent}/track?${qs}`);

  if (map.getSource('track')) {
    map.getSource('track').setData(geo);
  } else {
    map.addSource('track',{ type:'geojson', data: geo });
    map.addLayer({ id:'track-line', type:'line', source:'track', paint:{ 'line-width': 4, 'line-color': '#00b7ff' } });
  }
  // fit bounds
  const coords = geo.features[0]?.geometry?.coordinates || [];
  if (coords.length){
    const b = coords.reduce((acc,c)=> acc.extend(c), new maplibregl.LngLatBounds(coords[0], coords[0]));
    map.fitBounds(b, { padding: 60 });
  } else {
    alert('لا توجد نقاط ضمن المدى المحدد');
  }
};
