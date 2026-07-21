import { LinearGradient } from 'expo-linear-gradient';
import * as Location from 'expo-location';
import React, { useMemo, useRef, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Switch, Text, View } from 'react-native';
import { ActivityQR } from '@/components/ActivityQR';
import { Card } from '@/components/Card';
import { DateTimeField } from '@/components/DateTimeField';
import { Icon, IconName } from '@/components/Icon';
import { MapPicker, MapPickerHandle } from '@/components/MapPicker';
import { Tappable } from '@/components/ui/Tappable';
import { TextField } from '@/components/ui/TextField';
import { EditActivity } from '@/features/ledare/EditActivity';
import { dateKey, dayHeading, fmtDateTime, fmtTime } from '@/lib/date';
import type { Activity } from '@/lib/types';
import { toast } from '@/store/toast';
import { useLedareActivities, usePublishActivity, useSetForeningLocation, useSetForeningTheme } from '@/hooks/useLedare';
import { useBrandGradient } from '@/hooks/useBrandGradient';
import { APP_THEMES, DEFAULT_THEME, THEMES, activityTheme, colors, font, gradients } from '@/theme/tokens';
import type { AppThemeId } from '@/theme/tokens';
import { useAuth } from '@/providers/AuthProvider';

const THEME_IDS = Object.keys(THEMES);

function Seg<T extends string>({ value, options, onChange }: {
  value: T; options: { v: T; label: string }[]; onChange: (v: T) => void;
}) {
  return (
    <View style={styles.segRow}>
      {options.map((o) => (
        <Pressable
          key={o.v}
          onPress={() => onChange(o.v)}
          style={[styles.segPill, { backgroundColor: value === o.v ? colors.ink : colors.white }]}
        >
          <Text style={[styles.segText, { color: value === o.v ? colors.white : colors.muted }]}>{o.label}</Text>
        </Pressable>
      ))}
    </View>
  );
}

function Badge({ text, ink }: { text: string; ink: string }) {
  return (
    <View style={styles.badge}>
      <Text style={[styles.badgeText, { color: ink }]}>{text}</Text>
    </View>
  );
}

export function Aktiviteter({ fid }: { fid: string }) {
  const brand = useBrandGradient();
  const { activeForening, refresh } = useAuth();
  const forening = activeForening;
  const { data: activities } = useLedareActivities(fid);
  const publish = usePublishActivity();
  const setLoc = useSetForeningLocation();
  const setAppTheme = useSetForeningTheme();
  const mapRef = useRef<MapPickerHandle>(null);

  const [title, setTitle] = useState('');
  const [points, setPoints] = useState('');
  const [kind, setKind] = useState<'event' | 'continuous'>('event');
  const [startsAt, setStartsAt] = useState<Date | null>(null);
  const [mode, setMode] = useState<'qr' | 'open'>('qr');
  const [requiresPhoto, setRequiresPhoto] = useState(false);
  const [theme, setTheme] = useState('fika');
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [locating, setLocating] = useState(false);
  const [durationMin, setDurationMin] = useState('');
  const [dailyLimit, setDailyLimit] = useState('');
  const [activityRadius, setActivityRadius] = useState('');
  const [venueRadius, setVenueRadius] = useState('');
  const [settingLoc, setSettingLoc] = useState(false);
  const [qrActivity, setQrActivity] = useState<Activity | null>(null);
  const [editActivity, setEditActivity] = useState<Activity | null>(null);

  const mapCenter = useMemo(
    () =>
      forening?.lat != null && forening?.lng != null
        ? { lat: forening.lat, lng: forening.lng }
        : { lat: 59.3293, lng: 18.0686 },
    [forening?.lat, forening?.lng],
  );

  const useMyLocation = async () => {
    setLocating(true);
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Plats nekad', 'Tillåt plats, eller peka ut platsen på kartan.');
        return;
      }
      const pos = await Location.getCurrentPositionAsync({});
      const c = { lat: pos.coords.latitude, lng: pos.coords.longitude };
      setCoords(c);
      mapRef.current?.goTo(c);
    } finally {
      setLocating(false);
    }
  };

  const setForeningToMyLocation = async () => {
    if (!forening) return;
    setSettingLoc(true);
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Plats nekad', 'Tillåt plats för att sätta föreningens plats.');
        return;
      }
      const pos = await Location.getCurrentPositionAsync({});
      setLoc.mutate(
        { forening: fid, lat: pos.coords.latitude, lng: pos.coords.longitude, radius: parseInt(venueRadius) || null },
        { onSuccess: () => { setVenueRadius(''); refresh(); } },
      );
    } finally {
      setSettingLoc(false);
    }
  };

  const onPublish = () => {
    if (!title.trim()) return toast('Skriv ett namn');
    if (kind === 'event' && !startsAt) return toast('Välj en tid');
    if (mode === 'open' && !coords) return toast('Öppna aktiviteter kräver en plats');

    const whenLabel = kind === 'continuous' ? 'Alltid öppen' : startsAt ? fmtDateTime(startsAt) : '';
    publish.mutate(
      {
        forening: fid,
        title,
        when: whenLabel,
        points: parseInt(points) || 30,
        place: coords ? 'Kartnål satt' : '',
        theme,
        lat: coords?.lat ?? null,
        lng: coords?.lng ?? null,
        startsAt: kind === 'event' && startsAt ? startsAt.toISOString() : null,
        continuous: kind === 'continuous',
        checkinMode: mode,
        requiresPhoto: mode === 'open' ? requiresPhoto : false,
        durationMin: kind === 'event' && durationMin ? parseInt(durationMin) : null,
        dailyLimit: parseInt(dailyLimit) || 1,
        radiusM: activityRadius ? parseInt(activityRadius) : null,
      },
      {
        onSuccess: () => {
          setTitle('');
          setPoints('');
          setKind('event');
          setStartsAt(null);
          setMode('qr');
          setRequiresPhoto(false);
          setTheme('fika');
          setCoords(null);
          setDurationMin('');
          setDailyLimit('');
          setActivityRadius('');
        },
      },
    );
  };

  const prev = activityTheme(theme);
  const groups = useMemo(() => {
    const list = activities ?? [];
    const continuous = list.filter((a) => a.continuous);
    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);
    const events = list
      .filter((a) => !a.continuous && a.starts_at)
      .map((a) => ({ a, d: new Date(a.starts_at as string) }))
      .filter((x) => x.d.getTime() >= startOfToday.getTime())
      .sort((x, y) => x.d.getTime() - y.d.getTime());
    const byDay: { key: string; date: Date; items: Activity[] }[] = [];
    for (const x of events) {
      const key = dateKey(x.d);
      let g = byDay.find((gg) => gg.key === key);
      if (!g) {
        g = { key, date: x.d, items: [] };
        byDay.push(g);
      }
      g.items.push(x.a);
    }
    const undated = list.filter((a) => !a.continuous && !a.starts_at);
    return { continuous, byDay, undated };
  }, [activities]);

  const renderActivity = (a: Activity, timeLabel: string) => {
    const t = activityTheme(a.theme);
    return (
      <LinearGradient key={a.id} colors={t.bg} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.actCard}>
        <Pressable onPress={() => setEditActivity(a)} style={styles.actMain}>
          <View style={styles.actIcon}>
            <Icon name={t.icon as IconName} size={22} color={t.accent} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={[styles.actTitle, { color: t.ink }]}>{a.title}</Text>
            <Text style={[styles.actMeta, { color: t.ink }]}>{timeLabel} · +{a.points}p · tryck för att ändra</Text>
            <View style={styles.badges}>
              <Badge text={a.checkin_mode === 'open' ? 'Öppen' : 'QR'} ink={t.ink} />
              {a.requires_photo && <Badge text="Foto" ink={t.ink} />}
            </View>
          </View>
        </Pressable>
        {a.checkin_mode === 'qr' && (
          <Pressable onPress={() => setQrActivity(a)} style={styles.qrBtn}>
            <Icon name="camera" size={14} color={t.ink} />
            <Text style={[styles.qrBtnText, { color: t.ink }]}>Visa QR</Text>
          </Pressable>
        )}
      </LinearGradient>
    );
  };

  return (
    <View>
      <View style={styles.info}>
        <Text style={styles.infoTitle}>Aktivitet vs uppdrag</Text>
        <Text style={styles.infoText}>
          En <Text style={styles.b}>aktivitet</Text> är ett tillfälle ungdomarna checkar in på (QR eller plats) för poäng — t.ex. "Kvällsfik" eller "Besök moskén". För återkommande <Text style={styles.b}>utmaningar</Text> (t.ex. "Besök 5 gånger") använder du fliken Uppdrag.
        </Text>
      </View>

      <Card style={styles.locCard}>
        <View style={styles.locHead}>
          <Text style={styles.formTitle}>Föreningens plats</Text>
          <Text style={[styles.status, { color: forening?.lat != null ? colors.green : colors.pink }]}>
            {forening?.lat != null ? `Satt · ${forening.geofence_radius_m} m` : 'Ej satt'}
          </Text>
        </View>
        <Text style={styles.locHint}>Används för geo-incheckning. Stå på plats och tryck nedan.</Text>
        <TextField
          placeholder={`Radie i meter (nu ${forening?.geofence_radius_m ?? 120})`}
          value={venueRadius}
          onChangeText={setVenueRadius}
          keyboardType="number-pad"
          style={{ marginTop: 10 }}
        />
        <Pressable onPress={setForeningToMyLocation} style={styles.locBtn}>
          <Icon name="locate" size={18} color={colors.primary} />
          <Text style={styles.locText}>{settingLoc ? 'Sparar…' : 'Använd min plats som föreningens plats'}</Text>
        </Pressable>
      </Card>

      <Card style={styles.locCard}>
        <Text style={styles.formTitle}>Appens tema</Text>
        <Text style={styles.locHint}>
          Färgen ungdomarna i {forening?.name ?? 'föreningen'} ser. Gäller bara den här föreningen.
        </Text>
        <View style={styles.appThemeRow}>
          {(Object.keys(APP_THEMES) as AppThemeId[]).map((id) => {
            const active = (forening?.theme ?? DEFAULT_THEME) === id;
            return (
              <Tappable
                key={id}
                containerStyle={{ flex: 1 }}
                scale={0.94}
                disabled={setAppTheme.isPending}
                onPress={() => setAppTheme.mutate({ forening: fid, theme: id })}
              >
                <LinearGradient
                  colors={APP_THEMES[id].gradient}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={[styles.appThemeSwatch, active && styles.appThemeSwatchActive]}
                >
                  {active && <Icon name="check" size={20} color={colors.white} />}
                </LinearGradient>
                <Text style={[styles.appThemeName, active && { color: colors.ink }]}>{APP_THEMES[id].name}</Text>
              </Tappable>
            );
          })}
        </View>
      </Card>

      <Card style={styles.form}>
        <Text style={styles.formTitle}>Ny aktivitet</Text>
        <TextField placeholder="Namn, t.ex. Fotbollskväll" value={title} onChangeText={setTitle} style={styles.input} />
        <TextField placeholder="Poäng" value={points} onChangeText={setPoints} keyboardType="number-pad" style={styles.input} />

        <Text style={styles.label}>Typ</Text>
        <Seg value={kind} onChange={setKind} options={[{ v: 'event', label: 'Enstaka (med tid)' }, { v: 'continuous', label: 'Kontinuerlig' }]} />

        {kind === 'event' && (
          <View style={{ marginTop: 8 }}>
            <DateTimeField value={startsAt} onChange={setStartsAt} />
            <TextField
              placeholder="Incheckningstid (min), t.ex. 60"
              value={durationMin}
              onChangeText={setDurationMin}
              keyboardType="number-pad"
              style={{ marginTop: 10 }}
            />
          </View>
        )}

        <Text style={styles.label}>Incheckning</Text>
        <Seg value={mode} onChange={setMode} options={[{ v: 'qr', label: 'QR-kod' }, { v: 'open', label: 'Öppen (utan QR)' }]} />

        {mode === 'open' && (
          <View style={styles.switchRow}>
            <Text style={styles.switchLabel}>Kräv foto på plats</Text>
            <Switch value={requiresPhoto} onValueChange={setRequiresPhoto} trackColor={{ true: colors.primary, false: '#d9d2ec' }} thumbColor={colors.white} />
          </View>
        )}

        <Text style={styles.label}>Max incheckningar per dag</Text>
        <TextField
          placeholder="1 (t.ex. 5 för dagliga böner)"
          value={dailyLimit}
          onChangeText={setDailyLimit}
          keyboardType="number-pad"
          style={{ marginTop: 8 }}
        />

        <View style={styles.labelRow}>
          <Text style={styles.label}>Incheckningsplats (valfri)</Text>
          <Text style={[styles.status, { color: coords ? colors.green : colors.muted2 }]}>{coords ? 'Plats satt ✓' : mode === 'open' ? 'Krävs' : 'Annars föreningens'}</Text>
        </View>
        <View style={{ marginTop: 8 }}>
          <MapPicker ref={mapRef} center={mapCenter} value={coords} onChange={setCoords} />
        </View>
        <Pressable onPress={useMyLocation} style={styles.locBtn}>
          <Icon name="locate" size={18} color={colors.primary} />
          <Text style={styles.locText}>{locating ? 'Hämtar plats…' : 'Använd min plats'}</Text>
        </Pressable>
        <TextField
          placeholder={`Radie i meter (annars föreningens ${forening?.geofence_radius_m ?? 120})`}
          value={activityRadius}
          onChangeText={setActivityRadius}
          keyboardType="number-pad"
          style={{ marginTop: 10 }}
        />

        <View style={styles.labelRow}>
          <Text style={styles.label}>Bakgrundsmall</Text>
          <Text style={styles.hint}>Syns för ungdomarna</Text>
        </View>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.themes}>
          {THEME_IDS.map((id) => {
            const t = THEMES[id];
            const sel = theme === id;
            return (
              <Pressable key={id} onPress={() => setTheme(id)} style={styles.themeCol}>
                <LinearGradient colors={t.bg} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={[styles.swatch, { borderColor: sel ? colors.ink : 'transparent' }]}>
                  {sel && (
                    <View style={styles.swatchCheck}>
                      <Icon name="check" size={12} color={colors.ink} />
                    </View>
                  )}
                </LinearGradient>
                <Text style={styles.themeName}>{t.name}</Text>
              </Pressable>
            );
          })}
        </ScrollView>

        <Text style={styles.previewLabel}>Förhandsvisning</Text>
        <LinearGradient colors={prev.bg} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.preview}>
          <Text style={[styles.previewTitle, { color: prev.ink }]}>{title.trim() || 'Aktivitetens namn'}</Text>
          <Text style={[styles.previewMeta, { color: prev.ink }]}>
            {kind === 'continuous' ? 'Alltid öppen' : startsAt ? fmtDateTime(startsAt) : 'Tid'} · +{parseInt(points) || 30}p
          </Text>
        </LinearGradient>

        <Pressable disabled={publish.isPending} onPress={onPublish}>
          <LinearGradient colors={brand} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.publishBtn}>
            <Text style={styles.publishText}>Lägg upp aktivitet</Text>
          </LinearGradient>
        </Pressable>
      </Card>

      {/* Agenda */}
      {groups.continuous.length > 0 && (
        <>
          <Text style={styles.section}>Kontinuerliga</Text>
          {groups.continuous.map((a) => renderActivity(a, 'Alltid öppen'))}
        </>
      )}
      {groups.byDay.map((g) => (
        <View key={g.key}>
          <Text style={styles.section}>{dayHeading(g.date)}</Text>
          {g.items.map((a) => renderActivity(a, fmtTime(new Date(a.starts_at as string))))}
        </View>
      ))}
      {groups.undated.length > 0 && (
        <>
          <Text style={styles.section}>Utan tid</Text>
          {groups.undated.map((a) => renderActivity(a, a.when_text || 'Ingen tid'))}
        </>
      )}
      {groups.continuous.length === 0 && groups.byDay.length === 0 && groups.undated.length === 0 && (
        <Text style={styles.empty}>Inga aktiviteter än — lägg upp din första ovan.</Text>
      )}

      {qrActivity && (
        <ActivityQR token={qrActivity.qr_token} title={qrActivity.title} onClose={() => setQrActivity(null)} />
      )}
      {editActivity && (
        <EditActivity activity={editActivity} onClose={() => setEditActivity(null)} />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  form: { padding: 15 },
  info: { backgroundColor: '#ece9ff', borderRadius: 16, padding: 14, marginBottom: 12 },
  infoTitle: { fontFamily: font.semibold, fontSize: 13, color: colors.ink },
  infoText: { fontFamily: font.regular, fontSize: 12, color: '#5b4b86', lineHeight: 17, marginTop: 3 },
  b: { fontFamily: font.semibold },
  locCard: { padding: 15, marginBottom: 12 },
  locHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  locHint: { fontFamily: font.regular, fontSize: 11.5, color: colors.muted2, marginTop: 4 },

  appThemeRow: { flexDirection: 'row', gap: 10, marginTop: 12 },
  appThemeSwatch: {
    height: 58, borderRadius: 16, alignItems: 'center', justifyContent: 'center',
    borderWidth: 3, borderColor: 'transparent',
  },
  appThemeSwatchActive: { borderColor: colors.ink },
  appThemeName: {
    fontFamily: font.medium, fontSize: 11.5, color: colors.muted2,
    textAlign: 'center', marginTop: 5,
  },
  formTitle: { fontFamily: font.semibold, fontSize: 14, color: colors.ink },
  input: { marginTop: 10 },

  label: { fontFamily: font.semibold, fontSize: 12.5, color: colors.ink, marginTop: 14 },
  labelRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 14 },
  status: { fontFamily: font.medium, fontSize: 11 },
  hint: { fontFamily: font.medium, fontSize: 11, color: colors.muted2 },

  segRow: { flexDirection: 'row', gap: 8, marginTop: 8 },
  segPill: { flex: 1, paddingVertical: 10, borderRadius: 12, borderWidth: 1.5, borderColor: colors.inputBorder, alignItems: 'center' },
  segText: { fontFamily: font.semibold, fontSize: 12.5 },

  timeBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 8, paddingVertical: 12,
    borderRadius: 12, borderWidth: 1.5, borderColor: colors.inputBorder, justifyContent: 'center',
  },
  timeText: { fontFamily: font.semibold, fontSize: 13, color: colors.primary },

  switchRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 12 },
  switchLabel: { fontFamily: font.medium, fontSize: 13, color: colors.ink },

  locBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 8, paddingVertical: 12,
    borderRadius: 12, borderWidth: 1.5, borderColor: colors.inputBorder, justifyContent: 'center',
  },
  locText: { fontFamily: font.semibold, fontSize: 13, color: colors.primary },

  themes: { gap: 9, paddingVertical: 9 },
  themeCol: { width: 64, alignItems: 'center' },
  swatch: { width: '100%', height: 52, borderRadius: 13, borderWidth: 2.5, alignItems: 'flex-start' },
  swatchCheck: { margin: 4, width: 18, height: 18, borderRadius: 9, backgroundColor: colors.white, alignItems: 'center', justifyContent: 'center' },
  themeName: { fontFamily: font.regular, fontSize: 10, color: '#7c6da0', marginTop: 4 },

  previewLabel: { fontFamily: font.semibold, fontSize: 11, color: colors.muted2, marginTop: 14 },
  preview: { marginTop: 7, borderRadius: 16, padding: 15, minHeight: 66, justifyContent: 'center' },
  previewTitle: { fontFamily: font.bold, fontSize: 14 },
  previewMeta: { fontFamily: font.regular, fontSize: 11.5, marginTop: 2, opacity: 0.85 },

  publishBtn: { marginTop: 14, paddingVertical: 12, borderRadius: 13, alignItems: 'center' },
  publishText: { fontFamily: font.semibold, fontSize: 13.5, color: colors.white },

  section: { fontFamily: font.semibold, fontSize: 14, color: colors.ink, marginTop: 18, marginBottom: 2 },
  actCard: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14, borderRadius: 18, marginTop: 9 },
  actMain: { flexDirection: 'row', alignItems: 'center', gap: 12, flex: 1 },
  actIcon: { width: 44, height: 44, borderRadius: 13, backgroundColor: 'rgba(255,255,255,0.65)', alignItems: 'center', justifyContent: 'center' },
  actTitle: { fontFamily: font.bold, fontSize: 13.5 },
  actMeta: { fontFamily: font.regular, fontSize: 11.5, opacity: 0.85, marginTop: 1 },
  badges: { flexDirection: 'row', gap: 6, marginTop: 6 },
  badge: { backgroundColor: 'rgba(255,255,255,0.6)', borderRadius: 7, paddingHorizontal: 7, paddingVertical: 2 },
  badgeText: { fontFamily: font.semibold, fontSize: 9.5 },
  qrBtn: { alignItems: 'center', gap: 2, backgroundColor: 'rgba(255,255,255,0.7)', borderRadius: 10, paddingVertical: 6, paddingHorizontal: 8 },
  qrBtnText: { fontFamily: font.semibold, fontSize: 10 },

  empty: { fontFamily: font.regular, fontSize: 12.5, color: colors.muted2, marginTop: 14 },
});
