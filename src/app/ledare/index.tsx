import React, { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Aktiviteter } from '@/features/ledare/Aktiviteter';
import { Beloningar } from '@/features/ledare/Beloningar';
import { Narvaro } from '@/features/ledare/Narvaro';
import { Oversikt } from '@/features/ledare/Oversikt';
import { Uppdrag } from '@/features/ledare/Uppdrag';
import type { LedareTab } from '@/features/ledare/types';
import { colors, font } from '@/theme/tokens';
import { useAuth } from '@/providers/AuthProvider';

const TABS: { key: LedareTab; label: string }[] = [
  { key: 'oversikt', label: 'Översikt' },
  { key: 'aktiviteter', label: 'Aktiviteter' },
  { key: 'narvaro', label: 'Närvaro' },
  { key: 'uppdrag', label: 'Uppdrag' },
  { key: 'beloningar', label: 'Belöningar' },
];

export default function LedareHome() {
  const insets = useSafeAreaInsets();
  const { activeMembership, profile, session } = useAuth();
  const fid = activeMembership?.forening_id ?? null;
  const forening = activeMembership?.forening?.name ?? '';
  const name = (profile?.display_name?.trim() || session?.user?.email?.split('@')[0] || 'ledare').split(' ')[0];
  const [tab, setTab] = useState<LedareTab>('oversikt');

  return (
    <View style={[styles.root, { paddingTop: insets.top + 6 }]}>
      <View style={styles.header}>
        <View style={{ flex: 1 }}>
          <Text style={styles.kicker} numberOfLines={1}>Ledarvy · {forening}</Text>
          <Text style={styles.hej}>Hej {name}</Text>
        </View>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>{name.charAt(0).toUpperCase()}</Text>
        </View>
      </View>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.tabsScroll}
        contentContainerStyle={styles.tabs}
      >
        {TABS.map((t) => (
          <Pressable
            key={t.key}
            onPress={() => setTab(t.key)}
            style={[styles.pill, { backgroundColor: tab === t.key ? colors.ink : colors.white }]}
          >
            <Text style={[styles.pillText, { color: tab === t.key ? colors.white : colors.muted }]}>{t.label}</Text>
          </Pressable>
        ))}
      </ScrollView>

      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {fid && tab === 'oversikt' && <Oversikt fid={fid} onNavigate={setTab} />}
        {fid && tab === 'aktiviteter' && <Aktiviteter fid={fid} />}
        {fid && tab === 'narvaro' && <Narvaro fid={fid} />}
        {fid && tab === 'uppdrag' && <Uppdrag fid={fid} />}
        {fid && tab === 'beloningar' && <Beloningar fid={fid} />}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.adminBg },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 18, paddingBottom: 4 },
  kicker: { fontFamily: font.medium, fontSize: 12, color: colors.muted },
  hej: { fontFamily: font.bold, fontSize: 19, color: colors.ink },
  avatar: { width: 38, height: 38, borderRadius: 12, backgroundColor: colors.ink, alignItems: 'center', justifyContent: 'center' },
  avatarText: { fontFamily: font.bold, fontSize: 15, color: colors.white },

  tabsScroll: { flexGrow: 0, marginTop: 8 },
  tabs: { gap: 7, paddingHorizontal: 18, paddingVertical: 4 },
  pill: { paddingVertical: 9, paddingHorizontal: 15, borderRadius: 999 },
  pillText: { fontFamily: font.semibold, fontSize: 12.5 },

  content: { paddingHorizontal: 18, paddingTop: 12, paddingBottom: 32 },
});
