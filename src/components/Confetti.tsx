import React, { useEffect, useRef } from 'react';
import { Animated, StyleSheet, useWindowDimensions, View } from 'react-native';
import { useReducedMotion } from '@/hooks/useReducedMotion';

const COLORS = ['#ffd23f', '#22c55e', '#ff7a4d', '#ff4d8d', '#ffffff', '#7ce0ff'];

function Piece({ index, height }: { index: number; height: number }) {
  const t = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const anim = Animated.loop(
      Animated.timing(t, {
        toValue: 1,
        duration: 1600 + (index % 5) * 300,
        delay: (index % 8) * 120,
        useNativeDriver: true,
      }),
    );
    anim.start();
    return () => anim.stop();
  }, [index, t]);

  const translateY = t.interpolate({ inputRange: [0, 1], outputRange: [-40, height + 40] });
  const rotate = t.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '540deg'] });
  const opacity = t.interpolate({ inputRange: [0, 0.1, 0.85, 1], outputRange: [0, 1, 1, 0] });

  return (
    <Animated.View
      style={{
        position: 'absolute',
        top: 0,
        left: `${((index * 37) % 96) + 2}%`,
        width: 7 + (index % 3),
        height: 10 + (index % 4),
        backgroundColor: COLORS[index % COLORS.length],
        borderRadius: 2,
        transform: [{ translateY }, { rotate }],
        opacity,
      }}
    />
  );
}

/** Falling confetti burst. Renders nothing if reduce-motion is on. */
export function Confetti({ count = 40 }: { count?: number }) {
  const reduced = useReducedMotion();
  const { height } = useWindowDimensions();
  if (reduced) return null;
  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      {Array.from({ length: count }).map((_, i) => (
        <Piece key={i} index={i} height={height} />
      ))}
    </View>
  );
}
