import React, { useMemo, useState } from 'react';
import { ActivityIndicator, Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Icon } from '@/components/Icon';
import { TextField } from '@/components/ui/TextField';
import { Tappable } from '@/components/ui/Tappable';
import { useAddKlassElev, useForeningElever, useRemoveKlassElev } from '@/hooks/useLarare';
import type { ForeningElev } from '@/lib/types';
import { colors, font, radius } from '@/theme/tokens';

/**
 * The class roster: one list of everyone in the förening where the students in
 * this class are ticked. Tapping a row adds or removes them.
 *
 * The list is deliberately thin — name, avatar and birth year. No contact
 * details and never a personnummer: that register belongs to the ledare, and a
 * teacher has no business browsing it to staff a class.
 */
export function ElevlistaModal({
  klass,
  klassName,
  forening,
  onClose,
}: {
  klass: string;
  klassName: string;
  forening: string;
  onClose: () => void;
}) {
  const insets = useSafeAreaInsets();
  const [query, setQuery] = useState('');
  const [visaAlla, setVisaAlla] = useState(false);
  const { data: elever, isLoading } = useForeningElever(forening, query, klass);
  const add = useAddKlassElev();
  const remove = useRemoveKlassElev();

  const rows = useMemo(() => elever ?? [], [elever]);
  const iKlassen = useMemo(() => rows.filter((e) => e.klass_elev_id), [rows]);
  const ovriga = useMemo(() => rows.filter((e) => !e.klass_elev_id), [rows]);
  const busy = add.isPending || remove.isPending;

  const toggle = (e: ForeningElev) => {
    if (e.klass_elev_id) remove.mutate(e.klass_elev_id);
    else add.mutate({ klass, userId: e.user_id, childId: e.child_id, name: e.name });
  };

  // The whole förening can be long. Until the teacher searches or asks for it,
  // show the class first and a slice of the rest — a wall of 200 names is not
  // a roster, it's a scroll.
  const synligaOvriga = query.trim() || visaAlla ? ovriga : ovriga.slice(0, 12);

  return (
    <Modal transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <View style={[styles.sheet, { paddingBottom: insets.bottom + 16 }]}>
          <View style={styles.head}>
            <View style={{ width: 44 }} />
            <View style={{ flex: 1 }}>
              <Text style={styles.title} numberOfLines={1}>Elever</Text>
              <Text style={styles.subtitle} numberOfLines={1}>{klassName}</Text>
            </View>
            <Pressable onPress={onClose} hitSlop={8}>
              <Text style={styles.done}>Klar</Text>
            </Pressable>
          </View>

          <View style={styles.searchWrap}>
            <TextField placeholder="Sök namn" value={query} onChangeText={setQuery} autoCorrect={false} />
          </View>

          <ScrollView
            contentContainerStyle={styles.body}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            {isLoading && <ActivityIndicator color={colors.primary} style={{ marginTop: 20 }} />}

            {!isLoading && rows.length === 0 && (
              <Text style={styles.empty}>
                {query.trim() ? 'Ingen träff i föreningen.' : 'Föreningen har inga medlemmar att lägga till än.'}
              </Text>
            )}

            {iKlassen.length > 0 && (
              <>
                <Text style={styles.groupLabel}>I klassen ({iKlassen.length})</Text>
                {iKlassen.map((e) => (
                  <ElevRad key={`in-${e.user_id ?? e.child_id}`} elev={e} busy={busy} onPress={() => toggle(e)} />
                ))}
              </>
            )}

            {synligaOvriga.length > 0 && (
              <>
                <Text style={styles.groupLabel}>
                  {iKlassen.length > 0 ? 'Övriga i föreningen' : 'I föreningen'}
                </Text>
                {synligaOvriga.map((e) => (
                  <ElevRad key={`out-${e.user_id ?? e.child_id}`} elev={e} busy={busy} onPress={() => toggle(e)} />
                ))}
              </>
            )}

            {!query.trim() && !visaAlla && ovriga.length > synligaOvriga.length && (
              <Pressable onPress={() => setVisaAlla(true)} style={styles.moreBtn}>
                <Text style={styles.moreText}>Visa alla {ovriga.length} till</Text>
              </Pressable>
            )}

            <Text style={styles.note}>
              Eleven — eller förälderns konto för ett barn — får en notis när du lägger till dem, med
              möjlighet att säga ifrån. Stjärnhistoriken finns kvar om du tar bort någon.
            </Text>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

function ElevRad({ elev, busy, onPress }: { elev: ForeningElev; busy: boolean; onPress: () => void }) {
  const inne = !!elev.klass_elev_id;
  return (
    <Tappable scale={0.98} style={[styles.row, inne && styles.rowOn]} disabled={busy} onPress={onPress}>
      <View style={[styles.avatar, { backgroundColor: elev.avatar_color }]}>
        <Text style={styles.avatarText}>{elev.name.charAt(0).toUpperCase()}</Text>
      </View>
      <View style={{ flex: 1 }}>
        <Text style={styles.name} numberOfLines={1}>{elev.name}</Text>
        <Text style={styles.meta}>
          {elev.kind === 'barn' ? 'Barn' : 'Medlem'}
          {elev.birth_year ? ` · ${elev.birth_year}` : ''}
          {!inne && elev.i_min_klass ? ' · i en annan av dina klasser' : ''}
        </Text>
      </View>
      <View style={[styles.check, inne ? styles.checkOn : styles.checkOff]}>
        <Icon name={inne ? 'check' : 'user'} size={15} color={inne ? colors.white : colors.muted} />
      </View>
    </Tappable>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
  sheet: { backgroundColor: colors.adminBg, borderTopLeftRadius: 24, borderTopRightRadius: 24, paddingTop: 12, height: '88%' },
  head: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 18, paddingBottom: 10 },
  title: { fontFamily: font.bold, fontSize: 15, color: colors.ink, textAlign: 'center' },
  subtitle: { fontFamily: font.regular, fontSize: 11.5, color: colors.muted2, textAlign: 'center' },
  done: { fontFamily: font.semibold, fontSize: 14, color: colors.primary, width: 44, textAlign: 'right' },
  searchWrap: { paddingHorizontal: 18, paddingBottom: 8 },
  body: { paddingHorizontal: 18, paddingBottom: 20 },
  empty: { fontFamily: font.regular, fontSize: 13, color: colors.muted2, textAlign: 'center', marginTop: 26 },

  groupLabel: { fontFamily: font.semibold, fontSize: 12, color: colors.muted, marginTop: 16, marginBottom: 2 },
  row: {
    flexDirection: 'row', alignItems: 'center', gap: 11, marginTop: 8,
    backgroundColor: colors.white, borderRadius: radius.md, padding: 11,
    borderWidth: 1.5, borderColor: 'transparent',
  },
  rowOn: { borderColor: colors.green },
  avatar: { width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center' },
  avatarText: { fontFamily: font.bold, fontSize: 15, color: colors.white },
  name: { fontFamily: font.semibold, fontSize: 14, color: colors.ink },
  meta: { fontFamily: font.regular, fontSize: 11.5, color: colors.muted2, marginTop: 1 },
  check: { width: 34, height: 34, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  checkOn: { backgroundColor: colors.green },
  checkOff: { backgroundColor: colors.adminBg },

  moreBtn: { marginTop: 12, paddingVertical: 11, alignItems: 'center' },
  moreText: { fontFamily: font.semibold, fontSize: 13, color: colors.primary },
  note: { fontFamily: font.regular, fontSize: 11.5, color: colors.faint, marginTop: 18, lineHeight: 16, textAlign: 'center' },
});
