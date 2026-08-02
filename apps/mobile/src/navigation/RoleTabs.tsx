import React, { useMemo } from 'react';
import { Text } from 'react-native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { theme } from '@lab-topo/config';
import type { UserRole } from '@lab-topo/domain';
import { ProfileScreen } from '../screens/PlaceholderScreen';
import { CatalogScreen } from '../screens/CatalogScreen';
import { InventoryScreen } from '../screens/InventoryScreen';
import { LabRequestsScreen } from '../screens/LabRequestsScreen';
import { TeacherStudentsScreen } from '../screens/TeacherStudentsScreen';
import { StudentRequestsScreen } from '../screens/StudentRequestsScreen';

export type StudentTabParamList = {
  Catalog: undefined;
  Requests: undefined;
  Profile: undefined;
};

export type LabTabParamList = {
  Requests: undefined;
  Inventory: undefined;
  Profile: undefined;
};

export type TeacherTabParamList = {
  Summary: undefined;
  Students: undefined;
  Profile: undefined;
};

const StudentTabs = createBottomTabNavigator<StudentTabParamList>();
const LabTabs = createBottomTabNavigator<LabTabParamList>();
const TeacherTabs = createBottomTabNavigator<TeacherTabParamList>();

function TabIcon({ label }: { label: string }) {
  return <Text style={{ fontSize: 14 }}>{label}</Text>;
}

function useTabScreenOptions() {
  const insets = useSafeAreaInsets();
  const bottom = Math.max(insets.bottom, 10);

  return useMemo(
    () => ({
      headerShown: false,
      tabBarActiveTintColor: theme.color.navy,
      tabBarInactiveTintColor: '#8A96A2',
      tabBarLabelStyle: { fontSize: 10, fontWeight: '700' as const },
      tabBarStyle: {
        borderTopColor: theme.color.line,
        backgroundColor: '#fff',
        height: 52 + bottom,
        paddingBottom: bottom,
        paddingTop: 6,
      },
      tabBarItemStyle: {
        paddingVertical: 2,
      },
    }),
    [bottom]
  );
}

export function RoleTabs({ role }: { role: UserRole }) {
  const tabOptions = useTabScreenOptions();

  if (role === 'student') {
    return (
      <StudentTabs.Navigator screenOptions={tabOptions}>
        <StudentTabs.Screen
          name="Catalog"
          component={CatalogScreen}
          options={{ title: 'Catálogo', tabBarIcon: () => <TabIcon label="⌂" /> }}
        />
        <StudentTabs.Screen
          name="Requests"
          component={StudentRequestsScreen}
          options={{ title: 'Solicitudes', tabBarIcon: () => <TabIcon label="◷" /> }}
        />
        <StudentTabs.Screen
          name="Profile"
          component={ProfileScreen}
          options={{ title: 'Perfil', tabBarIcon: () => <TabIcon label="◯" /> }}
        />
      </StudentTabs.Navigator>
    );
  }

  if (role === 'teacher') {
    return (
      <TeacherTabs.Navigator screenOptions={tabOptions}>
        <TeacherTabs.Screen
          name="Summary"
          component={TeacherStudentsScreen}
          options={{ title: 'Resumen', tabBarIcon: () => <TabIcon label="⌂" /> }}
        />
        <TeacherTabs.Screen
          name="Students"
          component={TeacherStudentsScreen}
          options={{ title: 'Alumnos', tabBarIcon: () => <TabIcon label="▣" /> }}
        />
        <TeacherTabs.Screen
          name="Profile"
          component={ProfileScreen}
          options={{ title: 'Perfil', tabBarIcon: () => <TabIcon label="◯" /> }}
        />
      </TeacherTabs.Navigator>
    );
  }

  return (
    <LabTabs.Navigator screenOptions={tabOptions}>
      <LabTabs.Screen
        name="Requests"
        component={LabRequestsScreen}
        options={{ title: 'Solicitudes', tabBarIcon: () => <TabIcon label="◷" /> }}
      />
      <LabTabs.Screen
        name="Inventory"
        component={InventoryScreen}
        options={{ title: 'Inventario', tabBarIcon: () => <TabIcon label="▣" /> }}
      />
      <LabTabs.Screen
        name="Profile"
        component={ProfileScreen}
        options={{ title: 'Perfil', tabBarIcon: () => <TabIcon label="◯" /> }}
      />
    </LabTabs.Navigator>
  );
}
