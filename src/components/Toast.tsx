import React, { useEffect, useRef } from 'react';
import { Animated, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useReducedMotion } from '@/hooks/useReducedMotion';
import { haptics } from '@/lib/haptics';
import { colors, font } from '@/theme/tokens';
import { useToastStore } from '@/store/toast';

/** Dark pill toast, top-center, auto-dismiss (~2.2s). Mounted once at the app root. */
export function Toast() {
  const message = useToastStore((s) => s.message);
  const hide = useToastStore((s) => s.hide);
  const insets = useSafeAreaInsets();
  const reduced = useReducedMotion();
  const anim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!message) return;
    haptics.light();
    if (reduced) {
      anim.setValue(1);
    } else {
      anim.setValue(0);
      Animated.timing(anim, { toValue: 1, duration: 220, useNativeDriver: true }).start();
    }
    const t = setTimeout(hide, 2200);
    return () => clearTimeout(t);
  }, [message, hide, reduced, anim]);

  if (!message) return null;

  const translateY = anim.interpolate({ inputRange: [0, 1], outputRange: [-16, 0] });

  return (
    <View pointerEvents="none" style={[styles.wrap, { top: insets.top + 10 }]}>
      <Animated.View style={[styles.pill, { opacity: anim, transform: [{ translateY }] }]}>
        <Text style={styles.text}>{message}</Text>
      </Animated.View>
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
