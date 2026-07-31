import React, { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Card } from '@/components/Card';
import { Icon } from '@/components/Icon';
import { TextField } from '@/components/ui/TextField';
import { Tappable } from '@/components/ui/Tappable';
import { useForening, useTilldelaKlass } from '@/hooks/useLedare';
import { useGodkannLarare, useLedareKlasser, useLedareLarare, useSetStarSettings } from '@/hooks/useLarare';
import { DEFAULT_STAR_XP, klassWhen } from '@/lib/stars';
import { colors, font, radius } from '@/theme/tokens';
import { toast } from '@/store/toast';

/**
 * The ledare's oversight of the teacher role.
 *
 * Three jobs: let teachers in, watch that nobody inflates the currency, and
 * own what a star is actually worth. Teaching itself happens in the teacher's
 * own app surface — this tab never grades anyone.
 */
export function Klasser({ fid }: { fid: string }) {
  const { data: forening } = useForening(fid);
  const { data: larare } = useLedareLarare(fid);
  const { data: klasser } = useLedareKlasser(fid);
  const godkann = useGodkannLarare();
  const saveSettings = useSetStarSettings();
  const tilldela = useTilldelaKlass();

  const [kurva, setKurva] = useState<string[]>(DEFAULT_STAR_XP.map(String));
  const [faktor, setFaktor] = useState('0.5');
  const [tak, setTak] = useState('25');

  useEffect(() => {
    if (!forening) return;
    const c = forening.star_xp?.length === 5 ? forening.star_xp : DEFAULT_STAR_XP;
    setKurva(c.map(String));
    setFaktor(String(forening.star_points_factor ?? 0.5));
    setTak(String(forening.star_max_per_vecka ?? 25));
  }, [forening?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const vantande = (larare ?? []).filter((l) => !l.godkand);
  const aktiva = (larare ?? []).filter((l) => l.godkand);

  const onSaveSettings = () => {
    const values = kurva.map((v) => parseInt(v, 10));
    if (values.some((v) => !Number.isFinite(v) || v < 0)) return toast('Stjärnkurvan måste vara fem tal');
    for (let i = 1; i < values.length; i++) {
      if (values[i] < values[i - 1]) return toast('Kurvan måste stiga — 5★ ska vara värt mest');
    }
    const f = parseFloat(faktor.replace(',', '.'));
    saveSettings.mutate({
      forening: fid,
      starXp: values,
      pointsFactor: Number.isFinite(f) ? f : 0,
      maxVecka: Math.max(parseInt(tak, 10) || 25, 1),
    });
  };

  return (
    <View>
      <View style={styles.info}>
        <Text style={styles.infoTitle}>Klasser och lärare</Text>
        <Text style={styles.infoText}>
          En lärare går med med föreningskoden och väljer rollen Lärare. Behörigheten är spärrad tills du
          godkänner den — läraren ser bara sina egna elever, aldrig registret.
        </Text>
      </View>

      {vantande.length > 0 && (
        <>
          <Text style={styles.section}>Väntar på godkännande</Text>
          {vantande.map((l) => (
            <Card key={l.user_id} style={styles.row}>
              <View style={[styles.avatar, { backgroundColor: l.avatar_color }]}>
                <Text style={styles.avatarText}>{l.name.charAt(0).toUpperCase()}</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.name}>{l.name}</Text>
                <Text style={styles.meta}>Vill undervisa i föreningen</Text>
              </View>
              <Tappable
                scale={0.92}
                style={styles.okBtn}
                disabled={godkann.isPending}
                onPress={() => godkann.mutate({ forening: fid, user: l.user_id, godkann: true })}
              >
                <Icon name="check" size={15} color={colors.white} />
                <Text style={styles.okText}>Godkänn</Text>
              </Tappable>
            </Card>
          ))}
        </>
      )}

      <Text style={styles.section}>Lärare</Text>
      {aktiva.length === 0 ? (
        <Text style={styles.empty}>Ingen godkänd lärare än.</Text>
      ) : (
        aktiva.map((l) => (
          <Card key={l.user_id} style={styles.row}>
            <View style={[styles.avatar, { backgroundColor: l.avatar_color }]}>
              <Text style={styles.avatarText}>{l.name.charAt(0).toUpperCase()}</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.name}>{l.name}</Text>
              <Text style={styles.meta}>
                {l.klasser} {l.klasser === 1 ? 'klass' : 'klasser'} · {l.elever} elever · {l.stjarnor_30d}★ på 30 dagar
                {l.snitt != null ? ` · snitt ${l.snitt}` : ''}
              </Text>
            </View>
            <Tappable
              scale={0.92}
              style={styles.pauseBtn}
              disabled={godkann.isPending}
              onPress={() => godkann.mutate({ forening: fid, user: l.user_id, godkann: false })}
            >
              <Text style={styles.pauseText}>Pausa</Text>
            </Tappable>
          </Card>
        ))
      )}
      {aktiva.length > 0 && (
        <Text style={styles.hint}>
          Snittet är medelbetyget de senaste 30 dagarna. En lärare som ligger nära 5,0 delar ut stjärnor utan
          innebörd — prata med dem innan ni sänker kurvan.
        </Text>
      )}

      <Text style={styles.section}>Klasser</Text>
      {(klasser ?? []).length === 0 ? (
        <Text style={styles.empty}>Inga klasser skapade än.</Text>
      ) : (
        (klasser ?? []).map((k) => (
          <Card key={k.id} style={styles.row}>
            <View style={[styles.dot, { backgroundColor: k.color }]} />
            <View style={{ flex: 1 }}>
              <Text style={styles.name}>{k.name}</Text>
              <Text style={styles.meta}>
                {k.larare} · {klassWhen(k.weekday, k.time_text)} · {k.elever} elever
              </Text>
              <Text style={styles.meta}>
                {k.stjarnor_30d}★ på 30 dagar
                {k.senaste_lektion ? ` · senaste lektion ${k.senaste_lektion}` : ' · ingen lektion hållen'}
              </Text>

              {/* En klass utan lärare (läraren raderade sitt konto) kan ingen
                  hålla lektion i förrän någon tar över den. */}
              {!k.larare_user_id && aktiva.length > 0 && (
                <>
                  <Text style={styles.assignLabel}>Klassen saknar lärare — ge den till:</Text>
                  <View style={styles.pillRow}>
                    {aktiva.map((l) => (
                      <Tappable
                        key={l.user_id}
                        scale={0.94}
                        style={styles.assignPill}
                        disabled={tilldela.isPending}
                        onPress={() => tilldela.mutate({ klass: k.id, larare: l.user_id })}
                      >
                        <Text style={styles.assignPillText}>{l.name.split(' ')[0]}</Text>
                      </Tappable>
                    ))}
                  </View>
                </>
              )}
            </View>
          </Card>
        ))
      )}

      <Text style={styles.section}>Vad en stjärna är värd</Text>
      <Card style={styles.settings}>
        <Text style={styles.label}>XP per stjärnnivå</Text>
        <View style={styles.kurva}>
          {kurva.map((v, i) => (
            <View key={i} style={styles.kurvaCol}>
              <Text style={styles.kurvaLabel}>{i + 1}★</Text>
              <TextField
                value={v}
                onChangeText={(t) => setKurva((k) => k.map((x, j) => (j === i ? t : x)))}
                keyboardType="number-pad"
                style={styles.kurvaInput}
              />
            </View>
          ))}
        </View>
        <Text style={styles.hintTight}>
          Kurvan ska stiga brantare än linjärt — annars är fem 1★ värt lika mycket som en 5★ och betyget
          slutar betyda något.
        </Text>

        <Text style={styles.label}>Poäng till butiken</Text>
        <TextField
          value={faktor}
          onChangeText={setFaktor}
          keyboardType="decimal-pad"
          style={styles.input}
        />
        <Text style={styles.hintTight}>
          Andel av stjärnans XP som också blir butikspoäng, så att eleverna kan handla på marknaden och
          inte bara samla stjärnor. 0,5 (halva) betyder att 3★ ger 110 XP och 55 poäng — en elev med två
          lektioner i veckan tjänar då runt 880 poäng mellan två marknader. 0 = stjärnor ger bara XP.
        </Text>

        <Text style={styles.label}>Veckotak per elev och lärare</Text>
        <TextField value={tak} onChangeText={setTak} keyboardType="number-pad" style={styles.input} />
        <Text style={styles.hintTight}>
          Hur många stjärnor en och samma lärare får ge en och samma elev per vecka.
        </Text>

        <Tappable scale={0.97} style={styles.saveBtn} onPress={onSaveSettings} disabled={saveSettings.isPending}>
          <Text style={styles.saveText}>Spara stjärnvärden</Text>
        </Tappable>
      </Card>
    </View>
  );
}

const styles = StyleSheet.create({
  info: { marginBottom: 4 },
  infoTitle: { fontFamily: font.bold, fontSize: 16, color: colors.ink },
  infoText: { fontFamily: font.regular, fontSize: 12.5, color: colors.muted2, marginTop: 4, lineHeight: 18 },

  section: { fontFamily: font.bold, fontSize: 14.5, color: colors.ink, marginTop: 22, marginBottom: 2 },
  empty: { fontFamily: font.regular, fontSize: 12.5, color: colors.muted2, marginTop: 8 },
  hint: { fontFamily: font.regular, fontSize: 11.5, color: colors.faint, marginTop: 10, lineHeight: 16 },
  hintTight: { fontFamily: font.regular, fontSize: 11.5, color: colors.muted2, marginTop: 6, lineHeight: 16 },

  row: { flexDirection: 'row', alignItems: 'center', gap: 11, marginTop: 10, padding: 12 },
  avatar: { width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center' },
  avatarText: { fontFamily: font.bold, fontSize: 15, color: colors.white },
  dot: { width: 9, height: 38, borderRadius: 5 },
  name: { fontFamily: font.semibold, fontSize: 14, color: colors.ink },
  meta: { fontFamily: font.regular, fontSize: 11.5, color: colors.muted2, marginTop: 2 },

  okBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: colors.green, borderRadius: 12, paddingVertical: 9, paddingHorizontal: 12,
  },
  okText: { fontFamily: font.semibold, fontSize: 12.5, color: colors.white },
  assignLabel: { fontFamily: font.medium, fontSize: 11.5, color: colors.pink, marginTop: 8 },
  pillRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 6 },
  assignPill: { backgroundColor: colors.ink, borderRadius: 999, paddingVertical: 7, paddingHorizontal: 12 },
  assignPillText: { fontFamily: font.semibold, fontSize: 12, color: colors.white },

  pauseBtn: { borderRadius: 12, borderWidth: 1.5, borderColor: colors.inputBorder, paddingVertical: 8, paddingHorizontal: 12 },
  pauseText: { fontFamily: font.semibold, fontSize: 12.5, color: colors.muted },

  settings: { marginTop: 10, padding: 14 },
  label: { fontFamily: font.semibold, fontSize: 13, color: colors.ink, marginTop: 16 },
  input: { marginTop: 8 },
  kurva: { flexDirection: 'row', gap: 7, marginTop: 8 },
  kurvaCol: { flex: 1 },
  kurvaLabel: { fontFamily: font.medium, fontSize: 11, color: colors.muted, textAlign: 'center', marginBottom: 4 },
  kurvaInput: { paddingHorizontal: 6, paddingVertical: 11, textAlign: 'center', fontSize: 14 },
  saveBtn: {
    marginTop: 20, backgroundColor: colors.ink, borderRadius: radius.sm,
    paddingVertical: 13, alignItems: 'center',
  },
  saveText: { fontFamily: font.semibold, fontSize: 13.5, color: colors.white },
});
