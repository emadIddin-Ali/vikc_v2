import { Redirect } from 'expo-router';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { colors } from '@/theme/tokens';
import { useAuth } from '@/providers/AuthProvider';

/** Entry point: routes to the right area based on auth + role. */
export default function Index() {
  const { loading, dataLoading, session, role } = useAuth();

  if (loading || dataLoading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  if (!session) return <Redirect href="/auth/login" />;
  if (!role) return <Redirect href="/auth/join" />;
  if (role === 'ledare') return <Redirect href="/ledare" />;
  if (role === 'kommun') return <Redirect href="/kommun" />;
  if (role === 'foralder') return <Redirect href="/foralder" />;
  if (role === 'larare') return <Redirect href="/larare" />;
  return <Redirect href="/ungdom" />;
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#efe9ff' },
});
