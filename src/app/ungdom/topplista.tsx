import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Icon } from '@/components/Icon';
import { Screen } from '@/components/Screen';
import { useLeaderboard } from '@/hooks/useLeaderboard';
import { useRefreshOnFocus } from '@/hooks/useRefreshOnFocus';
import { dayHeading } from '@/lib/date';
import { colors, fmt, font } from '@/theme/tokens';
import { useAuth } from '@/providers/AuthProvider';

const initialOf = (name: string) => name.trim().charAt(0).toUpperCase() || '?';
const firstName = (name: string) => name.split(' ')[0];

export default function Topplista() {
  const { activeMembership } = useAuth();
  const fid = activeMembership?.forening_id ?? null;
  const { data, refetch } = useLeaderboard(fid);
  useRefreshOnFocus(refetch);
  const entries = data?.entries ?? [];
  const forra = data?.forra ?? [];
  const sasong = data?.sasong ?? null;
  const forening = activeMembership?.forening?.name ?? '';

  // Säsongen löper mellan två marknader; slutdatumet är nästa marknads öppning.
  const sasongText = sasong?.slut
    ? `Säsongen avgörs ${dayHeading(new Date(sasong.slut)).toLowerCase()} · ${forening}`
    : `Den här säsongen · ${forening}`;

  const top3 = entries.slice(0, 3);
  const podium = [top3[1], top3[0], top3[2]]; // display order: 2nd · 1st · 3rd
  const medalBg = ['#d7d7e0', '#ffd23f', '#e6b98a'];
  const avSize = [48, 58, 48];
  const barH = [52, 70, 52];
  const barColor = ['#c9bdf0', '#ffd23f', '#c9bdf0'];
  const placeNum = [2, 1, 3];

  return (
    <Screen
      header={
        <View>
          <View style={styles.titleRow}>
            <Text style={styles.h1}>Topplista</Text>
            <Icon name="trophy" size={20} color="#ff9500" />
          </View>
          <Text style={styles.sub}>{sasongText}</Text>
        </View>
      }
    >

      <View style={styles.podium}>
        {podium.map((p, i) =>
          p ? (
            <View key={p.rank} style={styles.podCol}>
              <View
                style={[
                  styles.podAvatar,
                  { width: avSize[i], height: avSize[i], borderRadius: avSize[i] / 2, backgroundColor: p.avatar_color },
                ]}
              >
                <Text style={styles.podInit}>{initialOf(p.name)}</Text>
              </View>
              <View style={[styles.placePill, { backgroundColor: medalBg[i] }]}>
                <Text style={styles.placeText}>{placeNum[i]}</Text>
              </View>
              <Text style={styles.podName}>{firstName(p.name)}</Text>
              <View style={[styles.podBar, { height: barH[i], backgroundColor: barColor[i] }]}>
                <Text style={styles.podPts}>{p.xp}</Text>
              </View>
            </View>
          ) : (
            <View key={i} style={styles.podCol} />
          ),
        )}
      </View>

      <View style={{ marginTop: 14 }}>
        {entries.map((e) => (
          <View key={`${e.rank}-${e.name}`} style={[styles.row, e.is_me && styles.rowMe]}>
            <Text style={styles.rank}>{e.rank}</Text>
            <View style={[styles.rowAvatar, { backgroundColor: e.avatar_color }]}>
              <Text style={styles.rowInit}>{initialOf(e.name)}</Text>
            </View>
            <Text style={styles.rowName}>
              {e.name}
              {e.is_me ? ' (du)' : ''}
            </Text>
            <Text style={styles.rowPts}>{fmt(e.xp)} XP</Text>
          </View>
        ))}
      </View>

      <Text style={styles.foot}>
        Rankningen räknar XP du samlat den här säsongen. Att handla i butiken kostar dig ingen placering.
      </Text>

      {forra.length > 0 && (
        <>
          <Text style={styles.section}>Förra säsongen</Text>
          {forra.map((r) => (
            <View key={`${r.rank}-${r.name}`} style={styles.forraRow}>
              <Text style={styles.forraRank}>{r.rank}</Text>
              <View style={[styles.rowAvatar, { backgroundColor: r.avatar_color }]}>
                <Text style={styles.rowInit}>{initialOf(r.name)}</Text>
              </View>
              <Text style={styles.rowName}>{r.name}</Text>
              <Text style={styles.forraXp}>{fmt(r.xp)} XP</Text>
            </View>
          ))}
        </>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 9 },
  h1: { fontFamily: font.bold, fontSize: 22, color: colors.ink },
  sub: { fontFamily: font.regular, fontSize: 12, color: colors.muted2, marginTop: 2 },

  podium: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'center', gap: 10, marginTop: 20 },
  podCol: { flex: 1, alignItems: 'center' },
  podAvatar: { alignItems: 'center', justifyContent: 'center', borderWidth: 3, borderColor: colors.white },
  podInit: { fontFamily: font.bold, fontSize: 16, color: colors.white },
  placePill: {
    marginTop: 5, minWidth: 22, height: 22, paddingHorizontal: 6, borderRadius: 11,
    alignItems: 'center', justifyContent: 'center',
  },
  placeText: { fontFamily: font.bold, fontSize: 12, color: colors.ink },
  podName: { fontFamily: font.semibold, fontSize: 12, color: colors.ink, marginTop: 3 },
  podBar: {
    width: '100%', marginTop: 6, borderTopLeftRadius: 12, borderTopRightRadius: 12,
    alignItems: 'center', paddingTop: 7,
  },
  podPts: { fontFamily: font.bold, fontSize: 12, color: colors.white },

  row: {
    flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 10,
    paddingVertical: 12, paddingHorizontal: 14, borderRadius: 16,
    backgroundColor: colors.white, borderWidth: 2, borderColor: 'transparent',
  },
  rowMe: { backgroundColor: colors.tintPurple, borderColor: colors.primary },
  rank: { fontFamily: font.bold, fontSize: 13, color: colors.muted2, width: 20 },
  rowAvatar: { width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center' },
  rowInit: { fontFamily: font.semibold, fontSize: 13, color: colors.white },
  rowName: { flex: 1, fontFamily: font.semibold, fontSize: 13.5, color: colors.ink },
  rowPts: { fontFamily: font.bold, fontSize: 13, color: colors.primary },

  foot: { fontFamily: font.regular, fontSize: 11.5, color: colors.faint, textAlign: 'center', marginTop: 18, lineHeight: 16 },
  section: { fontFamily: font.bold, fontSize: 15, color: colors.ink, marginTop: 22 },
  forraRow: {
    flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 9,
    paddingVertical: 10, paddingHorizontal: 14, borderRadius: 16, backgroundColor: colors.tintYellow,
  },
  forraRank: { fontFamily: font.bold, fontSize: 13, color: colors.ink, width: 20 },
  forraXp: { fontFamily: font.bold, fontSize: 12.5, color: colors.ink },
});
