import React, { forwardRef, useImperativeHandle, useMemo, useRef } from 'react';
import { StyleSheet, View } from 'react-native';
import { WebView } from 'react-native-webview';
import { buildMapHtml, type Coords, type MapPickerHandle } from '@/components/mapHtml';

export type { Coords, MapPickerHandle };

/** Tappable OpenStreetMap (Leaflet in a WebView) — works in Expo Go, no native map SDK. */
export const MapPicker = forwardRef<MapPickerHandle, {
  center: Coords;
  value: Coords | null;
  onChange: (c: Coords) => void;
}>(({ center, value, onChange }, ref) => {
  const web = useRef<WebView>(null);
  // Build the HTML once (initial center/marker); typing elsewhere must not reload the map.
  const source = useMemo(() => ({ html: buildMapHtml(center, value) }), []); // eslint-disable-line react-hooks/exhaustive-deps

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
