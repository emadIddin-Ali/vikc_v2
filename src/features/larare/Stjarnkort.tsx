import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Alert } from '@/lib/alert';
import { Card } from '@/components/Card';
import { StarCount, StarRow } from '@/features/larare/Stars';
import { useElevKlasser, useElevStjarnor, useNekaKlassplacering } from '@/hooks/useLarare';
import { categoryLabel, klassWhen } from '@/lib/stars';
import { colors, font, radius, relativeDate } from '@/theme/tokens';

/**
 * The student's (or a parent's child's) classes and star history.
 *
 * Renders nothing when there are no classes, so a förening that doesn't use
 * the teacher role never sees an empty section it can't explain.
 */
export function Stjarnkort({
  childId = null,
  title = 'Min klass',
}: {
  /** Set for the parent view; omit for the signed-in student's own classes. */
  childId?: string | null;
  title?: string;
}) {
  const { data: klasser } = useElevKlasser(true, childId);
  const { data: stjarnor } = useElevStjarnor(true, { childId });
  const neka = useNekaKlassplacering();

  if ((klasser ?? []).length === 0) return null;

  const senaste = (stjarnor ?? []).filter((s) => !s.angrad).slice(0, 5);
  const veckan = (klasser ?? []).reduce((sum, k) => sum + k.stjarnor_veckan, 0);

  const onNeka = (id: string, namn: string) => {
    Alert.alert(
      'Ta bort placeringen',
      `Är du inte med i ${namn}? Läraren får veta och du tas bort ur klassen.`,
      [
        { text: 'Avbryt', style: 'cancel' },
        { text: 'Ta bort mig', style: 'destructive', onPress: () => neka.mutate(id) },
      ],
    );
  };

  return (
    <View>
      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>{title}</Text>
        <StarCount value={veckan} />
      </View>

      {(klasser ?? []).map((k) => (
        <Card key={k.klass_elev_id} style={styles.klassCard}>
          <View style={[styles.dot, { backgroundColor: k.color }]} />
          <View style={{ flex: 1 }}>
            <Text style={styles.klassName}>{k.name}</Text>
            <Text style={styles.klassMeta}>
              {k.larare} · {klassWhen(k.weekday, k.time_text)}
            </Text>
            <Pressable onPress={() => onNeka(k.klass_elev_id, k.name)} hitSlop={6}>
              <Text style={styles.neka}>Det stämmer inte</Text>
            </Pressable>
          </View>
          <View style={{ alignItems: 'flex-end' }}>
            <Text style={styles.klassStars}>{k.stjarnor_veckan}★</Text>
            <Text style={styles.klassStarsLabel}>i veckan</Text>
          </View>
        </Card>
      ))}

      {senaste.length > 0 && (
        <>
          <Text style={styles.subTitle}>Senaste stjärnorna</Text>
          {senaste.map((s) => (
            <View key={s.id} style={styles.histRow}>
              <View style={{ flex: 1 }}>
                <View style={styles.histTop}>
                  <StarRow value={s.stars} />
                  <Text style={styles.histCat}>{categoryLabel(s.kategori)}</Text>
                </View>
                <Text style={styles.histMeta}>
                  {s.larare} · {relativeDate(s.created_at)}
                </Text>
                {!!s.note && <Text style={styles.histNote}>{s.note}</Text>}
              </View>
              <Text style={styles.histXp}>+{s.xp} XP</Text>
            </View>
          ))}
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  sectionHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 20 },
  sectionTitle: { fontFamily: font.bold, fontSize: 16, color: colors.ink },

  klassCard: { flexDirection: 'row', alignItems: 'center', gap: 11, marginTop: 11, padding: 13 },
  dot: { width: 9, height: 42, borderRadius: 5 },
  klassName: { fontFamily: font.semibold, fontSize: 14.5, color: colors.ink },
  klassMeta: { fontFamily: font.regular, fontSize: 11.5, color: colors.muted2, marginTop: 2 },
  neka: { fontFamily: font.medium, fontSize: 10.5, color: colors.faint, marginTop: 4 },
  klassStars: { fontFamily: font.bold, fontSize: 16, color: colors.ink },
  klassStarsLabel: { fontFamily: font.regular, fontSize: 10, color: colors.muted2 },

  subTitle: { fontFamily: font.semibold, fontSize: 13.5, color: colors.ink, marginTop: 16 },
  histRow: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 10, marginTop: 9,
    backgroundColor: colors.white, borderRadius: radius.md, padding: 12,
  },
  histTop: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  histCat: { fontFamily: font.semibold, fontSize: 12.5, color: colors.ink },
  histMeta: { fontFamily: font.regular, fontSize: 11, color: colors.muted2, marginTop: 3 },
  histNote: { fontFamily: font.regular, fontSize: 12, color: colors.ink, marginTop: 4, lineHeight: 16 },
  histXp: { fontFamily: font.bold, fontSize: 12.5, color: colors.primary },
});
