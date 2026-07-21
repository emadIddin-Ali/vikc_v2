import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import React, { useEffect, useRef } from 'react';
import { Animated, Pressable, StyleSheet, Text, View } from 'react-native';
import { Card } from '@/components/Card';
import { Icon } from '@/components/Icon';
import { Floaty } from '@/components/Floaty';
import { Mascot } from '@/components/Mascot';
import { Screen } from '@/components/Screen';
import { EmptyState } from '@/components/ui/EmptyState';
import { CountUp } from '@/components/ui/CountUp';
import { FadeIn } from '@/components/ui/FadeIn';
import { Tappable } from '@/components/ui/Tappable';
import { useHomeData } from '@/hooks/useHomeData';
import { useReducedMotion } from '@/hooks/useReducedMotion';
import { fmtDateTime } from '@/lib/date';
import { homePep, isToday } from '@/lib/pep';
import {
  ICON_TINT, XP_MAX, activityTheme, colors, font, gradients, greetingForNow, levelName, radius, shadow, relativeDate,
} from '@/theme/tokens';
import { useAuth } from '@/providers/AuthProvider';

export default function Hem() {
  const router = useRouter();
  const { profile, activeMembership, session } = useAuth();

  const forening = activeMembership?.forening;
  const foreningId = activeMembership?.forening_id ?? null;
  const { data } = useHomeData(foreningId, session?.user.id);

  // Fresh DB stats when available, else the context snapshot.
  const stats = data?.membership ?? activeMembership;
  const level = stats?.level ?? 1;
  const xp = stats?.xp ?? 0;
  const points = stats?.points ?? 0;
  const streak = stats?.streak ?? 0;
  const xpPct = Math.min(100, Math.round((xp / XP_MAX) * 100));
  const xpLeft = Math.max(0, XP_MAX - xp);

  const rawName = profile?.display_name?.trim() || session?.user?.email?.split('@')[0] || 'Polare';
  const name = rawName.split(' ')[0];

  const missions = data?.missions ?? [];
  const recent = data?.recent ?? [];
  const activities = data?.activities ?? [];
  const unread = data?.unreadCount ?? 0;
  const visits = stats?.visits ?? 0;

  const pep = homePep({ visits, streak, checkedInToday: isToday(recent[0]?.created_at) });

  const reduced = useReducedMotion();
  const xpAnim = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (reduced) {
      xpAnim.setValue(xpPct);
      return;
    }
    Animated.timing(xpAnim, { toValue: xpPct, duration: 700, useNativeDriver: false }).start();
  }, [xpPct, reduced, xpAnim]);
  const xpWidth = xpAnim.interpolate({ inputRange: [0, 100], outputRange: ['0%', '100%'] });

  return (
    <Screen>
      {/* Header */}
      <View style={styles.header}>
        <View style={{ flexShrink: 1 }}>
          <Text style={styles.greeting}>{greetingForNow()}</Text>
          <Text style={styles.name}>{name}</Text>
        </View>
        <View style={styles.headerRight}>
          <Tappable style={styles.bell} scale={0.88} hitSlop={6} onPress={() => router.push('/ungdom/topplista')}>
            <Icon name="trophy" size={20} color="#ff9500" />
          </Tappable>
          <Tappable style={styles.bell} scale={0.88} hitSlop={6} onPress={() => router.push('/ungdom/notiser')}>
            <Icon name="bell" size={20} color={colors.primary} />
            {unread > 0 && (
              <View style={styles.badge}>
                <Text style={styles.badgeText}>{unread}</Text>
              </View>
            )}
          </Tappable>
          {/* A flame next to a 0 rewards nothing. Show it once there's a streak. */}
          {streak > 0 && (
            <View style={styles.streak}>
              <Icon name="fire" size={17} color={colors.orange} />
              <Text style={styles.streakText}>{streak}</Text>
            </View>
          )}
        </View>
      </View>

      {/* Level card — the screen's one call to action. Says whether you've been
          here today, and takes you to the scanner when you haven't. */}
      <Tappable disabled={!pep.action} scale={0.985} onPress={() => router.push('/scan')}>
        <LinearGradient
          colors={gradients.brand}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.levelCard}
        >
          <View style={styles.mascot} pointerEvents="none">
            <Floaty>
              <Mascot size={86} mouth={pep.action ? 'smile' : 'grin'} />
            </Floaty>
          </View>
          <Text style={styles.levelKicker}>NIVÅ {level} · {levelName(level)}</Text>
          <Text style={styles.pep}>{pep.line}</Text>
          <Text style={styles.pepHint}>{pep.hint}</Text>

          <View style={styles.xpTrack}>
            <Animated.View style={[styles.xpFill, { width: xpWidth }]} />
          </View>
          <Text style={styles.xpLeft}>{xpLeft} XP till nivå {level + 1}</Text>

          {!!pep.action && (
            <View style={styles.pepCta}>
              <Icon name="camera" size={15} color={colors.ink} />
              <Text style={styles.pepCtaText}>{pep.action}</Text>
            </View>
          )}
        </LinearGradient>
      </Tappable>

      {/* Points + Rewards CTA */}
      <View style={styles.duo}>
        <Card style={styles.duoCard}>
          <Text style={styles.duoLabel}>Poäng</Text>
          <View style={styles.duoValueRow}>
            <Icon name="coin" size={17} color={colors.primary} />
            <CountUp value={points} style={styles.points} />
          </View>
        </Card>

        <Tappable containerStyle={{ flex: 1 }} style={[styles.duoCard, styles.rewardsCta]} onPress={() => router.push('/ungdom/butik')}>
          <Text style={styles.rewardsLabel}>Belöningar</Text>
          <View style={styles.duoValueRow}>
            <Icon name="gift" size={16} color={colors.white} />
            <Text style={styles.rewardsText}>Byt poäng</Text>
          </View>
        </Tappable>
      </View>

      {/* Dagens uppdrag */}
      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>Dagens uppdrag</Text>
        <Pressable onPress={() => router.push('/ungdom/uppdrag')} hitSlop={6}>
          <Text style={styles.seeAll}>Se alla</Text>
        </Pressable>
      </View>

      {missions.length === 0 ? (
        <EmptyState icon="target" title="Inga uppdrag just nu" body="Ledarna lägger upp nya uppdrag här. Du samlar XP på dem vid sidan av incheckningarna." />
      ) : (
        missions.map((m, i) => (
          <Tappable key={m.id} onPress={() => router.push('/ungdom/uppdrag')}>
            <Card style={styles.missionRow}>
              <View style={[styles.missionTile, { backgroundColor: m.tint }]}>
                <Icon name={m.icon as any} size={22} color={ICON_TINT[m.icon] ?? colors.primary} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.missionTitle}>{m.title}</Text>
                {!!m.description && <Text style={styles.missionDesc}>{m.description}</Text>}
              </View>
              <Text style={styles.missionXp}>+{m.xp} XP</Text>
            </Card>
          </Tappable>
        ))
      )}

      {/* Kommande aktiviteter */}
      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>Kommande aktiviteter</Text>
        <Text style={styles.sectionHint}>Checka in för poäng</Text>
      </View>
      {activities.length === 0 ? (
        <EmptyState icon="calendar" title="Inget uppsatt än" body="Kommande aktiviteter dyker upp här. Du kan checka in på gården ändå." />
      ) : (
        activities.map((a, i) => {
          const t = activityTheme(a.theme);
          const when = a.continuous
            ? 'Alltid öppen'
            : a.starts_at
              ? fmtDateTime(new Date(a.starts_at))
              : a.when_text || 'Tid ej satt';
          return (
            <FadeIn key={a.id} index={i}>
            <Tappable onPress={() => router.push('/scan')}>
              <Card style={styles.actRow}>
                <View style={[styles.actTile, { backgroundColor: t.bg[0] }]}>
                  <Icon name={t.icon as any} size={20} color={t.accent} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.actTitle}>{a.title}</Text>
                  <Text style={styles.actWhen}>{when}</Text>
                </View>
                <Text style={styles.actPts}>+{a.points}</Text>
              </Card>
            </Tappable>
            </FadeIn>
          );
        })
      )}

      {/* Senaste besök */}
      <Text style={[styles.sectionTitle, { marginTop: 18 }]}>Senaste besök</Text>
      {recent.length === 0 ? (
        <EmptyState icon="pin" title="Inga besök än" body="Dina incheckningar hamnar här, med poängen du fick för varje." />
      ) : (
        recent.map((r) => (
          <View key={r.id} style={styles.visitRow}>
            <View style={styles.visitTile}>
              <Icon name="pin" size={16} color={colors.primary} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.visitTitle}>{r.title ?? 'Incheckning'}</Text>
              <Text style={styles.visitDate}>{relativeDate(r.created_at)}</Text>
            </View>
            <Text style={styles.visitPts}>+{r.awarded_points}</Text>
          </View>
        ))
      )}

      {!!forening && <Text style={styles.foreningTag}>{forening.name}</Text>}
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingTop: 6 },
  greeting: { fontFamily: font.medium, fontSize: 12.5, color: colors.muted },
  name: { fontFamily: font.bold, fontSize: 20, color: colors.ink },
  headerRight: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  bell: {
    width: 40, height: 40, borderRadius: 14, backgroundColor: colors.white,
    alignItems: 'center', justifyContent: 'center', ...shadow.soft,
  },
  badge: {
    position: 'absolute', top: 6, right: 6, minWidth: 16, height: 16, paddingHorizontal: 4,
    backgroundColor: colors.pink, borderRadius: 8, borderWidth: 2, borderColor: colors.white,
    alignItems: 'center', justifyContent: 'center',
  },
  badgeText: { fontFamily: font.bold, fontSize: 9, color: colors.white },
  streak: {
    flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: colors.white,
    paddingHorizontal: 12, paddingVertical: 8, borderRadius: 22, ...shadow.soft,
  },
  streakText: { fontFamily: font.semibold, fontSize: 14, color: colors.orange },

  levelCard: {
    marginTop: 16, borderRadius: radius.hero, paddingTop: 18, paddingHorizontal: 16, paddingBottom: 16,
    overflow: 'hidden', ...shadow.hero,
  },
  mascot: { position: 'absolute', right: 10, bottom: -6 },
  levelKicker: { fontFamily: font.medium, fontSize: 12, color: 'rgba(255,255,255,0.85)', letterSpacing: 0.6 },
  pep: { fontFamily: font.bold, fontSize: 27, lineHeight: 30, color: colors.white, maxWidth: 178, marginTop: 4 },
  pepHint: {
    fontFamily: font.medium, fontSize: 12, lineHeight: 16.5,
    color: 'rgba(255,255,255,0.88)', maxWidth: 185, marginTop: 6,
  },
  pepCta: {
    flexDirection: 'row', alignItems: 'center', gap: 7, alignSelf: 'flex-start',
    marginTop: 13, backgroundColor: colors.gold, borderRadius: radius.pill,
    paddingVertical: 9, paddingHorizontal: 15,
  },
  pepCtaText: { fontFamily: font.bold, fontSize: 13.5, color: colors.ink },
  xpTrack: {
    marginTop: 16, height: 12, borderRadius: 8, backgroundColor: 'rgba(255,255,255,0.28)',
    maxWidth: 185, overflow: 'hidden',
  },
  xpFill: { height: 12, borderRadius: 8, backgroundColor: colors.gold },
  xpLeft: { fontFamily: font.regular, fontSize: 11.5, color: 'rgba(255,255,255,0.92)', marginTop: 7 },

  duo: { flexDirection: 'row', gap: 12, marginTop: 14 },
  duoCard: { flex: 1, padding: 14 },
  duoLabel: { fontFamily: font.medium, fontSize: 11, color: colors.muted2 },
  duoValueRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 3 },
  points: { fontFamily: font.bold, fontSize: 22, color: colors.primary },
  rewardsCta: {
    backgroundColor: colors.green, borderRadius: radius.card,
    shadowColor: colors.green, shadowOpacity: 0.35, shadowRadius: 14, shadowOffset: { width: 0, height: 10 }, elevation: 5,
  },
  rewardsLabel: { fontFamily: font.medium, fontSize: 11, color: 'rgba(255,255,255,0.92)' },
  rewardsText: { fontFamily: font.semibold, fontSize: 15, color: colors.white },

  sectionHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 18 },
  sectionTitle: { fontFamily: font.semibold, fontSize: 14, color: colors.ink },
  seeAll: { fontFamily: font.medium, fontSize: 12, color: colors.primary },

  missionRow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 11, paddingVertical: 13, paddingHorizontal: 14 },
  missionTile: { width: 44, height: 44, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  missionTitle: { fontFamily: font.semibold, fontSize: 13.5, color: colors.ink },
  missionDesc: { fontFamily: font.regular, fontSize: 11.5, color: colors.muted2 },
  missionXp: { fontFamily: font.bold, fontSize: 12, color: colors.green },
  sectionHint: { fontFamily: font.regular, fontSize: 11, color: colors.muted2 },
  actRow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 11, paddingVertical: 12, paddingHorizontal: 14 },
  actTile: { width: 40, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  actTitle: { fontFamily: font.semibold, fontSize: 13.5, color: colors.ink },
  actWhen: { fontFamily: font.regular, fontSize: 11.5, color: colors.muted2 },
  actPts: { fontFamily: font.bold, fontSize: 13, color: colors.primary },

  visitRow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 11, paddingHorizontal: 2 },
  visitTile: { width: 36, height: 36, borderRadius: 11, backgroundColor: colors.tintPurple2, alignItems: 'center', justifyContent: 'center' },
  visitTitle: { fontFamily: font.semibold, fontSize: 13, color: colors.ink },
  visitDate: { fontFamily: font.regular, fontSize: 11, color: colors.muted2 },
  visitPts: { fontFamily: font.bold, fontSize: 12.5, color: colors.primary },
  foreningTag: { fontFamily: font.medium, fontSize: 11, color: colors.faint, textAlign: 'center', marginTop: 22 },
});
