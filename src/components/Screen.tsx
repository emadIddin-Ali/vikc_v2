import { LinearGradient } from 'expo-linear-gradient';
import React from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { gradients, spacing } from '@/theme/tokens';

/**
 * Youth screen shell: the app's soft gradient background + safe-area top inset.
 * `scroll` wraps children in a ScrollView (default), else a plain padded View.
 */
export function Screen({
  children,
  scroll = true,
  padded = true,
}: {
  children: React.ReactNode;
  scroll?: boolean;
  padded?: boolean;
}) {
  const insets = useSafeAreaInsets();
  const pad = padded ? spacing.screen : 0;

  return (
    <View style={styles.root}>
      <LinearGradient colors={gradients.screen} style={StyleSheet.absoluteFill} />
      {scroll ? (
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{
            paddingTop: insets.top + 6,
            paddingHorizontal: pad,
            paddingBottom: 28,
          }}
        >
          {children}
        </ScrollView>
      ) : (
        <View style={{ flex: 1, paddingTop: insets.top + 6, paddingHorizontal: pad }}>
          {children}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
});
