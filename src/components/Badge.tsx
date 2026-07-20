import React from 'react';
import { StyleProp, StyleSheet, Text, View, ViewStyle } from 'react-native';
import { Card } from '@/components/Card';
import { Icon, IconName } from '@/components/Icon';
import type { BadgeRow } from '@/lib/types';
import { colors, font, radius } from '@/theme/tokens';

/** A locked secret badge reveals neither name nor how to get it. */
function hidden(b: BadgeRow) {
  return b.secret && !b.unlocked;
}

function tileColors(b: BadgeRow) {
  return b.unlocked
    ? { bg: b.tint, fg: b.color }
    : { bg: colors.adminBg, fg: colors.faint };
}

/** Icon square with a check dot once earned. */
function Tile({ badge, size }: { badge: BadgeRow; size: number }) {
  const { bg, fg } = tileColors(badge);
  return (
    <View style={[styles.tile, { width: size, height: size, backgroundColor: bg }]}>
      <Icon name={(hidden(badge) ? 'sparkles' : badge.icon) as IconName} size={size * 0.45} color={fg} />
      {badge.unlocked && (
        <View style={styles.checkDot}>
          <Icon name="check" size={11} color={colors.white} />
        </View>
      )}
    </View>
  );
}

function Bar({ badge }: { badge: BadgeRow }) {
  const pct = Math.min(100, Math.round((badge.progress / badge.goal) * 100));
  return (
    <View style={styles.track}>
      <View style={[styles.fill, { width: `${pct}%`, backgroundColor: badge.color }]} />
    </View>
  );
}

/** Compact grid cell — used on the profile strip. Parent controls the width. */
export function BadgeCell({ badge, style }: { badge: BadgeRow; style?: StyleProp<ViewStyle> }) {
  return (
    <View style={[styles.cell, style]}>
      <Tile badge={badge} size={54} />
      <Text style={[styles.cellName, !badge.unlocked && { color: colors.muted2 }]} numberOfLines={1}>
        {hidden(badge) ? '???' : badge.name}
      </Text>
      {!badge.unlocked && !hidden(badge) && badge.progress > 0 && <Bar badge={badge} />}
    </View>
  );
}

/** Full row with description + progress — used on the badge screen. */
export function BadgeListRow({ badge }: { badge: BadgeRow }) {
  const done = badge.unlocked;
  return (
    <Card style={[styles.row, !done && styles.rowLocked]}>
      <Tile badge={badge} size={48} />
      <View style={{ flex: 1 }}>
        <Text style={[styles.rowName, !done && { color: colors.muted }]} numberOfLines={1}>
          {hidden(badge) ? 'Hemligt märke' : badge.name}
        </Text>
        <Text style={styles.rowDesc} numberOfLines={2}>
          {hidden(badge) ? 'Lås upp det genom att göra något oväntat …' : badge.description}
        </Text>
        {!done && !hidden(badge) && (
          <View style={styles.rowProgress}>
            <Bar badge={badge} />
            <Text style={styles.rowCount}>
              {badge.progress}/{badge.goal}
            </Text>
          </View>
        )}
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  tile: { borderRadius: radius.md, alignItems: 'center', justifyContent: 'center' },
  checkDot: {
    position: 'absolute', right: -3, bottom: -3, width: 20, height: 20, borderRadius: 10,
    backgroundColor: colors.green, alignItems: 'center', justifyContent: 'center',
    borderWidth: 2, borderColor: colors.white,
  },

  cell: { alignItems: 'center', gap: 6 },
  cellName: { fontFamily: font.medium, fontSize: 10.5, color: colors.ink, textAlign: 'center' },

  row: { flexDirection: 'row', alignItems: 'center', gap: 13, padding: 13, marginTop: 10 },
  rowLocked: { backgroundColor: 'rgba(255,255,255,0.62)' },
  rowName: { fontFamily: font.semibold, fontSize: 14, color: colors.ink },
  rowDesc: { fontFamily: font.regular, fontSize: 11.5, color: colors.muted2, marginTop: 1, lineHeight: 15 },
  rowProgress: { flexDirection: 'row', alignItems: 'center', gap: 9, marginTop: 7 },
  rowCount: { fontFamily: font.medium, fontSize: 10.5, color: colors.muted2 },

  track: { flex: 1, height: 5, borderRadius: 4, backgroundColor: colors.tintPurple2, overflow: 'hidden', width: '100%' },
  fill: { height: 5, borderRadius: 4 },
});
