import React, { useEffect, useRef, useState } from 'react';
import { StyleProp, Text, TextStyle } from 'react-native';
import { useReducedMotion } from '@/hooks/useReducedMotion';
import { fmt } from '@/theme/tokens';

/**
 * Counts from the previous value to the new one whenever `value` changes.
 * Points going up after a check-in, or down after a purchase, should be
 * something you *see* happen rather than a number that was suddenly different.
 *
 * Drives state rather than Animated, because the text content itself changes —
 * that can't run on the native driver, so we keep it to one cheap number.
 */
export function CountUp({
  value,
  style,
  duration = 650,
  format = fmt,
}: {
  value: number;
  style?: StyleProp<TextStyle>;
  duration?: number;
  format?: (n: number) => string;
}) {
  const reduced = useReducedMotion();
  const [shown, setShown] = useState(value);
  const from = useRef(value);
  const raf = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (reduced || from.current === value) {
      from.current = value;
      setShown(value);
      return;
    }

    const start = Date.now();
    const startValue = from.current;
    const delta = value - startValue;
    from.current = value;

    if (raf.current) clearInterval(raf.current);
    raf.current = setInterval(() => {
      const t = Math.min(1, (Date.now() - start) / duration);
      // Ease-out so it decelerates into the final number.
      const eased = 1 - Math.pow(1 - t, 3);
      setShown(Math.round(startValue + delta * eased));
      if (t >= 1 && raf.current) {
        clearInterval(raf.current);
        raf.current = null;
      }
    }, 32);

    return () => {
      if (raf.current) clearInterval(raf.current);
      raf.current = null;
    };
  }, [value, duration, reduced]);

  return <Text style={style}>{format(shown)}</Text>;
}
