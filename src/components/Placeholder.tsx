import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Mascot } from '@/components/Mascot';
import { Screen } from '@/components/Screen';
import { colors, font } from '@/theme/tokens';

/** Simple on-brand placeholder for screens that arrive in a later milestone. */
export function Placeholder({
  title,
  note,
  footer,
}: {
  title: string;
  note?: string;
  footer?: React.ReactNode;
}) {
  return (
    <Screen>
      <View style={styles.wrap}>
        <Mascot size={92} eyes />
        <Text style={styles.title}>{title}</Text>
        <Text style={styles.note}>{note ?? 'Den här vyn byggs i ett kommande steg.'}</Text>
        {footer ? <View style={styles.footer}>{footer}</View> : null}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  wrap: { alignItems: 'center', marginTop: 56, gap: 12 },
  title: { fontFamily: font.bold, fontSize: 22, color: colors.ink },
  note: { fontFamily: font.regular, fontSize: 13, color: colors.muted2, textAlign: 'center', maxWidth: 260 },
  footer: { marginTop: 18, width: '100%', alignItems: 'center' },
});
