import { Redirect, Tabs } from 'expo-router';
import { useEffect } from 'react';
import { YouthTabBar } from '@/components/YouthTabBar';
import { seedBadgeBaseline } from '@/lib/badgeSeen';
import { useAuth } from '@/providers/AuthProvider';

export default function UngdomLayout() {
  const { loading, dataLoading, session, role, activeMembership } = useAuth();

  // Baseline the member's current badges once per device, before they can reach
  // the check-in screen — otherwise the first check-in would celebrate every
  // badge they already had.
  const userId = session?.user.id;
  const foreningId = activeMembership?.forening_id;
  useEffect(() => {
    if (userId && foreningId) void seedBadgeBaseline(userId, foreningId).catch(() => {});
  }, [userId, foreningId]);

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
      <Tabs.Screen name="narvaro" />
      <Tabs.Screen name="marken" />
    </Tabs>
  );
}
