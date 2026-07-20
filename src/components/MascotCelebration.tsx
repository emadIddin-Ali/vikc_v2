import React, { useEffect, useMemo, useRef } from 'react';
import { Animated, Easing, StyleSheet, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { Mascot } from '@/components/Mascot';
import { useReducedMotion } from '@/hooks/useReducedMotion';

/**
 * The celebration avatar: Gnista springs in oversized, sits on a slowly turning
 * sunburst, and keeps breathing while rings pulse outward behind her.
 *
 * Everything animates on the native driver (transform/opacity only) so it stays
 * smooth on the mid-range Androids the youth actually use. With reduce-motion on
 * it renders the same composition, just still.
 */

const RAY_COUNT = 12;

/** Tapered spokes radiating from the centre of a 200×200 box. */
function useRayPath(inner: number, outer: number) {
  return useMemo(() => {
    const c = 100;
    const half = 3.6; // degrees — half-width of a spoke at its base
    const pt = (deg: number, r: number) => {
      const rad = ((deg - 90) * Math.PI) / 180;
      return `${(c + Math.cos(rad) * r).toFixed(2)} ${(c + Math.sin(rad) * r).toFixed(2)}`;
    };
    return Array.from({ length: RAY_COUNT }, (_, i) => {
      const a = (i * 360) / RAY_COUNT;
      return `M ${pt(a - half, inner)} L ${pt(a - half * 0.35, outer)} L ${pt(a + half * 0.35, outer)} L ${pt(a + half, inner)} Z`;
    }).join(' ');
  }, [inner, outer]);
}

export function MascotCelebration({
  size = 118,
  mascotSize = 66,
  mouth = 'grin',
  rayColor = 'rgba(255,255,255,0.34)',
  ringColor = 'rgba(255,255,255,0.26)',
  glowColor = 'rgba(255,255,255,0.16)',
  disc = true,
}: {
  size?: number;
  mascotSize?: number;
  mouth?: 'smile' | 'grin';
  rayColor?: string;
  ringColor?: string;
  glowColor?: string;
  /** White circle behind Gnista. Off looks better on a dark gradient. */
  disc?: boolean;
}) {
  const reduced = useReducedMotion();
  // The rays reach the edge of the box, so this multiplier is how far the glow
  // extends past Gnista. Kept modest — these screens don't scroll.
  const box = Math.round(size * 1.9);
  const rays = useRayPath(26, 96);

  const pop = useRef(new Animated.Value(0)).current;   // spring-in
  const bob = useRef(new Animated.Value(0)).current;   // idle breathing
  const spin = useRef(new Animated.Value(0)).current;  // sunburst rotation
  const ringA = useRef(new Animated.Value(0)).current;
  const ringB = useRef(new Animated.Value(0)).current;
  const twinkle = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (reduced) {
      pop.setValue(1);
      return;
    }

    const entrance = Animated.spring(pop, {
      toValue: 1,
      friction: 4.2,
      tension: 70,
      useNativeDriver: true,
    });

    const loops = [
      Animated.loop(
        Animated.sequence([
          Animated.timing(bob, { toValue: 1, duration: 1500, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
          Animated.timing(bob, { toValue: 0, duration: 1500, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
        ]),
      ),
      Animated.loop(
        Animated.timing(spin, { toValue: 1, duration: 16000, easing: Easing.linear, useNativeDriver: true }),
      ),
      Animated.loop(Animated.timing(ringA, { toValue: 1, duration: 2000, easing: Easing.out(Easing.quad), useNativeDriver: true })),
      Animated.loop(Animated.timing(ringB, { toValue: 1, duration: 2000, easing: Easing.out(Easing.quad), useNativeDriver: true })),
      Animated.loop(
        Animated.sequence([
          Animated.timing(twinkle, { toValue: 1, duration: 900, useNativeDriver: true }),
          Animated.timing(twinkle, { toValue: 0, duration: 900, useNativeDriver: true }),
        ]),
      ),
    ];

    entrance.start();
    loops[0].start();
    loops[1].start();
    loops[2].start();
    // Offset the second ring so the two pulses interleave.
    const ringDelay = setTimeout(() => loops[3].start(), 1000);
    loops[4].start();

    return () => {
      clearTimeout(ringDelay);
      entrance.stop();
      loops.forEach((l) => l.stop());
    };
  }, [reduced, pop, bob, spin, ringA, ringB, twinkle]);

  // Overshoot on the way in, then settle — this is the "pop". The spring runs
  // past 1, which is exactly what we want for scale but is not a legal opacity.
  const popScale = pop.interpolate({ inputRange: [0, 1], outputRange: [0.3, 1] });
  const fade = pop.interpolate({ inputRange: [0, 1], outputRange: [0, 1], extrapolate: 'clamp' });
  const popRotate = pop.interpolate({ inputRange: [0, 1], outputRange: ['-14deg', '0deg'] });
  const bobY = bob.interpolate({ inputRange: [0, 1], outputRange: [0, -9] });
  const bobScale = bob.interpolate({ inputRange: [0, 1], outputRange: [1, 1.04] });
  const spinDeg = spin.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] });

  const ring = (v: Animated.Value) => ({
    transform: [{ scale: v.interpolate({ inputRange: [0, 1], outputRange: [0.75, 2.05] }) }],
    opacity: v.interpolate({ inputRange: [0, 1], outputRange: [0.6, 0] }),
  });

  return (
    <View style={[styles.wrap, { width: box, height: box }]} pointerEvents="none">
      {/* Sunburst */}
      <Animated.View
        style={[
          StyleSheet.absoluteFill,
          { opacity: fade, transform: reduced ? [] : [{ rotate: spinDeg }] },
        ]}
      >
        <Svg width="100%" height="100%" viewBox="0 0 200 200">
          <Path d={rays} fill={rayColor} />
        </Svg>
      </Animated.View>

      {/* Soft halo */}
      <Animated.View
        style={[
          styles.halo,
          {
            width: size * 1.5,
            height: size * 1.5,
            borderRadius: size * 0.75,
            backgroundColor: glowColor,
            opacity: fade,
            transform: [{ scale: popScale }],
          },
        ]}
      />

      {/* Pulsing rings */}
      {!reduced &&
        [ringA, ringB].map((v, i) => (
          <Animated.View
            key={i}
            style={[
              styles.ring,
              { width: size, height: size, borderRadius: size / 2, borderColor: ringColor },
              ring(v),
            ]}
          />
        ))}

      {/* Twinkling sparks */}
      {!reduced &&
        SPARKS.map((s, i) => (
          <Animated.View
            key={i}
            style={[
              styles.spark,
              {
                left: box * s.x,
                top: box * s.y,
                opacity: twinkle.interpolate({ inputRange: [0, 1], outputRange: s.flip ? [0.85, 0.15] : [0.15, 0.85] }),
                transform: [{ scale: twinkle.interpolate({ inputRange: [0, 1], outputRange: s.flip ? [1, 0.6] : [0.6, 1] }) }],
              },
            ]}
          >
            <Svg width={s.size} height={s.size} viewBox="0 0 100 100">
              <Path d="M50 6C57 32 68 43 94 50C68 57 57 68 50 94C43 68 32 57 6 50C32 43 43 32 50 6Z" fill={rayColor} />
            </Svg>
          </Animated.View>
        ))}

      {/* Gnista */}
      <Animated.View
        style={[
          styles.disc,
          { width: size, height: size, borderRadius: size / 2 },
          disc ? { backgroundColor: '#ffffff' } : null,
          { transform: [{ translateY: bobY }, { scale: Animated.multiply(popScale, bobScale) }, { rotate: popRotate }] },
        ]}
      >
        <Mascot size={mascotSize} eyes mouth={mouth} />
      </Animated.View>
    </View>
  );
}

/** Positions as a fraction of the box, so sparks scale with `size`. */
const SPARKS = [
  { x: 0.08, y: 0.2, size: 16, flip: false },
  { x: 0.84, y: 0.14, size: 12, flip: true },
  { x: 0.9, y: 0.68, size: 17, flip: false },
  { x: 0.12, y: 0.74, size: 11, flip: true },
];

const styles = StyleSheet.create({
  wrap: { alignItems: 'center', justifyContent: 'center' },
  halo: { position: 'absolute' },
  ring: { position: 'absolute', borderWidth: 2 },
  spark: { position: 'absolute' },
  disc: { alignItems: 'center', justifyContent: 'center' },
});
