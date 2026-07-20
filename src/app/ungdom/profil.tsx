import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Card } from '@/components/Card';
import { Icon, IconName } from '@/components/Icon';
import { Mascot } from '@/components/Mascot';
import { Screen } from '@/components/Screen';
import { PrimaryButton } from '@/components/ui/PrimaryButton';
import { useProfileData } from '@/hooks/useProfile';
import { colors, fmt, font, gradients, levelName, radius, shadow } from '@/theme/tokens';
import { useAuth } from '@/providers/AuthProvider';

export default function Profil() {
  const router = useRouter();
  const { profile, session, memberships, activeMembership, setActiveForeningId, signOut } = useAuth();

  const foreningId = activeMembership?.forening_id ?? null;
  const { data } = useProfileData(foreningId, session?.user.id);

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
        <StatCard icon="coin" tint={colors.primary} value={fmt(stats.points)} label="Poäng" />
        <StatCard icon="calendar" tint={colors.info} value={String(stats.visits)} label="Besök" />
        <StatCard icon="fire" tint={colors.orange} value={String(stats.streak)} label="Svit" />
      </View>

      {/* Min närvaro */}
      <Pressable onPress={() => router.push('/ungdom/narvaro')}>
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
      </Pressable>

      {/* Märken */}
      <View style={styles.sectionRow}>
        <Text style={styles.sectionInline}>Märken</Text>
        {badges.length > 0 && (
          <Text style={styles.sectionCount}>
            {unlocked} av {badges.length}
          </Text>
        )}
      </View>
      {badges.length === 0 ? (
        <Text style={styles.empty}>Märken laddas …</Text>
      ) : (
        <View style={styles.badgeGrid}>
          {badges.map((b) => (
            <View key={b.code} style={[styles.badgeCell, !b.unlocked && styles.badgeLockedCell]}>
              <View style={[styles.badgeTile, { backgroundColor: b.unlocked ? b.tint : colors.adminBg }]}>
                <Icon name={b.icon as IconName} size={24} color={b.unlocked ? b.color : colors.faint} />
              </View>
              <Text style={[styles.badgeName, !b.unlocked && { color: colors.faint }]} numberOfLines={1}>
                {b.name}
              </Text>
            </View>
          ))}
        </View>
      )}

      {/* Förening switcher */}
      <Text style={styles.section}>Din förening</Text>
      {memberships.map((m) => {
        const active = m.forening_id === activeMembership?.forening_id;
        return (
          <Pressable key={m.id} onPress={() => setActiveForeningId(m.forening_id)}>
            <Card style={[styles.row, active && styles.rowActive]}>
              <View style={[styles.dot, { backgroundColor: m.forening?.color ?? colors.primary }]} />
              <View style={{ flex: 1 }}>
                <Text style={styles.foreningName}>{m.forening?.name ?? 'Förening'}</Text>
                <Text style={styles.roleText}>{m.role === 'ledare' ? 'Ledare' : 'Ungdom'}</Text>
              </View>
              {active && <Icon name="check" size={18} color={colors.green} />}
            </Card>
          </Pressable>
        );
      })}

      <View style={{ marginTop: 22 }}>
        <PrimaryButton label="Logga ut" onPress={signOut} colorsPair={['#2c2340', '#171226'] as const} />
      </View>
      <Text style={styles.email}>{session?.user?.email}</Text>
    </Screen>
  );
}

function StatCard({ icon, tint, value, label }: { icon: IconName; tint: string; value: string; label: string }) {
  return (
    <Card style={styles.statCard}>
      <Icon name={icon} size={18} color={tint} />
      <Text style={[styles.statValue, { color: tint }]}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </Card>
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

  badgeGrid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', marginTop: 10 },
  badgeCell: { width: '23%', alignItems: 'center', marginBottom: 14 },
  badgeLockedCell: { opacity: 0.55 },
  badgeTile: { width: '100%', aspectRatio: 1, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  badgeName: { fontFamily: font.medium, fontSize: 10.5, color: colors.ink, marginTop: 6, textAlign: 'center' },

  row: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14, marginTop: 11 },
  rowActive: { borderWidth: 2, borderColor: colors.primary },
  dot: { width: 12, height: 12, borderRadius: 6 },
  foreningName: { fontFamily: font.semibold, fontSize: 13.5, color: colors.ink },
  roleText: { fontFamily: font.regular, fontSize: 11.5, color: colors.muted2 },

  empty: { fontFamily: font.regular, fontSize: 12.5, color: colors.muted2, marginTop: 8 },
  email: { fontFamily: font.regular, fontSize: 11.5, color: colors.faint, textAlign: 'center', marginTop: 14 },
});
