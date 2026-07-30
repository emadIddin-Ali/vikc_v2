import { useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { LinearGradient } from 'expo-linear-gradient';
import React, { useEffect, useRef, useState } from 'react';
import {
  Animated, Easing, Pressable, ScrollView, StyleSheet, Text, TextInput, View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Circle, Path } from 'react-native-svg';
import { GoogleG } from '@/components/GoogleG';
import { Icon } from '@/components/Icon';
import { Mascot } from '@/components/Mascot';
import { useReducedMotion } from '@/hooks/useReducedMotion';

/** One place to change the palette (RN has no CSS :root). */
export const C = {
  brandDeep: '#3A2BD4',
  brandLight: '#7C74EC',
  ctaFrom: '#4436D8',
  ctaTo: '#E7A6F0',
  ink: '#16151F',
  muted: '#7C7C8F',
  hairline: '#E7E6F0',
  surface: '#FFFFFF',
  danger: '#E5484D',
  ring: 'rgba(58,43,212,0.14)',
};

export const F = {
  medium: 'PlusJakartaSans_500Medium',
  semibold: 'PlusJakartaSans_600SemiBold',
  bold: 'PlusJakartaSans_700Bold',
  extra: 'PlusJakartaSans_800ExtraBold',
};

type AuthRoute = '/auth/login' | '/auth/sign-up';

/**
 * Shared shell for the auth screens: brand gradient, top bar (back + a link to
 * the other screen), mascot, wordmark, and the two-layer paper sheet holding the
 * form. The whole page is ONE ScrollView with automaticallyAdjustKeyboardInsets,
 * so a focused field always scrolls above the keyboard (the mascot scrolls away).
 */
export function AuthScaffold({
  altPrompt, altLabel, altHref, onAlt, showBack = true, children,
}: {
  altPrompt?: string;
  altLabel: string;
  /** Route the top-right button pushes to (used when onAlt is not given). */
  altHref?: AuthRoute;
  /** Custom top-right action (e.g. sign out). Takes precedence over altHref. */
  onAlt?: () => void;
  showBack?: boolean;
  children: React.ReactNode;
}) {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const reduced = useReducedMotion();

  const handleAlt = () => {
    if (onAlt) onAlt();
    else if (altHref) router.push(altHref);
  };
  const handleBack = () => {
    if (router.canGoBack()) router.back();
    else if (altHref) router.replace(altHref);
  };

  // The sheet glides up 22px on load (disabled under reduced motion).
  const slide = useRef(new Animated.Value(reduced ? 0 : 22)).current;
  useEffect(() => {
    if (reduced) { slide.setValue(0); return; }
    Animated.timing(slide, { toValue: 0, duration: 420, easing: Easing.out(Easing.cubic), useNativeDriver: true }).start();
  }, [reduced, slide]);

  return (
    <View style={styles.root}>
      <StatusBar style="light" />
      <LinearGradient colors={[C.brandDeep, C.brandLight]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={StyleSheet.absoluteFill} />

      <ScrollView
        contentContainerStyle={{ flexGrow: 1, paddingTop: insets.top }}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
        automaticallyAdjustKeyboardInsets
        keyboardDismissMode="interactive"
      >
        {/* Topprad */}
        <View style={styles.topbar}>
          {showBack ? (
            <Pressable
              onPress={handleBack}
              style={styles.backBtn}
              hitSlop={10}
              accessibilityRole="button"
              accessibilityLabel="Tillbaka"
            >
              <Icon name="arrowL" size={24} color="#FFFFFF" />
            </Pressable>
          ) : (
            <View style={styles.backBtn} />
          )}
          <View style={{ flex: 1 }} />
          {altPrompt ? <Text style={styles.topText}>{altPrompt}</Text> : null}
          <Pressable onPress={handleAlt} style={styles.topCta} accessibilityRole="button" accessibilityLabel={altLabel}>
            <Text style={styles.topCtaText}>{altLabel}</Text>
          </Pressable>
        </View>

        {/* Maskot + ordmärke */}
        <View style={styles.mascotWrap}>
          <Mascot size={72} eyes />
        </View>
        <Text style={styles.wordmark}>LEVLA</Text>

        {/* Signatur: arkstapel */}
        <Animated.View style={[styles.stack, { transform: [{ translateY: slide }] }]}>
          <View style={styles.backSheet} pointerEvents="none" />
          <View style={[styles.sheet, { paddingBottom: insets.bottom + 24 }]}>
            {children}
          </View>
        </Animated.View>
      </ScrollView>
    </View>
  );
}

/** A floating-label text field with focus ring and an optional show/hide toggle. */
export function AuthField({
  label, value, onChangeText, error, secureToggle, ...input
}: {
  label: string;
  value: string;
  onChangeText: (t: string) => void;
  error?: boolean;
  /** Renders a show/hide eye and manages secureTextEntry itself. */
  secureToggle?: boolean;
} & Omit<React.ComponentProps<typeof TextInput>, 'secureTextEntry'>) {
  const reduced = useReducedMotion();
  const [focused, setFocused] = useState(false);
  const [visible, setVisible] = useState(false);
  const floated = focused || value.length > 0;
  const anim = useRef(new Animated.Value(floated ? 1 : 0)).current;

  useEffect(() => {
    if (reduced) { anim.setValue(floated ? 1 : 0); return; }
    Animated.timing(anim, { toValue: floated ? 1 : 0, duration: 150, useNativeDriver: false }).start();
  }, [floated, reduced, anim]);

  const labelTop = anim.interpolate({ inputRange: [0, 1], outputRange: [26, 12] });
  const labelSize = anim.interpolate({ inputRange: [0, 1], outputRange: [15, 12] });

  return (
    <View style={[styles.ring, focused && { borderColor: C.ring }]}>
      <View style={[styles.field, error ? { borderColor: C.danger } : focused ? { borderColor: C.brandDeep } : null]}>
        <Animated.Text
          style={[styles.floatLabel, { top: labelTop, fontSize: labelSize, color: focused ? C.brandDeep : C.muted }]}
          pointerEvents="none"
        >
          {label}
        </Animated.Text>
        <TextInput
          value={value}
          onChangeText={onChangeText}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          secureTextEntry={secureToggle ? !visible : false}
          style={[styles.input, secureToggle && { paddingRight: 56 }]}
          placeholder=""
          selectionColor={C.brandDeep}
          {...input}
        />
        {secureToggle && (
          <Pressable
            onPress={() => setVisible((v) => !v)}
            style={styles.eyeBtn}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityState={{ selected: visible }}
            accessibilityLabel={visible ? 'Dölj lösenord' : 'Visa lösenord'}
          >
            <EyeIcon open={visible} color={C.muted} />
          </Pressable>
        )}
      </View>
    </View>
  );
}

/** Full-width brand-gradient primary button. */
export function AuthCta({
  label, loadingLabel, busy, disabled, onPress,
}: {
  label: string;
  loadingLabel: string;
  busy?: boolean;
  disabled?: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={busy || disabled}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={({ pressed }) => [styles.ctaWrap, pressed && !busy && !disabled && { transform: [{ scale: 0.985 }] }, (busy || disabled) && { opacity: 0.7 }]}
    >
      <LinearGradient colors={[C.ctaFrom, C.ctaTo]} start={{ x: 0, y: 0.5 }} end={{ x: 1, y: 0.5 }} style={styles.cta}>
        <Text style={styles.ctaText}>{busy ? loadingLabel : label}</Text>
      </LinearGradient>
    </Pressable>
  );
}

/** Hairline divider with centered label. */
export function AuthDivider({ label }: { label: string }) {
  return (
    <View style={styles.divider}>
      <View style={styles.hairline} />
      <Text style={styles.dividerText}>{label}</Text>
      <View style={styles.hairline} />
    </View>
  );
}

/** Full-width Google sign-in button. */
export function GoogleButton({ onPress, opening, disabled }: { onPress: () => void; opening?: boolean; disabled?: boolean }) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled || opening}
      style={[styles.socialBtn, (disabled || opening) && { opacity: 0.6 }]}
      accessibilityRole="button"
      accessibilityLabel="Fortsätt med Google"
    >
      <GoogleG size={20} />
      <Text style={[styles.socialLabel, { color: C.ink }]}>{opening ? 'Öppnar…' : 'Google'}</Text>
    </Pressable>
  );
}

function EyeIcon({ open, color }: { open: boolean; color: string }) {
  return (
    <Svg width={22} height={22} viewBox="0 0 24 24" fill="none">
      <Path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z" stroke={color} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" />
      <Circle cx="12" cy="12" r="3" stroke={color} strokeWidth={1.8} />
      {!open && <Path d="M4 4L20 20" stroke={color} strokeWidth={1.8} strokeLinecap="round" />}
    </Svg>
  );
}

/** Shared text styles used by the form content inside the sheet. */
export const authStyles = StyleSheet.create({
  title: { fontFamily: F.extra, fontSize: 28, color: C.ink, textAlign: 'center' },
  subtitle: { fontFamily: F.medium, fontSize: 16, color: C.muted, textAlign: 'center', marginTop: 6 },
  error: { fontFamily: F.medium, fontSize: 13.5, color: C.danger, marginTop: 12 },
  info: { fontFamily: F.medium, fontSize: 13.5, color: '#1a7f4b', marginTop: 12 },
});

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.brandDeep },

  topbar: { height: 56, paddingHorizontal: 20, flexDirection: 'row', alignItems: 'center', gap: 10 },
  backBtn: { width: 44, height: 44, marginLeft: -10, alignItems: 'center', justifyContent: 'center' },
  topText: { fontFamily: F.medium, fontSize: 15, color: '#FFFFFF' },
  topCta: { backgroundColor: 'rgba(255,255,255,0.22)', borderRadius: 12, paddingVertical: 11, paddingHorizontal: 18 },
  topCtaText: { fontFamily: F.semibold, fontSize: 14, color: '#FFFFFF' },

  mascotWrap: { alignItems: 'center', marginTop: 22 },
  wordmark: { fontFamily: F.extra, fontSize: 42, color: '#FFFFFF', textAlign: 'center', letterSpacing: -0.8, marginTop: 14, marginBottom: 44 },

  stack: { flexGrow: 1 },
  backSheet: {
    position: 'absolute', left: 22, right: 22, top: -14, bottom: 0,
    backgroundColor: 'rgba(255,255,255,0.18)', borderRadius: 28,
  },
  sheet: {
    flexGrow: 1, backgroundColor: C.surface, borderTopLeftRadius: 32, borderTopRightRadius: 32,
    paddingHorizontal: 26, paddingTop: 38,
    shadowColor: 'rgba(20,18,60,1)', shadowOpacity: 0.1, shadowRadius: 30, shadowOffset: { width: 0, height: -8 }, elevation: 12,
  },

  ring: { borderWidth: 3, borderColor: 'transparent', borderRadius: 17 },
  field: {
    height: 72, borderRadius: 14, borderWidth: 1, borderColor: C.hairline, backgroundColor: C.surface, justifyContent: 'center',
  },
  floatLabel: { position: 'absolute', left: 18, fontFamily: F.medium },
  input: { fontFamily: F.semibold, fontSize: 16, color: C.ink, paddingTop: 30, paddingBottom: 12, paddingHorizontal: 18 },
  eyeBtn: { position: 'absolute', right: 6, top: 14, width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },

  ctaWrap: { marginTop: 22, borderRadius: 16, overflow: 'hidden' },
  cta: { height: 60, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  ctaText: { fontFamily: F.bold, fontSize: 16, color: '#FFFFFF' },

  divider: { flexDirection: 'row', alignItems: 'center', marginTop: 30, marginBottom: 30 },
  hairline: { flex: 1, height: 1, backgroundColor: C.hairline },
  dividerText: { fontFamily: F.medium, fontSize: 14, color: C.muted, marginHorizontal: 16 },

  socialBtn: {
    height: 66, borderRadius: 14, borderWidth: 1, borderColor: C.hairline,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, backgroundColor: C.surface,
  },
  socialLabel: { fontFamily: F.semibold, fontSize: 15 },
});
