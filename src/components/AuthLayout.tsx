import { LinearGradient } from 'expo-linear-gradient';
import React from 'react';
import {
  KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, View,
} from 'react-native';
import { Card } from '@/components/Card';
import { Mascot } from '@/components/Mascot';
import { colors, font, gradients } from '@/theme/tokens';

/** Shared shell for the auth screens: gradient bg, mascot, title + a card of content. */
export function AuthLayout({
  title,
  subtitle,
  children,
  footer,
}: {
  title: string;
  subtitle: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
}) {
  return (
    <View style={styles.root}>
      <LinearGradient colors={gradients.screen} style={StyleSheet.absoluteFill} />
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.header}>
            <Mascot size={76} eyes />
            <Text style={styles.brand}>LEVLA</Text>
            <Text style={styles.subtitle}>{subtitle}</Text>
          </View>

          <Card style={styles.card}>
            <Text style={styles.cardTitle}>{title}</Text>
            {children}
          </Card>

          {footer ? <View style={styles.footer}>{footer}</View> : null}
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  flex: { flex: 1 },
  content: { flexGrow: 1, justifyContent: 'center', padding: 24, gap: 18 },
  header: { alignItems: 'center', gap: 6 },
  brand: { fontFamily: font.bold, fontSize: 30, color: colors.ink, letterSpacing: 1 },
  subtitle: { fontFamily: font.medium, fontSize: 13, color: colors.muted },
  card: { padding: 18, gap: 12 },
  cardTitle: { fontFamily: font.semibold, fontSize: 16, color: colors.ink, marginBottom: 2 },
  footer: { alignItems: 'center' },
});
