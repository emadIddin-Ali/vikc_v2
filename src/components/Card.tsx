import React from 'react';
import { View, ViewProps } from 'react-native';
import { colors, radius, shadow } from '@/theme/tokens';

/** White rounded card matching the design's default surface + soft purple shadow. */
export function Card({ style, ...rest }: ViewProps) {
  return (
    <View
      {...rest}
      style={[
        { backgroundColor: colors.white, borderRadius: radius.card },
        shadow.card,
        style,
      ]}
    />
  );
}
