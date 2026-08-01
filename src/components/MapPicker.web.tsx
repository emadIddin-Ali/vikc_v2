import React, { forwardRef, useEffect, useImperativeHandle, useMemo, useRef } from 'react';
import { StyleSheet, View } from 'react-native';
import { buildMapHtml, type Coords, type MapPickerHandle } from '@/components/mapHtml';

export type { Coords, MapPickerHandle };

/**
 * Kartan i webbläsaren.
 *
 * `react-native-webview` har ingen webbimplementation — den renderar bara röd
 * text om att plattformen inte stöds, vilket är exakt vad ledaren såg där
 * kartan skulle ligga. Metro plockar den här filen på webben, och en iframe gör
 * samma jobb som WebView:en: samma Leaflet-karta, samma klick-för-att-placera.
 *
 * Sandlådan står på `allow-scripts` — kartan får köra sin JS men inte nå appens
 * DOM eller sessionslagring, och koden kommer ändå från oss (srcDoc).
 */
export const MapPicker = forwardRef<MapPickerHandle, {
  center: Coords;
  value: Coords | null;
  onChange: (c: Coords) => void;
}>(({ center, value, onChange }, ref) => {
  const frame = useRef<HTMLIFrameElement>(null);
  // Byggs en gång (start-läge/markör); skrivande i formuläret får inte ladda om kartan.
  const html = useMemo(() => buildMapHtml(center, value), []); // eslint-disable-line react-hooks/exhaustive-deps

  // Lyssnaren sätts upp en gång, så den läser onChange via en ref i stället för
  // att kopplas om varje gång föräldern renderar med en ny funktion.
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;

  useEffect(() => {
    const handle = (e: MessageEvent) => {
      // Släpp bara igenom vår egen iframe — sidan får meddelanden från annat håll.
      if (!frame.current || e.source !== frame.current.contentWindow) return;
      try {
        const d = typeof e.data === 'string' ? JSON.parse(e.data) : e.data;
        if (typeof d?.lat === 'number' && typeof d?.lng === 'number') {
          onChangeRef.current({ lat: d.lat, lng: d.lng });
        }
      } catch {
        /* ignore */
      }
    };
    window.addEventListener('message', handle);
    return () => window.removeEventListener('message', handle);
  }, []);

  useImperativeHandle(ref, () => ({
    goTo: (c) =>
      frame.current?.contentWindow?.postMessage(
        JSON.stringify({ type: 'center', lat: c.lat, lng: c.lng }),
        '*',
      ),
  }));

  return (
    <View style={styles.wrap}>
      <iframe
        ref={frame}
        srcDoc={html}
        title="Karta — klicka för att välja incheckningsplats"
        sandbox="allow-scripts"
        style={{ border: 0, width: '100%', height: '100%', display: 'block' }}
      />
    </View>
  );
});

MapPicker.displayName = 'MapPicker';

const styles = StyleSheet.create({
  wrap: { height: 190, borderRadius: 16, overflow: 'hidden', backgroundColor: '#e3e9ef' },
});
