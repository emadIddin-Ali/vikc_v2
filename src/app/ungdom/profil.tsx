import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Card } from '@/components/Card';
import { Icon } from '@/components/Icon';
import { Mascot } from '@/components/Mascot';
import { Screen } from '@/components/Screen';
import { PrimaryButton } from '@/components/ui/PrimaryButton';
import { colors, font, radius } from '@/theme/tokens';
import { useAuth } from '@/providers/AuthProvider';

export default function Profil() {
  const { profile, session, memberships, activeMembership, setActiveForeningId, signOut } = useAuth();
  const name = profile?.display_name?.trim() || session?.user?.email?.split('@')[0] || 'Du';

  return (
    <Screen>
      <View style={styles.head}>
        <Mascot size={84} eyes />
        <Text style={styles.name}>{name}</Text>
        <Text style={styles.email}>{session?.user?.email}</Text>
      </View>

      <Text style={styles.section}>Din förening</Text>
      {memberships.map((m) => {
        const active = m.forening_id === activeMembership?.forening_id;
        return (
          <Pressable key={m.id} onPress={() => setActiveForeningId(m.forening_id)}>
            <Card style={[styles.row, active && styles.rowActive]}>
              <View style={[styles.dot, { backgroundColor: m.forening?.color ?? colors.primary }]} />
              <View style={{ flex: 1 }}>
                <Text style={styles.foreningName}>{m.forening?.name ?? 'Förening'}</Text>
                <Text style={styles.roleText}>{m.role === 'ledare' ? 'Ledare' : 'Ungdom'}</Text>
              </View>
              {active && <Icon name="check" size={18} color={colors.green} />}
            </Card>
          </Pressable>
        );
      })}

      <View style={{ marginTop: 22 }}>
        <PrimaryButton label="Logga ut" onPress={signOut} colorsPair={['#2c2340', '#171226'] as const} />
      </View>

      <Text style={styles.note}>Märken, statistik och närvaro byggs i nästa steg.</Text>
    </Screen>
  );
}

const styles = StyleSheet.create({
  head: { alignItems: 'center', gap: 4, marginTop: 6, marginBottom: 8 },
  name: { fontFamily: font.bold, fontSize: 19, color: colors.ink, marginTop: 8 },
  email: { fontFamily: font.regular, fontSize: 12.5, color: colors.muted2 },
  section: { fontFamily: font.semibold, fontSize: 14, color: colors.ink, marginTop: 14, marginBottom: 4 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14, marginTop: 11 },
  rowActive: { borderWidth: 2, borderColor: colors.primary },
  dot: { width: 12, height: 12, borderRadius: 6 },
  foreningName: { fontFamily: font.semibold, fontSize: 13.5, color: colors.ink },
  roleText: { fontFamily: font.regular, fontSize: 11.5, color: colors.muted2 },
  note: { fontFamily: font.regular, fontSize: 12, color: colors.faint, textAlign: 'center', marginTop: 22 },
});
