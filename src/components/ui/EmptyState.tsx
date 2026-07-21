import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Card } from '@/components/Card';
import { Icon, IconName } from '@/components/Icon';
import { Tappable } from '@/components/ui/Tappable';
import { colors, font, radius } from '@/theme/tokens';

/**
 * An empty list should say what will appear here and, where the member can do
 * something about it, offer the action. The app previously used a bare grey
 * sentence — for a brand-new member that made the first screen a row of dead
 * ends rather than an invitation.
 */
export function EmptyState({
  icon,
  title,
  body,
  actionLabel,
  onPress,
}: {
  icon: IconName;
  title: string;
  body: string;
  actionLabel?: string;
  onPress?: () => void;
}) {
  return (
    <Card style={styles.card}>
      <View style={styles.tile}>
        <Icon name={icon} size={22} color={colors.primary} />
      </View>
      <Text style={styles.title}>{title}</Text>
      <Text style={styles.body}>{body}</Text>
      {actionLabel && onPress && (
        <Tappable scale={0.94} onPress={onPress} style={styles.btn}>
          <Text style={styles.btnText}>{actionLabel}</Text>
        </Tappable>
      )}
    </Card>
  );
}

const styles = StyleSheet.create({
  card: { alignItems: 'center', paddingVertical: 22, paddingHorizontal: 20, marginTop: 11 },
  tile: {
    width: 46, height: 46, borderRadius: 15, backgroundColor: colors.tintPurple,
    alignItems: 'center', justifyContent: 'center',
  },
  title: { fontFamily: font.semibold, fontSize: 14, color: colors.ink, marginTop: 11 },
  body: {
    fontFamily: font.regular, fontSize: 12.5, color: colors.muted2, marginTop: 3,
    textAlign: 'center', lineHeight: 17, maxWidth: 250,
  },
  btn: {
    marginTop: 14, backgroundColor: colors.primary, borderRadius: radius.pill,
    paddingVertical: 10, paddingHorizontal: 20,
  },
  btnText: { fontFamily: font.semibold, fontSize: 13, color: colors.white },
});
