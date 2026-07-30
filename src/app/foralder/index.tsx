import { useQuery } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import React, { useState } from 'react';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { Card } from '@/components/Card';
import { Icon } from '@/components/Icon';
import { Screen } from '@/components/Screen';
import { EmptyState } from '@/components/ui/EmptyState';
import { FadeIn } from '@/components/ui/FadeIn';
import { Tappable } from '@/components/ui/Tappable';
import { AddChildModal } from '@/features/foralder/AddChildModal';
import { BarnButikModal } from '@/features/foralder/BarnButikModal';
import { ChildDetailModal } from '@/features/foralder/ChildDetailModal';
import { AnslutModal } from '@/features/join/AnslutModal';
import { useMyChildren } from '@/hooks/useParent';
import { supabase } from '@/lib/supabase';
import { fmtDateTime } from '@/lib/date';
import type { Child, HomeActivity } from '@/lib/types';
import { activityTheme, colors, font, levelName, shadow } from '@/theme/tokens';
import { useAuth } from '@/providers/AuthProvider';

export default function ForalderHem() {
  const router = useRouter();
  const { profile, activeMembership, session, signOut } = useAuth();
  const forening = activeMembership?.forening;
  const foreningId = activeMembership?.forening_id ?? null;

  const { data: children } = useMyChildren(foreningId);
  const [addOpen, setAddOpen] = useState(false);
  const [editChild, setEditChild] = useState<Child | null>(null);
  const [detailChild, setDetailChild] = useState<Child | null>(null);
  const [anslutOpen, setAnslutOpen] = useState(false);
  const [shopChild, setShopChild] = useState<Child | null>(null);

  const rawName = profile?.display_name?.trim() || session?.user?.email?.split('@')[0] || 'Förälder';
  const name = rawName.split(' ')[0];

  const { data: activities } = useQuery<HomeActivity[]>({
    queryKey: ['parent-activities', foreningId],
    enabled: !!foreningId,
    queryFn: async () => {
      const { data } = await supabase
        .from('activity')
        .select('id, title, when_text, points, starts_at, continuous, theme')
        .eq('forening_id', foreningId as string)
        .eq('active', true)
        .order('starts_at', { ascending: true, nullsFirst: false })
        .limit(10);
      const startOfToday = new Date();
      startOfToday.setHours(0, 0, 0, 0);
      return ((data as HomeActivity[]) ?? [])
        .filter((a) => a.continuous || !a.starts_at || new Date(a.starts_at).getTime() >= startOfToday.getTime())
        .slice(0, 5);
    },
  });

  const kids = children ?? [];

  return (
    <Screen
      header={
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            {!!forening?.logo_url && <Image source={{ uri: forening.logo_url }} style={styles.logo} />}
            <View style={{ flexShrink: 1 }}>
              <Text style={styles.greeting}>Förälder</Text>
              <Text style={styles.name}>Hej {name}</Text>
            </View>
          </View>
          <View style={styles.headerRight}>
            <Tappable style={styles.bell} scale={0.88} hitSlop={6} onPress={() => router.push('/foralder/topplista')}>
              <Icon name="trophy" size={20} color="#ff9500" />
            </Tappable>
            <Pressable onPress={signOut} hitSlop={8}>
              <Text style={styles.logout}>Logga ut</Text>
            </Pressable>
          </View>
        </View>
      }
    >
      {/* Mina barn */}
      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>Mina barn</Text>
        <Pressable onPress={() => setAddOpen(true)} hitSlop={6}>
          <Text style={styles.addLink}>+ Lägg till</Text>
        </Pressable>
      </View>

      {kids.length === 0 ? (
        <EmptyState icon="user" title="Inga barn tillagda" body="Lägg till ditt barn så kan du checka in det på aktiviteter och följa poängen." />
      ) : (
        kids.map((c, i) => (
          <FadeIn key={c.id} index={i}>
            <Card style={styles.childCard}>
              <Pressable style={styles.childMain} onPress={() => setDetailChild(c)}>
                <View style={[styles.avatar, { backgroundColor: c.avatar_color }]}>
                  <Text style={styles.avatarText}>{c.display_name.charAt(0).toUpperCase()}</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.childName}>{c.display_name}</Text>
                  <Text style={styles.childMeta}>
                    Nivå {c.level} · {levelName(c.level)} · {c.points} p{c.week_streak > 0 ? ` · 🔥 ${c.week_streak} v` : ''}
                  </Text>
                </View>
              </Pressable>
              <Pressable style={styles.checkinBtn} onPress={() => router.push({ pathname: '/scan', params: { child: c.id } })}>
                <Icon name="camera" size={15} color={colors.white} />
                <Text style={styles.checkinText}>Checka in</Text>
              </Pressable>
            </Card>
          </FadeIn>
        ))
      )}

      {/* Aktiviteter */}
      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>Aktiviteter</Text>
        <Text style={styles.sectionHint}>Checka in ditt barn på plats</Text>
      </View>
      {(activities ?? []).length === 0 ? (
        <EmptyState icon="calendar" title="Inget uppsatt än" body="Kommande aktiviteter dyker upp här." />
      ) : (
        (activities ?? []).map((a, i) => {
          const t = activityTheme(a.theme);
          const when = a.continuous ? 'Alltid öppen' : a.starts_at ? fmtDateTime(new Date(a.starts_at)) : a.when_text || 'Tid ej satt';
          return (
            <FadeIn key={a.id} index={i}>
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
            </FadeIn>
          );
        })
      )}

      {/* Anslut — föräldern får koder till både förening och klass, och hade
          ingenstans att skriva in dem efter första inloggningen. */}
      <Tappable onPress={() => setAnslutOpen(true)}>
        <Card style={styles.navRow}>
          <View style={styles.navTile}>
            <Icon name="diamond" size={20} color={colors.primary} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.navTitle}>Anslut med kod</Text>
            <Text style={styles.navSub}>Gå med i en förening, eller ditt barn i en klass</Text>
          </View>
          <Icon name="chev" size={18} color={colors.faint} />
        </Card>
      </Tappable>

      {!!forening && <Text style={styles.foreningTag}>{forening.name}</Text>}

      {anslutOpen && (
        <AnslutModal role="foralder" barn={kids} onClose={() => setAnslutOpen(false)} />
      )}

      {addOpen && foreningId && <AddChildModal forening={foreningId} onClose={() => setAddOpen(false)} />}
      {editChild && foreningId && (
        <AddChildModal forening={foreningId} child={editChild} onClose={() => setEditChild(null)} />
      )}
      {detailChild && (
        <ChildDetailModal
          child={detailChild}
          onClose={() => setDetailChild(null)}
          onEdit={() => {
            const c = detailChild;
            setDetailChild(null);
            setEditChild(c);
          }}
          onCheckIn={() => {
            const id = detailChild.id;
            setDetailChild(null);
            router.push({ pathname: '/scan', params: { child: id } });
          }}
          onShop={() => {
            const c = detailChild;
            setDetailChild(null);
            setShopChild(c);
          }}
        />
      )}
      {shopChild && <BarnButikModal child={shopChild} onClose={() => setShopChild(null)} />}
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingTop: 6 },
  headerLeft: { flexDirection: 'row', alignItems: 'center', gap: 10, flexShrink: 1 },
  logo: { width: 40, height: 40, borderRadius: 12, backgroundColor: colors.white },
  greeting: { fontFamily: font.medium, fontSize: 12.5, color: colors.muted },
  name: { fontFamily: font.bold, fontSize: 20, color: colors.ink },
  headerRight: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  bell: { width: 40, height: 40, borderRadius: 14, backgroundColor: colors.white, alignItems: 'center', justifyContent: 'center', ...shadow.soft },
  logout: { fontFamily: font.semibold, fontSize: 13, color: colors.muted },

  sectionHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 20 },
  sectionTitle: { fontFamily: font.bold, fontSize: 16, color: colors.ink },
  sectionHint: { fontFamily: font.regular, fontSize: 11.5, color: colors.muted2 },
  addLink: { fontFamily: font.semibold, fontSize: 13, color: colors.primary },

  childCard: { flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 12, padding: 13 },
  childMain: { flexDirection: 'row', alignItems: 'center', gap: 12, flex: 1 },
  avatar: { width: 46, height: 46, borderRadius: 23, alignItems: 'center', justifyContent: 'center' },
  avatarText: { fontFamily: font.bold, fontSize: 19, color: colors.white },
  childName: { fontFamily: font.semibold, fontSize: 14.5, color: colors.ink },
  childMeta: { fontFamily: font.regular, fontSize: 11.5, color: colors.muted2, marginTop: 1 },
  checkinBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: colors.green, borderRadius: 12, paddingVertical: 9, paddingHorizontal: 13 },
  checkinText: { fontFamily: font.semibold, fontSize: 12.5, color: colors.white },

  actRow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 11, paddingVertical: 12, paddingHorizontal: 14 },
  actTile: { width: 40, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  actTitle: { fontFamily: font.semibold, fontSize: 13.5, color: colors.ink },
  actWhen: { fontFamily: font.regular, fontSize: 11.5, color: colors.muted2 },
  actPts: { fontFamily: font.bold, fontSize: 13, color: colors.primary },

  navRow: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14, marginTop: 20 },
  navTile: { width: 42, height: 42, borderRadius: 13, backgroundColor: colors.tintPurple, alignItems: 'center', justifyContent: 'center' },
  navTitle: { fontFamily: font.semibold, fontSize: 14, color: colors.ink },
  navSub: { fontFamily: font.regular, fontSize: 11.5, color: colors.muted2 },

  foreningTag: { fontFamily: font.medium, fontSize: 11, color: colors.faint, textAlign: 'center', marginTop: 22 },
});
