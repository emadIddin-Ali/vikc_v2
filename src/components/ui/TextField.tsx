import React from 'react';
import { StyleSheet, TextInput, TextInputProps } from 'react-native';
import { colors, font, radius } from '@/theme/tokens';

/** Text input styled to the design's form fields (1.5px #eae4fb border, radius 12). */
export function TextField(props: TextInputProps) {
  return (
    <TextInput
      placeholderTextColor={colors.faint}
      {...props}
      style={[styles.input, props.style]}
    />
  );
}

const styles = StyleSheet.create({
  input: {
    width: '100%',
    borderWidth: 1.5,
    borderColor: colors.inputBorder,
    borderRadius: radius.sm,
    backgroundColor: colors.white,
    paddingHorizontal: 14,
    paddingVertical: 13,
    fontFamily: font.regular,
    fontSize: 15,
    color: colors.ink,
  },
});
