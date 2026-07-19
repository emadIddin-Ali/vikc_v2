import React, { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Card } from '@/components/Card';
import { Icon } from '@/components/Icon';
import { useLedareActivities, useLedareYouth, useMarkPresent } from '@/hooks/useLedare';
import { colors, font } from '@/theme/tokens';

export function Narvaro({ fid }: { fid: string }) {
  const [activityId, setActivityId] = useState<string | null>(null);
  const { data: activities } = useLedareActivities(fid);
  const { data: youth } = useLedareYouth(fid, activityId);
  const mark = useMarkPresent();

  const selected = activities?.find((a) => a.id === activityId) ?? null;
  const points = selected ? selected.points : 30;

  return (
    <View>
      <Text style={styles.context}>Välj aktivitet och markera vilka som är på plats. +{points}p delas ut direkt.</Text>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
        <Pressable
          onPress={() => setActivityId(null)}
          style={[styles.chip, { backgroundColor: activityId === null ? colors.ink : colors.white }]}
        >
          <Text style={[styles.chipText, { color: activityId === null ? colors.white : colors.muted }]}>Fri närvaro · +30p</Text>
        </Pressable>
        {(activities ?? []).map((a) => (
          <Pressable
            key={a.id}
            onPress={() => setActivityId(a.id)}
            style={[styles.chip, { backgroundColor: activityId === a.id ? colors.ink : colors.white }]}
          >
            <Text
              style={[styles.chipText, { color: activityId === a.id ? colors.white : colors.muted }]}
              numberOfLines={1}
            >
              {a.title} · +{a.points}p
            </Text>
          </Pressable>
        ))}
      </ScrollView>

      {(youth ?? []).map((y) => (
        <Card key={y.user_id} style={styles.row}>
          <View style={[styles.avatar, { backgroundColor: y.avatar_color }]}>
            <Text style={styles.avatarText}>{y.name.charAt(0).toUpperCase()}</Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.name}>{y.name}</Text>
            <Text style={styles.sub}>{y.visits} besök</Text>
          </View>
          {y.present_today ? (
            <View style={[styles.markBtn, { backgroundColor: colors.tintGreen }]}>
              <Icon name="check" size={14} color={colors.green2} />
              <Text style={[styles.markText, { color: colors.green2, marginLeft: 4 }]}>+{points}p</Text>
            </View>
          ) : (
            <Pressable
              disabled={mark.isPending}
              onPress={() => mark.mutate({ forening: fid, user: y.user_id, name: y.name, activityId })}
              style={[styles.markBtn, { backgroundColor: colors.ink }]}
            >
              <Text style={[styles.markText, { color: colors.white }]}>Markera</Text>
            </Pressable>
          )}
        </Card>
      ))}

      {(youth ?? []).length === 0 && <Text style={styles.empty}>Inga ungdomar i föreningen än.</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  context: { fontFamily: font.regular, fontSize: 13, color: colors.muted2, marginBottom: 8 },
  chips: { gap: 7, paddingBottom: 12 },
  chip: { paddingVertical: 8, paddingHorizontal: 13, borderRadius: 999, maxWidth: 200 },
  chipText: { fontFamily: font.semibold, fontSize: 12 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 12, marginTop: 11 },
  avatar: { width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center' },
  avatarText: { fontFamily: font.semibold, fontSize: 14, color: colors.white },
  name: { fontFamily: font.semibold, fontSize: 13.5, color: colors.ink },
  sub: { fontFamily: font.regular, fontSize: 11, color: colors.muted2 },
  markBtn: { flexDirection: 'row', alignItems: 'center', paddingVertical: 9, paddingHorizontal: 14, borderRadius: 12 },
  markText: { fontFamily: font.semibold, fontSize: 12.5 },
  empty: { fontFamily: font.regular, fontSize: 12.5, color: colors.muted2, marginTop: 14 },
});
