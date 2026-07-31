import React from 'react';
import { StyleSheet, View } from 'react-native';
import { colors, font, radius } from '@/theme/tokens';

/**
 * Webbversionen av datum-/tidsväljaren.
 *
 * `@react-native-community/datetimepicker` har ingen webbimplementation — den
 * kraschar när den renderas i en webbläsare. Metro plockar den här filen på
 * webben tack vare `.web.tsx`-ändelsen, så nativvarianten förblir orörd.
 *
 * Webbläsarens egen `datetime-local` är dessutom bättre här: den följer
 * användarens språk och tangentbord utan att vi bygger något eget.
 */
const pad = (n: number) => String(n).padStart(2, '0');

/** Date → "YYYY-MM-DDTHH:mm" i lokal tid, vilket är vad inputen förväntar sig. */
function toInputValue(d: Date | null): string {
  if (!d) return '';
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function DateTimeField({ value, onChange }: { value: Date | null; onChange: (d: Date) => void }) {
  return (
    <View style={styles.wrap}>
      <input
        type="datetime-local"
        value={toInputValue(value)}
        onChange={(e) => {
          const v = e.target.value;
          // Tom sträng = användaren rensade fältet; behåll då förra värdet.
          if (v) onChange(new Date(v));
        }}
        style={{
          width: '100%',
          border: 'none',
          outline: 'none',
          background: 'transparent',
          fontFamily: font.medium,
          fontSize: 15,
          color: colors.ink,
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    borderWidth: 1.5,
    borderColor: colors.inputBorder,
    borderRadius: radius.sm,
    backgroundColor: colors.white,
    paddingHorizontal: 14,
    paddingVertical: 13,
    marginTop: 4,
  },
});
