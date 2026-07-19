import React, { forwardRef, useImperativeHandle, useMemo, useRef } from 'react';
import { StyleSheet, View } from 'react-native';
import { WebView } from 'react-native-webview';

export type Coords = { lat: number; lng: number };
export type MapPickerHandle = { goTo: (c: Coords) => void };

function buildHtml(center: Coords, marker: Coords | null) {
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
  function send(lat,lng){ if(window.ReactNativeWebView){ window.ReactNativeWebView.postMessage(JSON.stringify({lat:lat,lng:lng})); } }
  map.on('click', function(e){ place(e.latlng.lat, e.latlng.lng); send(e.latlng.lat, e.latlng.lng); });
  window.__center = function(lat,lng){ map.setView([lat,lng],15); place(lat,lng); send(lat,lng); };
  ${initial}
</script></body></html>`;
}

/** Tappable OpenStreetMap (Leaflet in a WebView) — works in Expo Go, no native map SDK. */
export const MapPicker = forwardRef<MapPickerHandle, {
  center: Coords;
  value: Coords | null;
  onChange: (c: Coords) => void;
}>(({ center, value, onChange }, ref) => {
  const web = useRef<WebView>(null);
  // Build the HTML once (initial center/marker); typing elsewhere must not reload the map.
  const source = useMemo(() => ({ html: buildHtml(center, value) }), []); // eslint-disable-line react-hooks/exhaustive-deps

  useImperativeHandle(ref, () => ({
    goTo: (c) => web.current?.injectJavaScript(`window.__center(${c.lat}, ${c.lng}); true;`),
  }));

  return (
    <View style={styles.wrap}>
      <WebView
        ref={web}
        source={source}
        originWhitelist={['*']}
        style={styles.web}
        onMessage={(e) => {
          try {
            const d = JSON.parse(e.nativeEvent.data);
            if (typeof d.lat === 'number' && typeof d.lng === 'number') onChange({ lat: d.lat, lng: d.lng });
          } catch {
            /* ignore */
          }
        }}
      />
    </View>
  );
});

MapPicker.displayName = 'MapPicker';

const styles = StyleSheet.create({
  wrap: { height: 190, borderRadius: 16, overflow: 'hidden', backgroundColor: '#e3e9ef' },
  web: { flex: 1, backgroundColor: 'transparent' },
});
