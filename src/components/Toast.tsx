import React, { useEffect } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, font } from '@/theme/tokens';
import { useToastStore } from '@/store/toast';

/** Dark pill toast, top-center, auto-dismiss (~2.2s). Mounted once at the app root. */
export function Toast() {
  const message = useToastStore((s) => s.message);
  const hide = useToastStore((s) => s.hide);
  const insets = useSafeAreaInsets();

  useEffect(() => {
    if (!message) return;
    const t = setTimeout(hide, 2200);
    return () => clearTimeout(t);
  }, [message, hide]);

  if (!message) return null;

  return (
    <View pointerEvents="none" style={[styles.wrap, { top: insets.top + 10 }]}>
      <View style={styles.pill}>
        <Text style={styles.text}>{message}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { position: 'absolute', left: 0, right: 0, alignItems: 'center', zIndex: 100 },
  pill: {
    backgroundColor: colors.ink,
    paddingVertical: 11,
    paddingHorizontal: 18,
    borderRadius: 14,
    maxWidth: '88%',
  },
  text: { fontFamily: font.medium, fontSize: 13, color: colors.white, textAlign: 'center' },
});
