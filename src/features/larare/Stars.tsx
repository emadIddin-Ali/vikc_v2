import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Icon } from '@/components/Icon';
import { Tappable } from '@/components/ui/Tappable';
import { colors, font } from '@/theme/tokens';

const LEVELS = [1, 2, 3, 4, 5];

/**
 * The 1–5 star control. Tapping the star you already gave clears the grade —
 * without that the teacher would have no way back once a row was set.
 */
export function StarPicker({
  value,
  onChange,
  size = 26,
  disabled = false,
}: {
  value: number;
  onChange: (stars: number) => void;
  size?: number;
  disabled?: boolean;
}) {
  return (
    <View style={styles.row}>
      {LEVELS.map((n) => (
        <Tappable
          key={n}
          scale={0.82}
          hitSlop={4}
          disabled={disabled}
          onPress={() => onChange(n === value ? 0 : n)}
          accessibilityRole="button"
          accessibilityLabel={`${n} stjärnor`}
          accessibilityState={{ selected: n <= value }}
        >
          <Icon
            name={n <= value ? 'star' : 'starO'}
            size={size}
            color={n <= value ? colors.gold : colors.faint}
            opacity={disabled ? 0.4 : 1}
          />
        </Tappable>
      ))}
    </View>
  );
}

/** Read-only star row for history and summaries. */
export function StarRow({ value, size = 14 }: { value: number; size?: number }) {
  return (
    <View style={styles.rowTight}>
      {LEVELS.map((n) => (
        <Icon key={n} name={n <= value ? 'star' : 'starO'} size={size}
          color={n <= value ? colors.gold : colors.faint} />
      ))}
    </View>
  );
}

/** Compact "12★" badge used on class cards. */
export function StarCount({ value, tint = colors.tintYellow }: { value: number; tint?: string }) {
  return (
    <View style={[styles.count, { backgroundColor: tint }]}>
      <Icon name="star" size={13} color={colors.gold} />
      <Text style={styles.countText}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: 6 },
  rowTight: { flexDirection: 'row', gap: 2 },
  count: { flexDirection: 'row', alignItems: 'center', gap: 4, borderRadius: 999, paddingVertical: 4, paddingHorizontal: 9 },
  countText: { fontFamily: font.bold, fontSize: 12, color: colors.ink },
});
