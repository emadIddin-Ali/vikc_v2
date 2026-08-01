import React, { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Card } from '@/components/Card';
import { Icon } from '@/components/Icon';
import { useLedareActivities, useLedareYouth, useMarkPresent } from '@/hooks/useLedare';
import { JusteraPoang } from '@/features/ledare/JusteraPoang';
import { isActivityOpenNow } from '@/lib/activity';
import type { LedareYouth } from '@/lib/types';
import { colors, font } from '@/theme/tokens';

export function Narvaro({ fid }: { fid: string }) {
  const [activityId, setActivityId] = useState<string | null>(null);
  const [visaAlla, setVisaAlla] = useState(false);
  const [justerar, setJusterar] = useState<LedareYouth | null>(null);
  const { data: activities } = useLedareActivities(fid);
  const { data: youth } = useLedareYouth(fid, activityId);
  const mark = useMarkPresent();

  // Fönstret för vad som pågår flyttar sig medan ledaren står med telefonen
  // uppe. En gång i minuten räcker — listan ska inte hinna bli osann.
  const [nu, setNu] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNu(Date.now()), 60_000);
    return () => clearInterval(t);
  }, []);

  const alla = activities ?? [];
  const pagar = alla.filter((a) => isActivityOpenNow(a, nu));
  // Pågår ingenting är en tom lista bara förvirrande — då visas allt.
  const visarAlla = visaAlla || pagar.length === 0;
  let synliga = visarAlla ? alla : pagar;
  // Den valda aktiviteten får inte försvinna under fingret när tiden går ut.
  if (activityId && !synliga.some((a) => a.id === activityId)) {
    const vald = alla.find((a) => a.id === activityId);
    if (vald) synliga = [vald, ...synliga];
  }
  const dolda = alla.length - synliga.length;

  const selected = alla.find((a) => a.id === activityId) ?? null;
  const points = selected ? selected.points : 30;

  return (
    <View>
      <Text style={styles.context}>
        Välj aktivitet och markera vilka som är på plats. +{points}p delas ut direkt. Tryck på ett
        namn för att justera poäng.
      </Text>

      {pagar.length === 0 && alla.length > 0 && (
        <Text style={styles.notis}>Inget pågår just nu — visar alla aktiviteter.</Text>
      )}

      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
        <Pressable
          onPress={() => setActivityId(null)}
          style={[styles.chip, { backgroundColor: activityId === null ? colors.ink : colors.white }]}
        >
          <Text style={[styles.chipText, { color: activityId === null ? colors.white : colors.muted }]}>Fri närvaro · +30p</Text>
        </Pressable>
        {synliga.map((a) => (
          <Pressable
            key={a.id}
            onPress={() => setActivityId(a.id)}
            style={[styles.chip, { backgroundColor: activityId === a.id ? colors.ink : colors.white }]}
          >
            <Text
              style={[styles.chipText, { color: activityId === a.id ? colors.white : colors.muted }]}
              numberOfLines={1}
            >
              {a.title} · +{a.points}p
            </Text>
          </Pressable>
        ))}
        {(dolda > 0 || (visaAlla && pagar.length > 0)) && (
          <Pressable onPress={() => setVisaAlla((v) => !v)} style={[styles.chip, styles.chipMer]}>
            <Text style={[styles.chipText, { color: colors.muted2 }]}>
              {visaAlla ? 'Bara pågående' : `Visa alla · ${dolda} till`}
            </Text>
          </Pressable>
        )}
      </ScrollView>

      {(youth ?? []).map((y) => (
        <Card key={y.user_id} style={styles.row}>
          <Pressable onPress={() => setJusterar(y)} style={styles.rowLeft} hitSlop={4}>
            <View style={[styles.avatar, { backgroundColor: y.avatar_color }]}>
              <Text style={styles.avatarText}>{y.name.charAt(0).toUpperCase()}</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.name}>{y.name}</Text>
              <Text style={styles.sub}>{y.visits} besök · {y.points}p</Text>
            </View>
          </Pressable>
          {y.present_today ? (
            <View style={[styles.markBtn, { backgroundColor: colors.tintGreen }]}>
              <Icon name="check" size={14} color={colors.green2} />
              <Text style={[styles.markText, { color: colors.green2, marginLeft: 4 }]}>+{points}p</Text>
            </View>
          ) : (
            <Pressable
              disabled={mark.isPending}
              onPress={() => mark.mutate({ forening: fid, user: y.user_id, name: y.name, activityId })}
              style={[styles.markBtn, { backgroundColor: colors.ink }]}
            >
              <Text style={[styles.markText, { color: colors.white }]}>Markera</Text>
            </Pressable>
          )}
        </Card>
      ))}

      {(youth ?? []).length === 0 && <Text style={styles.empty}>Inga ungdomar i föreningen än.</Text>}

      {justerar && (
        <JusteraPoang fid={fid} youth={justerar} onClose={() => setJusterar(null)} />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  context: { fontFamily: font.regular, fontSize: 13, color: colors.muted2, marginBottom: 8, lineHeight: 18 },
  notis: { fontFamily: font.medium, fontSize: 12, color: colors.muted2, marginBottom: 8 },
  chips: { gap: 7, paddingBottom: 12 },
  chip: { paddingVertical: 8, paddingHorizontal: 13, borderRadius: 999, maxWidth: 200 },
  chipMer: { backgroundColor: 'transparent', borderWidth: 1, borderColor: '#d9d2ec' },
  chipText: { fontFamily: font.semibold, fontSize: 12 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 12, marginTop: 11 },
  rowLeft: { flexDirection: 'row', alignItems: 'center', gap: 12, flex: 1 },
  avatar: { width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center' },
  avatarText: { fontFamily: font.semibold, fontSize: 14, color: colors.white },
  name: { fontFamily: font.semibold, fontSize: 13.5, color: colors.ink },
  sub: { fontFamily: font.regular, fontSize: 11, color: colors.muted2 },
  markBtn: { flexDirection: 'row', alignItems: 'center', paddingVertical: 9, paddingHorizontal: 14, borderRadius: 12 },
  markText: { fontFamily: font.semibold, fontSize: 12.5 },
  empty: { fontFamily: font.regular, fontSize: 12.5, color: colors.muted2, marginTop: 14 },
});
