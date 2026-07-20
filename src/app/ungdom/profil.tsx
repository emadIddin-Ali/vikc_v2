import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import React from 'react';
import { StyleSheet, Switch, Text, View } from 'react-native';
import { BadgeCell } from '@/components/Badge';
import { Card } from '@/components/Card';
import { Icon, IconName } from '@/components/Icon';
import { Mascot } from '@/components/Mascot';
import { Screen } from '@/components/Screen';
import { CountUp } from '@/components/ui/CountUp';
import { FadeIn } from '@/components/ui/FadeIn';
import { PrimaryButton } from '@/components/ui/PrimaryButton';
import { Tappable } from '@/components/ui/Tappable';
import { highlightBadges, useProfileData } from '@/hooks/useProfile';
import { playSfx, useSfxStore } from '@/lib/sfx';
import { colors, font, gradients, levelName, radius, shadow } from '@/theme/tokens';
import { useAuth } from '@/providers/AuthProvider';

export default function Profil() {
  const router = useRouter();
  const { profile, session, memberships, activeMembership, setActiveForeningId, signOut } = useAuth();

  const foreningId = activeMembership?.forening_id ?? null;
  const { data } = useProfileData(foreningId, session?.user.id);
  const sfxEnabled = useSfxStore((s) => s.enabled);
  const setSfxEnabled = useSfxStore((s) => s.setEnabled);

  const name = profile?.display_name?.trim() || session?.user?.email?.split('@')[0] || 'Du';
  const forening = activeMembership?.forening?.name ?? '';

  // Fresh DB stats when available, else the context snapshot.
  const stats = data?.stats ?? {
    points: activeMembership?.points ?? 0,
    visits: activeMembership?.visits ?? 0,
    streak: activeMembership?.streak ?? 0,
    level: activeMembership?.level ?? 1,
  };
  const badges = data?.badges ?? [];
  const unlocked = badges.filter((b) => b.unlocked).length;

  return (
    <Screen>
      {/* Avatar + identity */}
      <View style={styles.head}>
        <View style={styles.avatarWrap}>
          <LinearGradient colors={gradients.brand} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.avatar}>
            <Mascot size={62} eyes />
          </LinearGradient>
          <View style={styles.levelBadge}>
            <Text style={styles.levelBadgeText}>Nivå {stats.level}</Text>
          </View>
        </View>
        <Text style={styles.name}>{name}</Text>
        <Text style={styles.subtitle}>
          {levelName(stats.level)}
          {forening ? ` · ${forening}` : ''}
        </Text>
      </View>

      {/* Stats */}
      <View style={styles.stats}>
        <StatCard icon="coin" tint={colors.primary} value={stats.points} label="Poäng" index={0} />
        <StatCard icon="calendar" tint={colors.info} value={stats.visits} label="Besök" index={1} />
        <StatCard icon="fire" tint={colors.orange} value={stats.streak} label="Svit" index={2} />
      </View>

      {/* Min närvaro */}
      <Tappable onPress={() => router.push('/ungdom/narvaro')}>
        <Card style={styles.navRow}>
          <View style={styles.navTile}>
            <Icon name="calendar" size={20} color={colors.primary} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.navTitle}>Min närvaro</Text>
            <Text style={styles.navSub}>Se alla dina incheckningar</Text>
          </View>
          <Icon name="chev" size={18} color={colors.faint} />
        </Card>
      </Tappable>

      {/* Märken — earned first, then the nearest goals; full catalog one tap away */}
      <Tappable scale={0.985} onPress={() => router.push('/ungdom/marken')}>
        <View style={styles.sectionRow}>
          <Text style={styles.sectionInline}>Märken</Text>
          <View style={styles.sectionLink}>
            <Text style={styles.sectionCount}>
              {badges.length ? `${unlocked} av ${badges.length}` : ''}
            </Text>
            <Icon name="chev" size={16} color={colors.faint} />
          </View>
        </View>
        {badges.length === 0 ? (
          <Text style={styles.empty}>Märken laddas …</Text>
        ) : (
          <View style={styles.badgeGrid}>
            {highlightBadges(badges).map((b, i) => (
              <FadeIn key={b.code} index={i} style={styles.badgeCell}>
                <BadgeCell badge={b} />
              </FadeIn>
            ))}
          </View>
        )}
      </Tappable>

      {/* Förening switcher */}
      <Text style={styles.section}>Din förening</Text>
      {memberships.map((m) => {
        const active = m.forening_id === activeMembership?.forening_id;
        return (
          <Tappable key={m.id} onPress={() => setActiveForeningId(m.forening_id)}>
            <Card style={[styles.row, active && styles.rowActive]}>
              <View style={[styles.dot, { backgroundColor: m.forening?.color ?? colors.primary }]} />
              <View style={{ flex: 1 }}>
                <Text style={styles.foreningName}>{m.forening?.name ?? 'Förening'}</Text>
                <Text style={styles.roleText}>{m.role === 'ledare' ? 'Ledare' : 'Ungdom'}</Text>
              </View>
              {active && <Icon name="check" size={18} color={colors.green} />}
            </Card>
          </Tappable>
        );
      })}

      {/* Inställningar */}
      <Text style={styles.section}>Inställningar</Text>
      <Card style={styles.navRow}>
        <View style={styles.navTile}>
          <Icon name="bell" size={20} color={colors.primary} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.navTitle}>Ljudeffekter</Text>
          <Text style={styles.navSub}>Ljud vid incheckning, nivå och märken</Text>
        </View>
        <Switch
          value={sfxEnabled}
          onValueChange={(on) => {
            setSfxEnabled(on);
            if (on) playSfx('tap');
          }}
          trackColor={{ true: colors.primary, false: '#dcd4f0' }}
          thumbColor={colors.white}
        />
      </Card>

      <View style={{ marginTop: 22 }}>
        <PrimaryButton label="Logga ut" onPress={signOut} colorsPair={['#2c2340', '#171226'] as const} />
      </View>
      <Text style={styles.email}>{session?.user?.email}</Text>
    </Screen>
  );
}

function StatCard({
  icon,
  tint,
  value,
  label,
  index,
}: {
  icon: IconName;
  tint: string;
  value: number;
  label: string;
  index: number;
}) {
  return (
    <FadeIn index={index} style={{ flex: 1 }}>
      <Card style={styles.statCard}>
        <Icon name={icon} size={18} color={tint} />
        <CountUp value={value} style={[styles.statValue, { color: tint }]} />
        <Text style={styles.statLabel}>{label}</Text>
      </Card>
    </FadeIn>
  );
}

const styles = StyleSheet.create({
  head: { alignItems: 'center', marginTop: 6, marginBottom: 6 },
  avatarWrap: { alignItems: 'center' },
  avatar: {
    width: 96, height: 96, borderRadius: 48, alignItems: 'center', justifyContent: 'center', ...shadow.hero,
  },
  levelBadge: {
    marginTop: -12, backgroundColor: colors.white, paddingHorizontal: 12, paddingVertical: 4,
    borderRadius: radius.pill, ...shadow.soft,
  },
  levelBadgeText: { fontFamily: font.bold, fontSize: 12, color: colors.primary },
  name: { fontFamily: font.bold, fontSize: 20, color: colors.ink, marginTop: 10 },
  subtitle: { fontFamily: font.medium, fontSize: 12.5, color: colors.muted, marginTop: 2 },

  stats: { flexDirection: 'row', gap: 10, marginTop: 16 },
  statCard: { flex: 1, alignItems: 'center', paddingVertical: 14, gap: 3 },
  statValue: { fontFamily: font.bold, fontSize: 20 },
  statLabel: { fontFamily: font.medium, fontSize: 11, color: colors.muted2 },

  navRow: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14, marginTop: 12 },
  navTile: { width: 42, height: 42, borderRadius: 13, backgroundColor: colors.tintPurple, alignItems: 'center', justifyContent: 'center' },
  navTitle: { fontFamily: font.semibold, fontSize: 14, color: colors.ink },
  navSub: { fontFamily: font.regular, fontSize: 11.5, color: colors.muted2 },

  sectionRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 20, marginBottom: 2 },
  section: { fontFamily: font.semibold, fontSize: 14, color: colors.ink, marginTop: 20, marginBottom: 4 },
  sectionInline: { fontFamily: font.semibold, fontSize: 14, color: colors.ink },
  sectionCount: { fontFamily: font.medium, fontSize: 12, color: colors.muted2 },
  sectionLink: { flexDirection: 'row', alignItems: 'center', gap: 4 },

  badgeGrid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', marginTop: 12 },
  badgeCell: { width: '23%', marginBottom: 14 },

  row: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14, marginTop: 11 },
  rowActive: { borderWidth: 2, borderColor: colors.primary },
  dot: { width: 12, height: 12, borderRadius: 6 },
  foreningName: { fontFamily: font.semibold, fontSize: 13.5, color: colors.ink },
  roleText: { fontFamily: font.regular, fontSize: 11.5, color: colors.muted2 },

  empty: { fontFamily: font.regular, fontSize: 12.5, color: colors.muted2, marginTop: 8 },
  email: { fontFamily: font.regular, fontSize: 11.5, color: colors.faint, textAlign: 'center', marginTop: 14 },
});
