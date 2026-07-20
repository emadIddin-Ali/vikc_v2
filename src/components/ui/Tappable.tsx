import React, { useRef } from 'react';
import { Animated, Pressable, PressableProps, StyleProp, ViewStyle } from 'react-native';
import { useReducedMotion } from '@/hooks/useReducedMotion';

/**
 * Pressable that dips slightly while held. The whole app's cards use it, so
 * everything tappable feels tappable — the single cheapest way to make a
 * screen stop feeling like a static mockup.
 */
export function Tappable({
  children,
  style,
  containerStyle,
  scale = 0.97,
  disabled,
  ...rest
}: PressableProps & {
  children: React.ReactNode;
  /** Applied to the animated surface — this is what visibly scales. */
  style?: StyleProp<ViewStyle>;
  /**
   * Applied to the Pressable itself. Needed for layout that the parent drives,
   * e.g. `flex: 1` in a row: `style` sits on an inner view and can't claim
   * space from the row on its own.
   */
  containerStyle?: StyleProp<ViewStyle>;
  /** How far to dip. Use a value closer to 1 for large surfaces. */
  scale?: number;
}) {
  const reduced = useReducedMotion();
  const v = useRef(new Animated.Value(1)).current;

  const to = (toValue: number) =>
    Animated.spring(v, { toValue, friction: 7, tension: 240, useNativeDriver: true }).start();

  return (
    <Pressable
      {...rest}
      disabled={disabled}
      style={containerStyle}
      onPressIn={(e) => {
        if (!reduced && !disabled) to(scale);
        rest.onPressIn?.(e);
      }}
      onPressOut={(e) => {
        if (!reduced && !disabled) to(1);
        rest.onPressOut?.(e);
      }}
    >
      <Animated.View style={[style, { transform: [{ scale: v }] }]}>{children}</Animated.View>
    </Pressable>
  );
}
