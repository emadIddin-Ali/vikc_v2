import { LinearGradient } from 'expo-linear-gradient';
import React from 'react';
import { Animated, Easing, RefreshControl, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Mascot } from '@/components/Mascot';
import { useReducedMotion } from '@/hooks/useReducedMotion';
import { useRefreshAll } from '@/hooks/useRefreshAll';
import { colors, gradients, spacing } from '@/theme/tokens';

/**
 * Youth screen shell: the app's soft gradient background + safe-area top inset.
 * `scroll` wraps children in a ScrollView (default), else a plain padded View.
 *
 * The top inset sits on the container, not on the scroll content — with it on
 * the content the page scrolled up *behind* the status bar and the clock, which
 * read as a rendering glitch. Now the scroll area simply starts below it.
 *
 * `header` pins a node above the scroll area, so a screen title stays put
 * instead of sliding away on the first flick.
 */
export function Screen({
  children,
  scroll = true,
  padded = true,
  header,
  refreshable = true,
}: {
  children: React.ReactNode;
  scroll?: boolean;
  padded?: boolean;
  /** Stays visible while the content scrolls underneath. */
  header?: React.ReactNode;
  /** Pull down to refetch everything. Off for screens with their own gesture. */
  refreshable?: boolean;
}) {
  const insets = useSafeAreaInsets();
  const pad = padded ? spacing.screen : 0;
  const { refreshing, onRefresh } = useRefreshAll();

  return (
    <View style={[styles.root, { paddingTop: insets.top + 6 }]}>
      <LinearGradient colors={gradients.screen} style={StyleSheet.absoluteFill} />

      {header && <View style={{ paddingHorizontal: pad, paddingBottom: 8 }}>{header}</View>}

      {scroll ? (
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingHorizontal: pad, paddingBottom: insets.bottom + 28 }}
          keyboardShouldPersistTaps="handled"
          automaticallyAdjustKeyboardInsets
          refreshControl={
            refreshable ? (
              <RefreshControl
                refreshing={refreshing}
                onRefresh={onRefresh}
                tintColor={colors.primary}
                colors={[colors.primary]}
                progressBackgroundColor={colors.white}
              />
            ) : undefined
          }
        >
          {refreshing && <RefreshMascot />}
          {children}
        </ScrollView>
      ) : (
        <View style={{ flex: 1, paddingHorizontal: pad }}>{children}</View>
      )}
    </View>
  );
}

/** Gnista tumbles while the refresh runs, so the wait has something to watch. */
function RefreshMascot() {
  const reduced = useReducedMotion();
  const v = React.useRef(new Animated.Value(0)).current;

  React.useEffect(() => {
    if (reduced) return;
    const anim = Animated.loop(
      Animated.timing(v, { toValue: 1, duration: 1100, easing: Easing.linear, useNativeDriver: true }),
    );
    anim.start();
    return () => anim.stop();
  }, [reduced, v]);

  return (
    <View style={styles.refreshMascot} pointerEvents="none">
      <Animated.View
        style={{
          transform: [
            { rotate: v.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] }) },
            { scale: v.interpolate({ inputRange: [0, 0.5, 1], outputRange: [1, 1.15, 1] }) },
          ],
        }}
      >
        <Mascot size={30} eyes mouth="grin" />
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  refreshMascot: { alignItems: 'center', paddingBottom: 6 },
});
