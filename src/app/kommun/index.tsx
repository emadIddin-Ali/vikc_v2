import { Pressable, StyleSheet, Text } from 'react-native';
import { Placeholder } from '@/components/Placeholder';
import { colors, font } from '@/theme/tokens';
import { useAuth } from '@/providers/AuthProvider';

export default function KommunHome() {
  const { signOut } = useAuth();

  return (
    <Placeholder
      title="Kommun"
      note="Aggregerad översikt över alla föreningar (helt separat data per förening) byggs i nästa steg."
      footer={
        <Pressable onPress={signOut}>
          <Text style={styles.link}>Logga ut</Text>
        </Pressable>
      }
    />
  );
}

const styles = StyleSheet.create({
  link: { fontFamily: font.semibold, fontSize: 13, color: colors.primary },
});
