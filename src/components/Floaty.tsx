import React, { useEffect, useRef } from 'react';
import { Animated, ViewStyle } from 'react-native';
import { useReducedMotion } from '@/hooks/useReducedMotion';

/** Gently bobs its children up/down (the mascot). Static if reduce-motion is on. */
export function Floaty({ children, style }: { children: React.ReactNode; style?: ViewStyle }) {
  const reduced = useReducedMotion();
  const v = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (reduced) return;
    const anim = Animated.loop(
      Animated.sequence([
        Animated.timing(v, { toValue: 1, duration: 1700, useNativeDriver: true }),
        Animated.timing(v, { toValue: 0, duration: 1700, useNativeDriver: true }),
      ]),
    );
    anim.start();
    return () => anim.stop();
  }, [reduced, v]);

  const translateY = v.interpolate({ inputRange: [0, 1], outputRange: [0, -8] });
  const rotate = v.interpolate({ inputRange: [0, 1], outputRange: ['-2deg', '2deg'] });

  return <Animated.View style={[style, { transform: [{ translateY }, { rotate }] }]}>{children}</Animated.View>;
}
