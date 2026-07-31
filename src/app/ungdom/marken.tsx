import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { BadgeListRow } from '@/components/Badge';
import { Icon } from '@/components/Icon';
import { Screen } from '@/components/Screen';
import { EmptyState } from '@/components/ui/EmptyState';
import { FadeIn } from '@/components/ui/FadeIn';
import { Tappable } from '@/components/ui/Tappable';
import { groupBadges, useProfileData } from '@/hooks/useProfile';
import { useBrandGradient } from '@/hooks/useBrandGradient';
import { colors, font, radius, shadow } from '@/theme/tokens';
import { useAuth } from '@/providers/AuthProvider';

export default function Marken() {
  const brand = useBrandGradient();
  const router = useRouter();
  const { session, activeMembership } = useAuth();
  const { data, isLoading } = useProfileData(activeMembership?.forening_id ?? null, session?.user.id);

  const badges = data?.badges ?? [];
  const unlocked = badges.filter((b) => b.unlocked).length;
  const pct = badges.length ? Math.round((unlocked / badges.length) * 100) : 0;

  // The locked badge the member is furthest along on — their obvious next win.
  const next = badges
    .filter((b) => !b.unlocked && !b.secret)
    .sort((a, b) => b.progress / b.goal - a.progress / a.goal)[0];

  return (
    <Screen
      header={
        <View style={styles.topRow}>
          <Tappable onPress={() => router.back()} hitSlop={10} scale={0.9} style={styles.back}>
            <Icon name="arrowL" size={18} color={colors.ink} />
          </Tappable>
          <Text style={styles.h1}>Märken</Text>
        </View>
      }
    >
      <LinearGradient colors={brand} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.hero}>
        <Text style={styles.heroKicker}>DIN SAMLING</Text>
        <Text style={styles.heroValue}>
          {unlocked} <Text style={styles.heroOf}>av {badges.length}</Text>
        </Text>
        <View style={styles.heroTrack}>
          <View style={[styles.heroFill, { width: `${pct}%` }]} />
        </View>
        <Text style={styles.heroMeta}>
          {next
            ? `Närmast: ${next.name} — ${next.progress}/${next.goal}`
            : unlocked === badges.length && badges.length > 0
              ? 'Alla märken upplåsta. Respekt!'
              : 'Checka in för att börja samla'}
        </Text>
      </LinearGradient>

      {isLoading && <Text style={styles.empty}>Laddar märken …</Text>}
      {!isLoading && badges.length === 0 && (
        <EmptyState icon="trophy" title="Inga märken än" body="Din förening har inte lagt upp några märken. Hör av dig till en ledare." />
      )}

      {groupBadges(badges).map((group) => {
        const done = group.items.filter((b) => b.unlocked).length;
        return (
          <View key={group.category}>
            <View style={styles.sectionRow}>
              <Text style={styles.section}>{group.category}</Text>
              <Text style={styles.sectionCount}>
                {done}/{group.items.length}
              </Text>
            </View>
            {group.items.map((b, i) => (
              <FadeIn key={b.code} index={i}>
                <BadgeListRow badge={b} />
              </FadeIn>
            ))}
          </View>
        );
      })}
    </Screen>
  );
}

const styles = StyleSheet.create({
  topRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  back: {
    width: 34, height: 34, borderRadius: 17, backgroundColor: colors.white,
    alignItems: 'center', justifyContent: 'center', ...shadow.soft,
  },
  h1: { fontFamily: font.bold, fontSize: 22, color: colors.ink },

  hero: { marginTop: 16, padding: 18, borderRadius: radius.hero, ...shadow.hero },
  heroKicker: { fontFamily: font.medium, fontSize: 11, color: 'rgba(255,255,255,0.85)', letterSpacing: 1 },
  heroValue: { fontFamily: font.bold, fontSize: 32, color: colors.white, marginTop: 2 },
  heroOf: { fontFamily: font.medium, fontSize: 16, color: 'rgba(255,255,255,0.85)' },
  heroTrack: { marginTop: 10, height: 10, borderRadius: 8, backgroundColor: 'rgba(255,255,255,0.3)', overflow: 'hidden' },
  heroFill: { height: 10, borderRadius: 8, backgroundColor: colors.white },
  heroMeta: { fontFamily: font.medium, fontSize: 12, color: 'rgba(255,255,255,0.92)', marginTop: 9 },

  sectionRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 22 },
  section: { fontFamily: font.semibold, fontSize: 15, color: colors.ink },
  sectionCount: { fontFamily: font.medium, fontSize: 12, color: colors.muted2 },

  empty: { fontFamily: font.regular, fontSize: 12.5, color: colors.muted2, marginTop: 18 },
});
