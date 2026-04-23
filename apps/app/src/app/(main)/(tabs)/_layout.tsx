import { Tabs } from 'expo-router';
import { CheckCircle2Icon, ListChecksIcon, SunIcon, UserIcon } from 'lucide-react-native';

/** 底部四 Tab：今天 / 全部 / 已完成 / 我的 */
export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: '#1d1a12',
        tabBarInactiveTintColor: '#7a7266',
        tabBarStyle: {
          backgroundColor: '#f4ede0',
          borderTopColor: '#d9d0bd',
          height: 82,
          paddingTop: 8,
        },
        tabBarLabelStyle: { fontSize: 12, fontWeight: '500' },
        tabBarIconStyle: { marginBottom: 2 },
      }}
    >
      <Tabs.Screen
        name="today"
        options={{
          title: '今天',
          tabBarIcon: ({ color, size }) => <SunIcon color={color} size={size} />,
        }}
      />
      <Tabs.Screen
        name="all"
        options={{
          title: '全部',
          tabBarIcon: ({ color, size }) => <ListChecksIcon color={color} size={size} />,
        }}
      />
      <Tabs.Screen
        name="completed"
        options={{
          title: '已完成',
          tabBarIcon: ({ color, size }) => <CheckCircle2Icon color={color} size={size} />,
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: '我的',
          tabBarIcon: ({ color, size }) => <UserIcon color={color} size={size} />,
        }}
      />
    </Tabs>
  );
}
