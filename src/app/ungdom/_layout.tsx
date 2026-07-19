import { Redirect, Tabs } from 'expo-router';
import { YouthTabBar } from '@/components/YouthTabBar';
import { useAuth } from '@/providers/AuthProvider';

export default function UngdomLayout() {
  const { loading, dataLoading, session, role } = useAuth();

  if (loading || dataLoading) return null;
  if (!session) return <Redirect href="/auth/login" />;
  if (role !== 'ungdom') return <Redirect href="/" />;

  return (
    <Tabs
      tabBar={(props) => <YouthTabBar state={props.state as any} navigation={props.navigation as any} />}
      screenOptions={{ headerShown: false }}
    >
      <Tabs.Screen name="index" />
      <Tabs.Screen name="uppdrag" />
      <Tabs.Screen name="butik" />
      <Tabs.Screen name="profil" />
      <Tabs.Screen name="topplista" />
      <Tabs.Screen name="notiser" />
    </Tabs>
  );
}
