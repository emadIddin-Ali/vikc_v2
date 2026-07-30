import React, { useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Icon } from '@/components/Icon';
import { PrimaryButton } from '@/components/ui/PrimaryButton';
import { TextField } from '@/components/ui/TextField';
import { useJoinKlassByCode } from '@/hooks/useLarare';
import { authError } from '@/lib/authError';
import type { Child } from '@/lib/types';
import { colors, font, radius } from '@/theme/tokens';
import { type JoinRole, useAuth } from '@/providers/AuthProvider';
import { toast } from '@/store/toast';

type Flik = 'forening' | 'klass';

/**
 * "Anslut med kod" — the one place a member joins something new.
 *
 * Joining used to live only on the sign-up path, so an existing member who was
 * handed a code had nowhere to type it. Both kinds of code look alike to the
 * member, so the sheet asks which one they got instead of guessing and failing.
 */
export function AnslutModal({
  role = 'ungdom',
  barn,
  onClose,
}: {
  /** Role to join a new förening as. A youth stays a youth, a parent a parent. */
  role?: JoinRole;
  /** Parents pick which child joins the class. */
  barn?: Child[];
  onClose: () => void;
}) {
  const insets = useSafeAreaInsets();
  const { joinForeningByCode } = useAuth();
  const joinKlass = useJoinKlassByCode();

  const [flik, setFlik] = useState<Flik>('forening');
  const [kod, setKod] = useState('');
  const [pnr, setPnr] = useState('');
  const [valtBarn, setValtBarn] = useState<string | null>(barn?.length ? barn[0].id : null);
  const [busy, setBusy] = useState(false);
  const [fel, setFel] = useState<string | null>(null);

  const onSubmit = async () => {
    if (!kod.trim()) return;
    setFel(null);

    if (flik === 'klass') {
      joinKlass.mutate(
        { code: kod.trim(), childId: barn?.length ? valtBarn : null },
        { onSuccess: onClose, onError: (e) => setFel(e.message) },
      );
      return;
    }

    setBusy(true);
    const { error } = await joinForeningByCode(kod.trim(), role, pnr.trim() || null);
    setBusy(false);
    if (error) {
      setFel(authError(error));
      return;
    }
    toast('Du är med i föreningen');
    onClose();
  };

  const laddar = busy || joinKlass.isPending;

  return (
    <Modal transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <View style={[styles.sheet, { paddingBottom: insets.bottom + 16 }]}>
          <View style={styles.head}>
            <Pressable onPress={onClose} hitSlop={8}>
              <Text style={styles.cancel}>Avbryt</Text>
            </Pressable>
            <Text style={styles.title}>Anslut med kod</Text>
            <View style={{ width: 48 }} />
          </View>

          <ScrollView
            contentContainerStyle={styles.body}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
            automaticallyAdjustKeyboardInsets
          >
            <Text style={styles.label}>Vad har du fått för kod?</Text>
            <View style={styles.segment}>
              <Flikval
                on={flik === 'forening'}
                icon="org"
                label="Föreningskod"
                hint="Från en ledare"
                onPress={() => { setFlik('forening'); setFel(null); }}
              />
              <Flikval
                on={flik === 'klass'}
                icon="book"
                label="Klasskod"
                hint="Från en lärare"
                onPress={() => { setFlik('klass'); setFel(null); }}
              />
            </View>

            <View style={{ height: 18 }} />

            <TextField
              placeholder={flik === 'forening' ? 'T.ex. CENTRUM' : 'T.ex. 4F2A9C'}
              value={kod}
              onChangeText={(t) => setKod(t.toUpperCase())}
              autoCapitalize="characters"
              autoCorrect={false}
              style={styles.kod}
            />

            {flik === 'forening' ? (
              <>
                <View style={{ height: 10 }} />
                <TextField
                  placeholder="Personnummer (om föreningen kräver det)"
                  value={pnr}
                  onChangeText={setPnr}
                  keyboardType="number-pad"
                  autoCorrect={false}
                />
                <Text style={styles.hint}>
                  Du behåller dina befintliga föreningar — du kan byta mellan dem på profilen.
                </Text>
              </>
            ) : (
              <>
                {!!barn?.length && (
                  <>
                    <Text style={[styles.label, { marginTop: 18 }]}>Vem ska gå med?</Text>
                    <View style={styles.chips}>
                      {barn.map((b) => {
                        const on = valtBarn === b.id;
                        return (
                          <Pressable
                            key={b.id}
                            onPress={() => setValtBarn(b.id)}
                            style={[styles.chip, { backgroundColor: on ? colors.ink : colors.white }]}
                          >
                            <Text style={[styles.chipText, { color: on ? colors.white : colors.muted }]}>
                              {b.display_name}
                            </Text>
                          </Pressable>
                        );
                      })}
                    </View>
                  </>
                )}
                <Text style={styles.hint}>
                  Klasskoden fungerar bara om du redan är med i klassens förening. Gå med i föreningen först.
                </Text>
              </>
            )}

            {fel ? (
              <Text style={styles.error} accessibilityRole="alert" accessibilityLiveRegion="assertive">{fel}</Text>
            ) : null}

            <View style={{ height: 20 }} />
            <PrimaryButton
              label="Gå med"
              loading={laddar}
              disabled={!kod.trim()}
              onPress={onSubmit}
            />
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

function Flikval({
  on, icon, label, hint, onPress,
}: {
  on: boolean;
  icon: 'org' | 'book';
  label: string;
  hint: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={[styles.seg, on && styles.segOn]}
      accessibilityRole="button"
      accessibilityState={{ selected: on }}
    >
      <Icon name={icon} size={18} color={on ? colors.primary : colors.muted} />
      <Text style={[styles.segLabel, on && { color: colors.primary }]}>{label}</Text>
      <Text style={styles.segHint}>{hint}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
  sheet: { backgroundColor: colors.adminBg, borderTopLeftRadius: 24, borderTopRightRadius: 24, paddingTop: 12, maxHeight: '90%' },
  head: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 18, paddingBottom: 10 },
  cancel: { fontFamily: font.medium, fontSize: 14, color: colors.muted, width: 48 },
  title: { fontFamily: font.bold, fontSize: 15, color: colors.ink },
  body: { paddingHorizontal: 18, paddingBottom: 12 },

  label: { fontFamily: font.semibold, fontSize: 13, color: colors.ink, marginBottom: 9 },
  segment: { flexDirection: 'row', gap: 10 },
  seg: {
    flex: 1, borderRadius: radius.md, borderWidth: 1.5, borderColor: colors.inputBorder,
    backgroundColor: colors.white, paddingVertical: 14, paddingHorizontal: 12, gap: 3,
  },
  segOn: { borderColor: colors.primary, backgroundColor: '#f6f2ff' },
  segLabel: { fontFamily: font.semibold, fontSize: 13.5, color: colors.ink, marginTop: 4 },
  segHint: { fontFamily: font.regular, fontSize: 11, color: colors.muted2 },

  kod: { fontSize: 18, letterSpacing: 2, fontFamily: font.semibold },
  hint: { fontFamily: font.regular, fontSize: 11.5, color: colors.muted2, marginTop: 10, lineHeight: 16 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 7 },
  chip: { paddingVertical: 9, paddingHorizontal: 13, borderRadius: 999 },
  chipText: { fontFamily: font.semibold, fontSize: 12.5 },
  error: { fontFamily: font.medium, fontSize: 12.5, color: colors.pink, marginTop: 14, lineHeight: 17 },
});
