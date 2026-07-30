import { Redirect, Stack } from 'expo-router';
import { useAuth } from '@/providers/AuthProvider';

export default function ForalderLayout() {
  const { loading, dataLoading, session, role } = useAuth();

  if (loading || dataLoading) return null;
  if (!session) return <Redirect href="/auth/login" />;
  if (role !== 'foralder') return <Redirect href="/" />;

  return <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: '#efe9ff' } }} />;
}
