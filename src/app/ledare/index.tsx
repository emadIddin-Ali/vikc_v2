import { useRouter } from 'expo-router';
import React, { useRef, useState } from 'react';
import { Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Icon } from '@/components/Icon';
import { useRefreshAll } from '@/hooks/useRefreshAll';
import { Aktiviteter } from '@/features/ledare/Aktiviteter';
import { Beloningar } from '@/features/ledare/Beloningar';
import { ForeningInfo } from '@/features/ledare/ForeningInfo';
import { Klasser } from '@/features/ledare/Klasser';
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
  { key: 'klasser', label: 'Klasser' },
  { key: 'forening', label: 'Förening' },
];

export default function LedareHome() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { activeForening, activeForeningId, actAsForening, exitForeningAsLeader, profile, session } = useAuth();
  const fid = activeForeningId;
  const forening = activeForening?.name ?? '';
  const name = (profile?.display_name?.trim() || session?.user?.email?.split('@')[0] || 'ledare').split(' ')[0];
  const [tab, setTab] = useState<LedareTab>('oversikt');
  const scrollRef = useRef<ScrollView>(null);
  const { refreshing, onRefresh } = useRefreshAll();

  // All five tabs share one ScrollView, so without this a new tab opens at the
  // previous tab's scroll offset — which looks like the content is cut off.
  const selectTab = (next: LedareTab) => {
    setTab(next);
    scrollRef.current?.scrollTo({ y: 0, animated: false });
  };

  const backToKommun = () => {
    exitForeningAsLeader();
    router.replace('/kommun');
  };

  return (
    <View style={[styles.root, { paddingTop: insets.top + 6 }]}>
      <View style={styles.header}>
        <View style={{ flex: 1 }}>
          <Text style={styles.kicker} numberOfLines={1}>Ledarvy · {forening}</Text>
          <Text style={styles.hej}>Hej {name}</Text>
        </View>
        {actAsForening ? (
          <Pressable style={styles.kommunBtn} onPress={backToKommun} hitSlop={8}>
            <Icon name="arrowL" size={16} color={colors.white} />
            <Text style={styles.kommunBtnText}>Kommun</Text>
          </Pressable>
        ) : (
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{name.charAt(0).toUpperCase()}</Text>
          </View>
        )}
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
            onPress={() => selectTab(t.key)}
            style={[styles.pill, { backgroundColor: tab === t.key ? colors.ink : colors.white }]}
          >
            <Text style={[styles.pillText, { color: tab === t.key ? colors.white : colors.muted }]}>{t.label}</Text>
          </Pressable>
        ))}
      </ScrollView>

      <ScrollView
        ref={scrollRef}
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 32 }]}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        automaticallyAdjustKeyboardInsets
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={colors.primary}
            colors={[colors.primary]}
          />
        }
      >
        {fid && tab === 'oversikt' && <Oversikt fid={fid} onNavigate={setTab} />}
        {fid && tab === 'aktiviteter' && <Aktiviteter fid={fid} />}
        {fid && tab === 'narvaro' && <Narvaro fid={fid} />}
        {fid && tab === 'uppdrag' && <Uppdrag fid={fid} />}
        {fid && tab === 'beloningar' && <Beloningar fid={fid} />}
        {fid && tab === 'klasser' && <Klasser fid={fid} />}
        {fid && tab === 'forening' && <ForeningInfo fid={fid} />}
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
  kommunBtn: { flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: colors.ink, paddingVertical: 8, paddingHorizontal: 12, borderRadius: 12 },
  kommunBtnText: { fontFamily: font.semibold, fontSize: 12.5, color: colors.white },

  // flexShrink: 0 är inte överflödig. React Native ger varje ScrollView
  // flexShrink: 0, men react-native-web sätter 1 — och då krymps flikraden av
  // innehållet under den. På en lång flik (Aktiviteter, Klasser) blev raden en
  // några pixlar hög strimma där bara toppen av knapparna syntes.
  tabsScroll: { flexGrow: 0, flexShrink: 0, marginTop: 8 },
  tabs: { gap: 7, paddingHorizontal: 18, paddingVertical: 4 },
  pill: { paddingVertical: 9, paddingHorizontal: 15, borderRadius: 999 },
  pillText: { fontFamily: font.semibold, fontSize: 12.5 },

  content: { paddingHorizontal: 18, paddingTop: 12 },
});
