import { LinearGradient } from 'expo-linear-gradient';
import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Card } from '@/components/Card';
import { Icon } from '@/components/Icon';
import { Screen } from '@/components/Screen';
import { useClaimMission, useMissions } from '@/hooks/useMissions';
import { ICON_TINT, colors, font, gradients, radius } from '@/theme/tokens';
import { useAuth } from '@/providers/AuthProvider';

export default function Uppdrag() {
  const { activeMembership, session } = useAuth();
  const fid = activeMembership?.forening_id ?? null;
  const { data } = useMissions(fid, session?.user.id);
  const claim = useClaimMission();

  const missions = data?.missions ?? [];
  const weekDays = Math.min(data?.streak ?? 0, 3);
  const weekPct = Math.round((weekDays / 3) * 100);

  return (
    <Screen>
      <Text style={styles.h1}>Uppdrag</Text>
      <Text style={styles.intro}>
        Utmaningar du löser in för XP. Klara målet → tryck <Text style={styles.introB}>Lös in</Text>. Vissa räknas upp automatiskt när du checkar in.
      </Text>

      <LinearGradient colors={gradients.weekly} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.weekly}>
        <Text style={styles.weeklyKicker}>VECKANS UTMANING</Text>
        <Text style={styles.weeklyTitle}>Besök 3 dagar i rad</Text>
        <View style={styles.weeklyTrack}>
          <View style={[styles.weeklyFill, { width: `${weekPct}%` }]} />
        </View>
        <Text style={styles.weeklyMeta}>{weekDays} / 3 dagar · vinst: 200 poäng</Text>
      </LinearGradient>

      {missions.map((m) => {
        const prog = m.mission_progress?.[0];
        const progress = prog?.progress ?? 0;
        const done = prog?.done ?? false;
        const ready = progress >= m.goal && !done;
        const pct = Math.min(100, Math.round((progress / m.goal) * 100));
        const tint = ICON_TINT[m.icon] ?? colors.primary;

        return (
          <Card key={m.id} style={styles.card}>
            <View style={styles.cardTop}>
              <View style={[styles.tile, { backgroundColor: m.tint }]}>
                <Icon name={m.icon as any} size={23} color={tint} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.title}>{m.title}</Text>
                {!!m.description && <Text style={styles.desc}>{m.description}</Text>}
              </View>
            </View>

            <View style={styles.progRow}>
              <View style={styles.progTrack}>
                <View style={[styles.progFill, { width: `${pct}%`, backgroundColor: tint }]} />
              </View>
              <Text style={styles.progText}>{done ? 'Klart' : `${progress}/${m.goal}`}</Text>
            </View>

            {done ? (
              <View style={[styles.btn, { backgroundColor: colors.tintPurple2 }]}>
                <Text style={[styles.btnText, { color: colors.muted2 }]}>✓ Inlöst</Text>
              </View>
            ) : ready ? (
              <Pressable disabled={claim.isPending} onPress={() => claim.mutate(m.id)}>
                <LinearGradient colors={gradients.success} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.btn}>
                  <Text style={[styles.btnText, { color: colors.white }]}>Lös in +{m.xp} XP</Text>
                </LinearGradient>
              </Pressable>
            ) : (
              <View style={[styles.btn, { backgroundColor: '#f4f2fb' }]}>
                <Text style={[styles.btnText, { color: colors.muted2 }]}>Pågår ({progress}/{m.goal})</Text>
              </View>
            )}
          </Card>
        );
      })}
    </Screen>
  );
}

const styles = StyleSheet.create({
  h1: { fontFamily: font.bold, fontSize: 22, color: colors.ink },
  intro: { fontFamily: font.regular, fontSize: 12.5, color: colors.muted2, marginTop: 4, lineHeight: 17 },
  introB: { fontFamily: font.semibold, color: colors.primary },
  weekly: { marginTop: 14, padding: 16, borderRadius: radius.card },
  weeklyKicker: { fontFamily: font.medium, fontSize: 11.5, color: 'rgba(255,255,255,0.92)', letterSpacing: 0.4 },
  weeklyTitle: { fontFamily: font.bold, fontSize: 18, color: colors.white, marginTop: 2 },
  weeklyTrack: { marginTop: 12, height: 11, borderRadius: 8, backgroundColor: 'rgba(255,255,255,0.3)', overflow: 'hidden' },
  weeklyFill: { height: 11, borderRadius: 8, backgroundColor: colors.white },
  weeklyMeta: { fontFamily: font.regular, fontSize: 11.5, color: 'rgba(255,255,255,0.92)', marginTop: 6 },

  card: { marginTop: 13, padding: 15 },
  cardTop: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  tile: { width: 46, height: 46, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  title: { fontFamily: font.semibold, fontSize: 14, color: colors.ink },
  desc: { fontFamily: font.regular, fontSize: 11.5, color: colors.muted2 },

  progRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 12 },
  progTrack: { flex: 1, height: 9, borderRadius: 6, backgroundColor: colors.tintPurple2, overflow: 'hidden' },
  progFill: { height: 9, borderRadius: 6 },
  progText: { fontFamily: font.medium, fontSize: 11, color: colors.muted2 },

  btn: { marginTop: 12, paddingVertical: 10, borderRadius: 13, alignItems: 'center', justifyContent: 'center' },
  btnText: { fontFamily: font.semibold, fontSize: 13 },
});
