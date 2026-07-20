import React, { useEffect, useRef } from 'react';
import { Animated, Easing, StyleProp, ViewStyle } from 'react-native';
import { useReducedMotion } from '@/hooks/useReducedMotion';

/**
 * Fades and lifts its children in, offset by `index` so a list arrives in
 * sequence instead of all at once. The stagger is capped — with 27 badges an
 * uncapped delay would leave the last one arriving three seconds late.
 */
export function FadeIn({
  children,
  index = 0,
  style,
  step = 45,
  maxDelay = 400,
  distance = 10,
}: {
  children: React.ReactNode;
  index?: number;
  style?: StyleProp<ViewStyle>;
  step?: number;
  maxDelay?: number;
  distance?: number;
}) {
  const reduced = useReducedMotion();
  const v = useRef(new Animated.Value(reduced ? 1 : 0)).current;

  useEffect(() => {
    if (reduced) {
      v.setValue(1);
      return;
    }
    const anim = Animated.timing(v, {
      toValue: 1,
      duration: 320,
      delay: Math.min(index * step, maxDelay),
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    });
    anim.start();
    return () => anim.stop();
  }, [v, index, step, maxDelay, reduced]);

  return (
    <Animated.View
      style={[
        style,
        {
          opacity: v,
          transform: [{ translateY: v.interpolate({ inputRange: [0, 1], outputRange: [distance, 0] }) }],
        },
      ]}
    >
      {children}
    </Animated.View>
  );
}
