import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Icon, IconName } from '@/components/Icon';
import { colors, gradients, radius, shadow } from '@/theme/tokens';

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

export function YouthTabBar({ state, navigation }: TabBarProps) {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const activeName = state.routes[state.index]?.name;
  const navRoutes = state.routes.filter((r) => ICONS[r.name]);
  const mid = Math.ceil(navRoutes.length / 2);

  const renderItem = (route: { key: string; name: string }) => (
    <Pressable key={route.key} onPress={() => navigation.navigate(route.name)} style={styles.item} hitSlop={8}>
      <Icon name={ICONS[route.name]} size={24} color={colors.ink} opacity={activeName === route.name ? 1 : 0.4} />
    </Pressable>
  );

  return (
    <View style={[styles.bar, { paddingBottom: Math.max(insets.bottom, 10) + 8 }]}>
      {navRoutes.slice(0, mid).map(renderItem)}

      <Pressable style={styles.fabWrap} onPress={() => router.push('/scan')} hitSlop={8}>
        <LinearGradient colors={gradients.brand} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.fab}>
          <Icon name="camera" size={24} color={colors.white} />
        </LinearGradient>
      </Pressable>

      {navRoutes.slice(mid).map(renderItem)}
    </View>
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
  fabWrap: { flex: 1, alignItems: 'center' },
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
