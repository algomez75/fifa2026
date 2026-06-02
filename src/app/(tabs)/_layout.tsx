import { Tabs } from 'expo-router';

import { TabBar } from '@/components/TabBar';

export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{ headerShown: false, sceneStyle: { backgroundColor: '#0A0E1A' } }}
      tabBar={(props) => <TabBar {...(props as any)} />}>
      <Tabs.Screen name="index" />
      <Tabs.Screen name="schedule" />
      <Tabs.Screen name="groups" />
      <Tabs.Screen name="teams" />
      <Tabs.Screen name="leaderboard" />
      <Tabs.Screen name="history" />
    </Tabs>
  );
}
