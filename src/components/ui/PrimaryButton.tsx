import { LinearGradient } from 'expo-linear-gradient';
import React from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { useBrandGradient } from '@/hooks/useBrandGradient';
import { colors, font, radius } from '@/theme/tokens';

type Props = {
  label: string;
  onPress: () => void;
  loading?: boolean;
  disabled?: boolean;
  colorsPair?: readonly [string, string];
  textColor?: string;
};

/** Gradient CTA button (brand purple by default). */
export function PrimaryButton({
  label,
  onPress,
  loading = false,
  disabled = false,
  colorsPair,
  textColor = colors.white,
}: Props) {
  // Falls back to the förening's theme rather than a fixed purple, so a themed
  // app doesn't end up with off-brand primary buttons.
  const brand = useBrandGradient();
  const isDisabled = disabled || loading;
  return (
    <Pressable
      onPress={onPress}
      disabled={isDisabled}
      style={{ width: '100%', opacity: isDisabled ? 0.6 : 1 }}
    >
      <LinearGradient
        colors={colorsPair ?? brand}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.btn}
      >
        {loading ? (
          <ActivityIndicator color={textColor} />
        ) : (
          <View style={styles.row}>
            <Text style={[styles.label, { color: textColor }]}>{label}</Text>
          </View>
        )}
      </LinearGradient>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  btn: {
    borderRadius: radius.tile,
    paddingVertical: 15,
    alignItems: 'center',
    justifyContent: 'center',
  },
  row: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  label: { fontFamily: font.semibold, fontSize: 15 },
});
