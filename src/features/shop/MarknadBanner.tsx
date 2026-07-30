import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Icon } from '@/components/Icon';
import { dayHeading } from '@/lib/date';
import type { MarknadStatus } from '@/lib/types';
import { colors, font, radius } from '@/theme/tokens';

/**
 * Says whether the shop is open, and when it opens next.
 *
 * The whole point of a market that runs every other month is the wait — so
 * the countdown has to be visible, otherwise a locked catalog just reads as
 * broken. Renders nothing for a förening that never schedules markets; for
 * them the shop simply behaves as it always has.
 */
export function MarknadBanner({ marknad }: { marknad: MarknadStatus | null }) {
  if (!marknad?.anvander_marknad) return null;

  const oppen = marknad.oppen;
  const datum = oppen ? marknad.closes_at : marknad.opens_at;
  if (!datum) return null;

  const dag = dayHeading(new Date(datum));

  return (
    <View style={[styles.wrap, oppen ? styles.open : styles.closed]}>
      <View style={[styles.tile, { backgroundColor: oppen ? 'rgba(255,255,255,0.22)' : colors.white }]}>
        <Icon name={oppen ? 'bag' : 'calendar'} size={19} color={oppen ? colors.white : colors.primary} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={[styles.title, oppen && { color: colors.white }]}>
          {oppen ? `${marknad.namn ?? 'Marknaden'} är öppen` : `${marknad.namn ?? 'Marknaden'} öppnar ${dag}`}
        </Text>
        <Text style={[styles.body, oppen && { color: 'rgba(255,255,255,0.85)' }]}>
          {oppen
            ? `Handla innan den stänger ${dag.toLowerCase()}.`
            : 'Spara dina poäng till dess — småsaker går att köpa redan nu.'}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    borderRadius: radius.md, padding: 14, marginBottom: 4,
  },
  open: { backgroundColor: colors.green },
  closed: { backgroundColor: colors.tintPurple },
  tile: { width: 40, height: 40, borderRadius: 13, alignItems: 'center', justifyContent: 'center' },
  title: { fontFamily: font.semibold, fontSize: 14, color: colors.ink },
  body: { fontFamily: font.regular, fontSize: 11.5, color: colors.muted, marginTop: 2, lineHeight: 16 },
});
