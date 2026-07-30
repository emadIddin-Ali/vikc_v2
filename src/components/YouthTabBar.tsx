import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import React, { useEffect, useRef } from 'react';
import { Animated, Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Icon, IconName } from '@/components/Icon';
import { Tappable } from '@/components/ui/Tappable';
import { haptics } from '@/lib/haptics';
import { useReducedMotion } from '@/hooks/useReducedMotion';
import { useBrandGradient } from '@/hooks/useBrandGradient';
import { colors, radius, shadow } from '@/theme/tokens';

/** Minimal structural type — avoids depending on @react-navigation types directly. */
type TabBarProps = {
  state: { index: number; routes: { key: string; name: string }[] };
  navigation: { navigate: (name: string) => void };
};

/** Only these routes get a nav button; other youth routes (e.g. topplista) stay reachable
 *  via in-app links but are hidden from the bar. */
const ICONS: Record<string, IconName> = {
  index: 'home',
  uppdrag: 'target',
  butik: 'bag',
  profil: 'user',
};

/** Turn a hex color into an rgba string (for the soft active-tab pill). */
function hexToRgba(hex: string, alpha: number): string {
  const h = hex.replace('#', '');
  const full = h.length === 3 ? h.split('').map((c) => c + c).join('') : h;
  const r = parseInt(full.slice(0, 2), 16);
  const g = parseInt(full.slice(2, 4), 16);
  const b = parseInt(full.slice(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

export function YouthTabBar({ state, navigation }: TabBarProps) {
  const brand = useBrandGradient();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const activeName = state.routes[state.index]?.name;
  const navRoutes = state.routes.filter((r) => ICONS[r.name]);
  const mid = Math.ceil(navRoutes.length / 2);

  const accent = brand[0] ?? colors.primary;
  const pillTint = hexToRgba(accent, 0.14);

  const onTab = (name: string) => {
    if (name !== activeName) haptics.light();
    navigation.navigate(name);
  };

  const renderItem = (route: { key: string; name: string }) => (
    <TabItem
      key={route.key}
      name={ICONS[route.name]}
      active={activeName === route.name}
      accent={accent}
      pillTint={pillTint}
      onPress={() => onTab(route.name)}
    />
  );

  return (
    <View style={[styles.bar, { paddingBottom: Math.max(insets.bottom, 10) + 8 }]} accessibilityRole="tablist">
      {navRoutes.slice(0, mid).map(renderItem)}

      <Tappable
        containerStyle={styles.fabWrap}
        style={styles.fabInner}
        scale={0.9}
        onPress={() => { haptics.light(); router.push('/scan'); }}
        hitSlop={8}
      >
        <LinearGradient colors={brand} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.fab}>
          <Icon name="camera" size={24} color={colors.white} />
        </LinearGradient>
      </Tappable>

      {navRoutes.slice(mid).map(renderItem)}
    </View>
  );
}

/**
 * Smooth active-tab treatment: a brand-tinted pill springs in behind the icon,
 * the icon lifts + scales, and its color cross-fades from muted grey to the
 * brand accent. One spring value drives all of it, so it stays in sync.
 */
function TabItem({
  name, active, accent, pillTint, onPress,
}: {
  name: IconName;
  active: boolean;
  accent: string;
  pillTint: string;
  onPress: () => void;
}) {
  const reduced = useReducedMotion();
  const v = useRef(new Animated.Value(active ? 1 : 0)).current;

  useEffect(() => {
    if (reduced) {
      v.setValue(active ? 1 : 0);
      return;
    }
    const anim = Animated.spring(v, { toValue: active ? 1 : 0, friction: 7, tension: 120, useNativeDriver: true });
    anim.start();
    return () => anim.stop();
  }, [active, reduced, v]);

  const pillStyle = {
    opacity: v,
    transform: [{ scale: v.interpolate({ inputRange: [0, 1], outputRange: [0.6, 1] }) }],
  };
  const iconWrapStyle = {
    transform: [
      { translateY: v.interpolate({ inputRange: [0, 1], outputRange: [0, -3] }) },
      { scale: v.interpolate({ inputRange: [0, 1], outputRange: [1, 1.12] }) },
    ],
  };
  const inactiveOpacity = v.interpolate({ inputRange: [0, 1], outputRange: [1, 0] });

  return (
    <Pressable
      style={styles.item}
      hitSlop={8}
      onPress={onPress}
      accessibilityRole="tab"
      accessibilityState={{ selected: active }}
    >
      <View style={styles.itemInner}>
        <Animated.View style={[styles.pill, { backgroundColor: pillTint }, pillStyle]} pointerEvents="none" />
        <Animated.View style={[styles.iconWrap, iconWrapStyle]}>
          <Animated.View style={[StyleSheet.absoluteFill, styles.center, { opacity: inactiveOpacity }]}>
            <Icon name={name} size={24} color={colors.muted2} />
          </Animated.View>
          <Animated.View style={[StyleSheet.absoluteFill, styles.center, { opacity: v }]}>
            <Icon name={name} size={24} color={accent} />
          </Animated.View>
        </Animated.View>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    backgroundColor: colors.white,
    borderTopWidth: 1,
    borderTopColor: colors.navBorder,
    paddingTop: 9,
    paddingHorizontal: 12,
  },
  item: { flex: 1, alignItems: 'center', paddingVertical: 6 },
  itemInner: { width: 56, height: 36, alignItems: 'center', justifyContent: 'center' },
  pill: { ...StyleSheet.absoluteFillObject, borderRadius: 12 },
  iconWrap: { width: 24, height: 24 },
  center: { alignItems: 'center', justifyContent: 'center' },
  fabWrap: { flex: 1 },
  fabInner: { alignItems: 'center' },
  fab: {
    width: 58,
    height: 58,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: -26,
    ...shadow.hero,
  },
});
