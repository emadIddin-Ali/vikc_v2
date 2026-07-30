import * as Location from 'expo-location';
import React, { useState } from 'react';
import { ActivityIndicator, Pressable, StyleProp, StyleSheet, Text, View, ViewStyle } from 'react-native';
import { Icon } from '@/components/Icon';
import { useCheckout, useMyOpenCheckins } from '@/hooks/useCheckin';
import { haptics } from '@/lib/haptics';
import { playSfx } from '@/lib/sfx';
import type { OpenSession } from '@/lib/types';
import { useAuth } from '@/providers/AuthProvider';
import { toast } from '@/store/toast';
import { colors, font } from '@/theme/tokens';

/**
 * Shows the open check-ins the youth still has to check out of, each with a
 * geo-verified "Checka ut" button. Points are awarded on check-out, so this is
 * how the member finally earns them. Renders nothing when there's nothing open.
 *
 * `simulate` (default = dev builds) sends the venue's own coordinates so the
 * server geofence passes without a real GPS fix — mirrors the scan screen.
 * `tone` adapts the colors for a light (home) or dark (scan) background.
 */
export function CheckoutBanner({
  foreningId,
  simulate = __DEV__,
  tone = 'light',
  style,
}: {
  foreningId: string | null;
  simulate?: boolean;
  tone?: 'light' | 'dark';
  style?: StyleProp<ViewStyle>;
}) {
  const { activeMembership } = useAuth();
  const venueLat = activeMembership?.forening?.lat ?? null;
  const venueLng = activeMembership?.forening?.lng ?? null;
  const { data: sessions } = useMyOpenCheckins(foreningId);
  const checkout = useCheckout();
  const [busyId, setBusyId] = useState<string | null>(null);

  const open = sessions ?? [];
  if (open.length === 0) return null;

  const dark = tone === 'dark';

  const runCheckout = async (s: OpenSession) => {
    if (busyId) return;
    setBusyId(s.id);
    try {
      let lat: number | null;
      let lng: number | null;
      let accuracy: number | null = null;

      if (simulate) {
        lat = s.lat ?? venueLat;
        lng = s.lng ?? venueLng;
      } else {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== 'granted') {
          toast('Tillåt plats för att checka ut.');
          return;
        }
        const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
        lat = pos.coords.latitude;
        lng = pos.coords.longitude;
        accuracy = pos.coords.accuracy ?? null;
      }

      checkout.mutate(
        { activityId: s.activity_id, lat, lng, accuracy },
        {
          onSuccess: (data) => {
            haptics.success();
            playSfx('checkin');
            toast(`Utcheckad! +${data.awarded_points} poäng${data.leveled_up ? ` · Nivå ${data.level}!` : ''}`);
          },
          onError: (e) => toast(e.message),
        },
      );
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Kunde inte checka ut');
    } finally {
      setBusyId(null);
    }
  };

  return (
    <View style={[styles.wrap, style]}>
      {open.map((s) => (
        <View key={s.id} style={[styles.card, dark ? styles.cardDark : styles.cardLight]}>
          <View style={[styles.dot, dark ? styles.dotDark : styles.dotLight]}>
            <Icon name="check" size={18} color={dark ? '#5ef0a0' : colors.green} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={[styles.title, dark && { color: colors.white }]}>Du är incheckad</Text>
            <Text style={[styles.sub, dark && { color: 'rgba(255,255,255,0.7)' }]} numberOfLines={1}>
              {s.title} · checka ut för +{s.points} poäng
            </Text>
          </View>
          <Pressable
            onPress={() => runCheckout(s)}
            disabled={busyId === s.id || checkout.isPending}
            style={[styles.btn, { opacity: busyId === s.id ? 0.6 : 1 }]}
          >
            {busyId === s.id ? (
              <ActivityIndicator size="small" color={colors.white} />
            ) : (
              <Text style={styles.btnText}>Checka ut</Text>
            )}
          </Pressable>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 9 },
  card: { flexDirection: 'row', alignItems: 'center', gap: 11, borderRadius: 16, padding: 12 },
  cardLight: { backgroundColor: '#dcfce7', borderWidth: 1, borderColor: '#bbf7d0' },
  cardDark: { backgroundColor: 'rgba(34,197,94,0.16)', borderWidth: 1, borderColor: 'rgba(94,240,160,0.3)' },
  dot: { width: 38, height: 38, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  dotLight: { backgroundColor: colors.white },
  dotDark: { backgroundColor: 'rgba(255,255,255,0.1)' },
  title: { fontFamily: font.semibold, fontSize: 13.5, color: colors.ink },
  sub: { fontFamily: font.regular, fontSize: 11.5, color: '#3f7a52', marginTop: 1 },
  btn: { backgroundColor: colors.green, borderRadius: 12, paddingVertical: 9, paddingHorizontal: 14, minWidth: 92, alignItems: 'center' },
  btnText: { fontFamily: font.semibold, fontSize: 12.5, color: colors.white },
});
