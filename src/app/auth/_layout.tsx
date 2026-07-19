import { Redirect, Stack, useSegments } from 'expo-router';
import { useAuth } from '@/providers/AuthProvider';

export default function AuthLayoutRoute() {
  const { loading, dataLoading, session, role } = useAuth();
  const segments = useSegments();
  const onJoin = segments[segments.length - 1] === 'join';

  if (loading || dataLoading) return null;
  // Signed in AND already placed in a förening/role → leave the auth area.
  if (session && role) return <Redirect href="/" />;
  // Signed in but not yet in any förening → go to the join screen.
  if (session && !role && !onJoin) return <Redirect href="/auth/join" />;

  return <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: '#efe9ff' } }} />;
}
