export type Coords = { lat: number; lng: number };
export type MapPickerHandle = { goTo: (c: Coords) => void };

/**
 * Leaflet-kartan som HTML-sträng — delas av `MapPicker.tsx` (WebView i appen)
 * och `MapPicker.web.tsx` (iframe i webbläsaren).
 *
 * Bron åt båda hållen är avsiktligt platt: kartan skickar `{lat,lng}` uppåt via
 * ReactNativeWebView när den finns och via `window.parent` annars, och tar emot
 * `{type:'center',lat,lng}` som ett `message`. Appen kan i stället kalla
 * `window.__center(...)` direkt med injectJavaScript — båda vägarna funkar.
 */
export function buildMapHtml(center: Coords, marker: Coords | null) {
  const initial = marker ? `place(${marker.lat}, ${marker.lng});` : '';
  return `<!DOCTYPE html><html><head>
<meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no">
<link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css"/>
<script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
<style>html,body,#map{height:100%;margin:0;padding:0;background:#e3e9ef}</style>
</head><body><div id="map"></div><script>
  var map = L.map('map',{zoomControl:true,attributionControl:false}).setView([${center.lat}, ${center.lng}], 14);
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',{maxZoom:19}).addTo(map);
  var marker = null;
  function place(lat,lng){ if(marker){ marker.setLatLng([lat,lng]); } else { marker = L.marker([lat,lng]).addTo(map); } }
  function send(lat,lng){
    var msg = JSON.stringify({lat:lat,lng:lng});
    if(window.ReactNativeWebView){ window.ReactNativeWebView.postMessage(msg); }
    else if(window.parent && window.parent !== window){ window.parent.postMessage(msg,'*'); }
  }
  map.on('click', function(e){ place(e.latlng.lat, e.latlng.lng); send(e.latlng.lat, e.latlng.lng); });
  window.__center = function(lat,lng){ map.setView([lat,lng],15); place(lat,lng); send(lat,lng); };
  window.addEventListener('message', function(e){
    try {
      var d = typeof e.data === 'string' ? JSON.parse(e.data) : e.data;
      if(d && d.type === 'center') window.__center(d.lat, d.lng);
    } catch(_) {}
  });
  ${initial}
</script></body></html>`;
}
