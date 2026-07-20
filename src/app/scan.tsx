import { CameraView, useCameraPermissions } from 'expo-camera';
import { LinearGradient } from 'expo-linear-gradient';
import * as Location from 'expo-location';
import { useRouter } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, Switch, Text, View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Confetti } from '@/components/Confetti';
import { Floaty } from '@/components/Floaty';
import { Icon, IconName } from '@/components/Icon';
import { MascotCelebration } from '@/components/MascotCelebration';
import { claimNewBadges } from '@/lib/badgeSeen';
import { haptics } from '@/lib/haptics';
import { useCheckin, useOpenCheckin, useYouthOpenActivities } from '@/hooks/useCheckin';
import { capturePhoto, uploadCheckinPhoto } from '@/lib/photo';
import { supabase } from '@/lib/supabase';
import { toast } from '@/store/toast';
import type { Activity, BadgeRow, CheckinResult, YouthOpenActivity } from '@/lib/types';
import { colors, font, gradients, levelName } from '@/theme/tokens';
import { useAuth } from '@/providers/AuthProvider';

type GeoState = 'searching' | 'inrange' | 'far';

function distanceM(aLat: number, aLng: number, bLat: number, bLng: number): number {
  const R = 6371000;
  const dLat = ((bLat - aLat) * Math.PI) / 180;
  const dLng = ((bLng - aLng) * Math.PI) / 180;
  const s =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((aLat * Math.PI) / 180) * Math.cos((bLat * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(s));
}

export default function Scan() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { activeMembership, session } = useAuth();
  const checkin = useCheckin();
  const openCheckin = useOpenCheckin();

  const forening = activeMembership?.forening;
  const foreningId = activeMembership?.forening_id ?? null;
  const userId = session?.user.id;
  const venueLat = forening?.lat ?? null;
  const venueLng = forening?.lng ?? null;
  const radiusM = forening?.geofence_radius_m ?? 120;

  const [mode, setMode] = useState<'scan' | 'success' | 'levelup' | 'badge'>('scan');
  const [result, setResult] = useState<CheckinResult | null>(null);
  const [newBadges, setNewBadges] = useState<BadgeRow[]>([]);
  const [simulateOnSite, setSimulateOnSite] = useState(true);
  const [geo, setGeo] = useState<GeoState>('searching');
  const [distance, setDistance] = useState<number | null>(null);
  const [deviceCoords, setDeviceCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [accuracy, setAccuracy] = useState<number | null>(null);
  const [permission, requestPermission] = useCameraPermissions();
  const [busyId, setBusyId] = useState<string | null>(null);
  const handledRef = useRef(false);

  const { data: activities } = useQuery<Activity[]>({
    queryKey: ['scan-activities', foreningId],
    enabled: !!foreningId,
    queryFn: async () => {
      const { data } = await supabase
        .from('activity')
        .select('*')
        .eq('forening_id', foreningId as string)
        .eq('active', true)
        .eq('checkin_mode', 'qr')
        .order('created_at', { ascending: true });
      return (data as Activity[]) ?? [];
    },
  });
  const qrActivities = activities ?? [];
  const { data: openList } = useYouthOpenActivities(foreningId);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (simulateOnSite) {
        setGeo('inrange');
        setDistance(null);
        return;
      }
      setGeo('searching');
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (cancelled) return;
      if (status !== 'granted') {
        setGeo('far');
        return;
      }
      const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
      if (cancelled) return;
      const coords = { lat: pos.coords.latitude, lng: pos.coords.longitude };
      setDeviceCoords(coords);
      setAccuracy(pos.coords.accuracy ?? null);
      if (venueLat != null && venueLng != null) {
        const d = distanceM(coords.lat, coords.lng, venueLat, venueLng);
        setDistance(d);
        setGeo(d <= radiusM ? 'inrange' : 'far');
      } else {
        setGeo('inrange');
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [simulateOnSite, venueLat, venueLng, radiusM]);

  useEffect(() => {
    if (mode === 'success') haptics.success();
    else if (mode === 'levelup' || mode === 'badge') haptics.medium();
  }, [mode]);

  const inRange = geo === 'inrange';
  const busy = checkin.isPending || openCheckin.isPending || busyId !== null;

  /** Show the success screen, and look up any badges the check-in just unlocked. */
  const onCheckedIn = useCallback(
    (data: CheckinResult) => {
      setResult(data);
      setMode('success');
      setNewBadges([]);
      if (userId && foreningId) {
        claimNewBadges(userId, foreningId)
          .then(setNewBadges)
          .catch(() => {
            // A failed lookup only costs the celebration, not the check-in.
          });
      }
    },
    [userId, foreningId],
  );

  const runScan = useCallback(
    (token: string | undefined) => {
      if (busy || handledRef.current) return;
      if (!token) return;
      if (!inRange) {
        // Camera recognised the code but we're not on-site — say so (debounced).
        handledRef.current = true;
        toast('Du måste vara på plats. Slå på "Simulera att jag är på plats" för test.');
        setTimeout(() => {
          handledRef.current = false;
        }, 2500);
        return;
      }
      handledRef.current = true;
      const coords = simulateOnSite ? { lat: venueLat, lng: venueLng } : deviceCoords;
      checkin.mutate(
        { token, lat: coords?.lat ?? null, lng: coords?.lng ?? null, accuracy: simulateOnSite ? null : accuracy },
        {
          onSuccess: onCheckedIn,
          onError: (e) => {
            handledRef.current = false;
            Alert.alert('Kunde inte checka in', e.message);
          },
        },
      );
    },
    [busy, inRange, simulateOnSite, venueLat, venueLng, deviceCoords, accuracy, checkin, onCheckedIn],
  );

  const runOpenCheckin = async (a: YouthOpenActivity) => {
    if (busy) return;
    if (!inRange) return Alert.alert('Inte på plats', 'Du måste vara på plats för att checka in.');
    setBusyId(a.id);
    try {
      let photoUrl: string | null = null;
      if (a.requires_photo) {
        const uri = await capturePhoto();
        if (!uri) {
          Alert.alert('Foto krävs', 'Du måste ta ett foto för att checka in här.');
          return;
        }
        photoUrl = await uploadCheckinPhoto(uri, userId as string);
      }
      const coords = simulateOnSite
        ? a.lat != null && a.lng != null
          ? { lat: a.lat, lng: a.lng }
          : { lat: venueLat, lng: venueLng }
        : deviceCoords;
      openCheckin.mutate(
        { activityId: a.id, lat: coords?.lat ?? null, lng: coords?.lng ?? null, accuracy: simulateOnSite ? null : accuracy, photoUrl },
        {
          onSuccess: onCheckedIn,
          onError: (e) => Alert.alert('Kunde inte checka in', e.message),
        },
      );
    } catch (e) {
      Alert.alert('Fel', e instanceof Error ? e.message : 'Något gick fel');
    } finally {
      setBusyId(null);
    }
  };

  const finish = useCallback(() => router.back(), [router]);

  /** Celebration order: check-in → level-up → new badges → back. */
  const afterLevel = useCallback(
    () => (newBadges.length > 0 ? setMode('badge') : finish()),
    [newBadges.length, finish],
  );

  if (mode === 'success' && result) {
    return (
      <LinearGradient colors={gradients.success} style={styles.celebrate}>
        <MascotCelebration size={114} mascotSize={66} />
        <Text style={styles.celebrateTitle}>Incheckad!</Text>
        <Text style={styles.celebrateSub}>{result.title} · {result.forening}</Text>
        <View style={styles.chips}>
          <View style={styles.chip}>
            <Text style={styles.chipNum}>+{result.awarded_xp}</Text>
            <Text style={styles.chipLabel}>XP</Text>
          </View>
          <View style={styles.chip}>
            <Text style={styles.chipNum}>+{result.awarded_points}</Text>
            <Text style={styles.chipLabel}>poäng</Text>
          </View>
        </View>
        <Pressable style={[styles.celebrateBtn, { backgroundColor: colors.white }]} onPress={() => (result.leveled_up ? setMode('levelup') : afterLevel())}>
          <Text style={[styles.celebrateBtnText, { color: colors.green2 }]}>Fortsätt</Text>
        </Pressable>
      </LinearGradient>
    );
  }

  if (mode === 'levelup' && result) {
    return (
      <LinearGradient colors={gradients.levelUp} style={styles.celebrate}>
        <Confetti />
        <Text style={styles.levelKicker}>LEVEL UP</Text>
        <MascotCelebration
          size={128}
          mascotSize={112}
          disc={false}
          rayColor="rgba(255,210,63,0.5)"
          ringColor="rgba(255,210,63,0.45)"
          glowColor="rgba(255,210,63,0.16)"
        />
        <Text style={styles.levelBig}>Nivå {result.level}!</Text>
        <Text style={styles.levelName}>{levelName(result.level)}</Text>
        <Pressable style={[styles.celebrateBtn, { backgroundColor: colors.gold }]} onPress={afterLevel}>
          <Text style={[styles.celebrateBtnText, { color: colors.ink }]}>Nice!</Text>
        </Pressable>
      </LinearGradient>
    );
  }

  if (mode === 'badge' && newBadges.length > 0) {
    const [hero, ...others] = newBadges;
    const extra = others.slice(0, 4);
    const rest = others.length - extra.length;
    return (
      <LinearGradient colors={gradients.gold} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.celebrate}>
        <Confetti />
        <Text style={styles.badgeKicker}>{newBadges.length > 1 ? 'NYA MÄRKEN' : 'NYTT MÄRKE'}</Text>

        <Floaty style={{ marginTop: 18 }}>
          <View style={[styles.badgeWinTile, { backgroundColor: hero.tint }]}>
            <Icon name={hero.icon as IconName} size={44} color={hero.color} />
          </View>
        </Floaty>
        <Text style={styles.badgeWinName}>{hero.name}</Text>
        <Text style={styles.badgeWinDesc}>{hero.description}</Text>

        {/* Rare, but a single check-in can complete several at once. */}
        {extra.map((b) => (
          <View key={b.code} style={styles.badgeExtraRow}>
            <View style={[styles.badgeExtraTile, { backgroundColor: b.tint }]}>
              <Icon name={b.icon as IconName} size={20} color={b.color} />
            </View>
            <Text style={styles.badgeExtraName}>{b.name}</Text>
          </View>
        ))}
        {rest > 0 && <Text style={[styles.badgeWinDesc, { marginTop: 8 }]}>+ {rest} till</Text>}

        <Pressable style={[styles.celebrateBtn, { backgroundColor: colors.ink }]} onPress={finish}>
          <Text style={[styles.celebrateBtnText, { color: colors.white }]}>Snyggt!</Text>
        </Pressable>
      </LinearGradient>
    );
  }

  const geoUi = {
    searching: { bg: '#2a2247', title: 'Letar efter din plats…', sub: 'Kontrollerar att du är på gården', icon: 'locate' as const, iconColor: '#7ea6ff' },
    inrange: { bg: 'rgba(34,197,94,0.22)', title: 'Du är på plats', sub: simulateOnSite ? 'Simulerad plats' : `${forening?.name ?? ''} · ${distance != null ? Math.round(distance) + ' m bort' : 'på plats'}`, icon: 'check' as const, iconColor: '#5ef0a0' },
    far: { bg: 'rgba(255,77,141,0.2)', title: 'Du är för långt bort', sub: distance != null ? `${Math.round(distance)} m bort · gå närmare` : 'Gå närmare gården', icon: 'pin' as const, iconColor: '#ff8fb4' },
  }[geo];

  return (
    <View style={[styles.scanRoot, { paddingTop: insets.top + 8 }]}>
      <View style={styles.header}>
        <Pressable style={styles.backBtn} onPress={finish} hitSlop={8}>
          <Icon name="arrowL" size={18} color={colors.white} />
        </Pressable>
        <Text style={styles.headerTitle}>Checka in</Text>
      </View>

      <ScrollView contentContainerStyle={{ paddingBottom: insets.bottom + 20 }} showsVerticalScrollIndicator={false}>
        <View style={[styles.geoCard, { backgroundColor: geoUi.bg }]}>
          <View style={styles.geoIcon}>
            <Icon name={geoUi.icon} size={20} color={geoUi.iconColor} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.geoTitle}>{geoUi.title}</Text>
            <Text style={styles.geoSub}>{geoUi.sub}</Text>
          </View>
          {geo === 'searching' && <ActivityIndicator color="#7ea6ff" />}
        </View>

        {/* QR viewfinder */}
        <View style={styles.viewfinderWrap}>
          <View style={[styles.viewfinder, { opacity: inRange ? 1 : 0.4 }]}>
            {permission?.granted ? (
              <CameraView
                style={StyleSheet.absoluteFill}
                facing="back"
                barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
                onBarcodeScanned={busy ? undefined : (r) => runScan(r.data)}
              />
            ) : (
              <View style={styles.camPlaceholder}>
                <Icon name="camera" size={30} color="rgba(255,255,255,0.5)" />
              </View>
            )}
            <View style={[styles.corner, styles.tl]} />
            <View style={[styles.corner, styles.tr]} />
            <View style={[styles.corner, styles.bl]} />
            <View style={[styles.corner, styles.br]} />
          </View>
          <Text style={styles.scanHint}>{inRange ? 'Rikta kameran mot QR-koden' : 'Lås upp genom att vara på plats'}</Text>
        </View>

        {!permission?.granted && (
          <Pressable style={styles.grantBtn} onPress={requestPermission}>
            <Text style={styles.grantText}>Ge kameraåtkomst</Text>
          </Pressable>
        )}

        {qrActivities.length > 0 && (
          <Pressable
            disabled={!inRange || busy}
            onPress={() => runScan(qrActivities[Math.floor(Math.random() * qrActivities.length)].qr_token)}
            style={{ opacity: !inRange || busy ? 0.5 : 1, marginTop: 6 }}
          >
            <LinearGradient colors={inRange ? gradients.gold : (['#3a2f5c', '#3a2f5c'] as const)} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.cta}>
              {checkin.isPending ? (
                <ActivityIndicator color={colors.ink} />
              ) : (
                <Text style={[styles.ctaText, { color: inRange ? colors.ink : 'rgba(255,255,255,0.5)' }]}>Simulera skanning</Text>
              )}
            </LinearGradient>
          </Pressable>
        )}

        {/* Open activities (no QR) */}
        {(openList ?? []).length > 0 && (
          <View style={{ marginTop: 20 }}>
            <Text style={styles.openHeading}>Öppna incheckningar</Text>
            {(openList ?? []).map((a) => (
              <View key={a.id} style={styles.openRow}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.openTitle}>{a.title}</Text>
                  <Text style={styles.openMeta}>
                    +{a.points}p{a.requires_photo ? ' · foto krävs' : ''}
                    {a.daily_limit > 1 ? ` · ${a.done_today}/${a.daily_limit} idag` : ''}
                  </Text>
                </View>
                <Pressable
                  disabled={!inRange || busy}
                  onPress={() => runOpenCheckin(a)}
                  style={[styles.openBtn, { opacity: !inRange || busy ? 0.5 : 1 }]}
                >
                  {busyId === a.id ? (
                    <ActivityIndicator color={colors.ink} size="small" />
                  ) : (
                    <Text style={styles.openBtnText}>Checka in</Text>
                  )}
                </Pressable>
              </View>
            ))}
          </View>
        )}

        <View style={styles.toggleRow}>
          <Text style={styles.toggleLabel}>Simulera att jag är på plats</Text>
          <Switch value={simulateOnSite} onValueChange={setSimulateOnSite} trackColor={{ true: colors.primary, false: '#4a4468' }} thumbColor={colors.white} />
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  scanRoot: { flex: 1, backgroundColor: colors.overlayDark, paddingHorizontal: 20 },
  header: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 14 },
  backBtn: { width: 36, height: 36, borderRadius: 12, backgroundColor: 'rgba(255,255,255,0.12)', alignItems: 'center', justifyContent: 'center' },
  headerTitle: { fontFamily: font.semibold, fontSize: 16, color: colors.white },

  geoCard: { flexDirection: 'row', alignItems: 'center', gap: 11, padding: 13, borderRadius: 16 },
  geoIcon: { width: 38, height: 38, borderRadius: 12, backgroundColor: 'rgba(255,255,255,0.12)', alignItems: 'center', justifyContent: 'center' },
  geoTitle: { fontFamily: font.semibold, fontSize: 13.5, color: colors.white },
  geoSub: { fontFamily: font.regular, fontSize: 11.5, color: 'rgba(255,255,255,0.7)' },

  viewfinderWrap: { alignItems: 'center', justifyContent: 'center', marginTop: 18 },
  viewfinder: { width: 240, height: 240, borderRadius: 24, overflow: 'hidden', backgroundColor: '#221a3a' },
  camPlaceholder: { ...StyleSheet.absoluteFillObject, alignItems: 'center', justifyContent: 'center' },
  corner: { position: 'absolute', width: 28, height: 28, borderColor: colors.gold },
  tl: { left: 8, top: 8, borderLeftWidth: 4, borderTopWidth: 4, borderTopLeftRadius: 8 },
  tr: { right: 8, top: 8, borderRightWidth: 4, borderTopWidth: 4, borderTopRightRadius: 8 },
  bl: { left: 8, bottom: 8, borderLeftWidth: 4, borderBottomWidth: 4, borderBottomLeftRadius: 8 },
  br: { right: 8, bottom: 8, borderRightWidth: 4, borderBottomWidth: 4, borderBottomRightRadius: 8 },
  scanHint: { fontFamily: font.regular, fontSize: 13, color: '#c9bdf0', textAlign: 'center', marginTop: 14 },

  grantBtn: { alignItems: 'center', paddingVertical: 10 },
  grantText: { fontFamily: font.semibold, fontSize: 13, color: colors.gold, textDecorationLine: 'underline' },
  cta: { borderRadius: 18, paddingVertical: 15, alignItems: 'center', justifyContent: 'center' },
  ctaText: { fontFamily: font.semibold, fontSize: 15 },

  openHeading: { fontFamily: font.semibold, fontSize: 13, color: 'rgba(255,255,255,0.85)', marginBottom: 8 },
  openRow: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: 'rgba(255,255,255,0.08)', borderRadius: 14, padding: 12, marginBottom: 9 },
  openTitle: { fontFamily: font.semibold, fontSize: 13.5, color: colors.white },
  openMeta: { fontFamily: font.regular, fontSize: 11.5, color: 'rgba(255,255,255,0.6)', marginTop: 1 },
  openBtn: { backgroundColor: colors.gold, borderRadius: 12, paddingVertical: 9, paddingHorizontal: 14, minWidth: 92, alignItems: 'center' },
  openBtnText: { fontFamily: font.semibold, fontSize: 12.5, color: colors.ink },

  toggleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 4, marginTop: 20 },
  toggleLabel: { fontFamily: font.medium, fontSize: 12.5, color: 'rgba(255,255,255,0.8)' },

  celebrate: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 30 },
  celebrateTitle: { fontFamily: font.bold, fontSize: 26, color: colors.white, marginTop: 24 },
  celebrateSub: { fontFamily: font.medium, fontSize: 14, color: 'rgba(255,255,255,0.92)', marginTop: 4, textAlign: 'center' },
  chips: { flexDirection: 'row', gap: 14, marginTop: 26 },
  chip: { backgroundColor: 'rgba(255,255,255,0.18)', borderRadius: 18, paddingVertical: 16, paddingHorizontal: 22, alignItems: 'center', minWidth: 92 },
  chipNum: { fontFamily: font.bold, fontSize: 28, color: colors.white },
  chipLabel: { fontFamily: font.regular, fontSize: 11, color: 'rgba(255,255,255,0.9)' },
  celebrateBtn: { marginTop: 32, paddingVertical: 15, paddingHorizontal: 46, borderRadius: 16 },
  celebrateBtnText: { fontFamily: font.semibold, fontSize: 15 },
  levelKicker: { fontFamily: font.semibold, fontSize: 13, letterSpacing: 4, color: 'rgba(255,255,255,0.85)' },
  badgeKicker: { fontFamily: font.semibold, fontSize: 13, letterSpacing: 4, color: 'rgba(44,35,64,0.65)' },
  badgeWinTile: {
    width: 104, height: 104, borderRadius: 30, alignItems: 'center', justifyContent: 'center',
    borderWidth: 4, borderColor: 'rgba(255,255,255,0.7)',
  },
  badgeWinName: { fontFamily: font.bold, fontSize: 24, color: colors.ink, marginTop: 14 },
  badgeWinDesc: { fontFamily: font.medium, fontSize: 13, color: 'rgba(44,35,64,0.72)', marginTop: 3, textAlign: 'center' },
  badgeExtraRow: {
    flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 10,
    backgroundColor: 'rgba(255,255,255,0.55)', borderRadius: 14, paddingVertical: 7, paddingHorizontal: 12,
  },
  badgeExtraTile: { width: 32, height: 32, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  badgeExtraName: { fontFamily: font.semibold, fontSize: 13.5, color: colors.ink },
  levelBig: { fontFamily: font.bold, fontSize: 44, color: colors.white, marginTop: 4 },
  levelName: { fontFamily: font.semibold, fontSize: 16, color: colors.gold, marginTop: 6 },
});
