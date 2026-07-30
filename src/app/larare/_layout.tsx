import { Redirect, Stack } from 'expo-router';
import { colors } from '@/theme/tokens';
import { useAuth } from '@/providers/AuthProvider';

export default function LarareLayout() {
  const { loading, dataLoading, session, role } = useAuth();

  if (loading || dataLoading) return null;
  if (!session) return <Redirect href="/auth/login" />;
  if (role !== 'larare') return <Redirect href="/" />;

  return <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.adminBg } }} />;
}
