import React, { useMemo } from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { MaterialIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { theme } from '@lab-topo/config';
import type { UserRole } from '@lab-topo/domain';
import { ProfileScreen } from '../screens/ProfileScreen';
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

const TAB_ICON_SIZE = 24;

type MaterialIconName = React.ComponentProps<typeof MaterialIcons>['name'];

function TabIcon({
  name,
  color,
  focused,
}: {
  name: MaterialIconName;
  color: string;
  focused: boolean;
}) {
  return (
    <MaterialIcons
      name={name}
      size={TAB_ICON_SIZE}
      color={color}
      style={{ opacity: focused ? 1 : 0.92 }}
    />
  );
}

function useTabScreenOptions() {
  const insets = useSafeAreaInsets();
  const bottom = Math.max(insets.bottom, 12);

  return useMemo(
    () => ({
      headerShown: false,
      tabBarActiveTintColor: theme.color.navy,
      tabBarInactiveTintColor: '#8A96A2',
      tabBarLabelStyle: {
        fontSize: 11,
        fontWeight: '700' as const,
        marginTop: 2,
      },
      tabBarIconStyle: {
        marginTop: 2,
      },
      tabBarStyle: {
        borderTopColor: theme.color.line,
        backgroundColor: '#fff',
        height: 58 + bottom,
        paddingBottom: bottom,
        paddingTop: 8,
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
          options={{
            title: 'Catálogo',
            tabBarIcon: ({ color, focused }) => (
              <TabIcon name="home" color={color} focused={focused} />
            ),
          }}
        />
        <StudentTabs.Screen
          name="Requests"
          component={StudentRequestsScreen}
          options={{
            title: 'Solicitudes',
            tabBarIcon: ({ color, focused }) => (
              <TabIcon name="schedule" color={color} focused={focused} />
            ),
          }}
        />
        <StudentTabs.Screen
          name="Profile"
          component={ProfileScreen}
          options={{
            title: 'Perfil',
            tabBarIcon: ({ color, focused }) => (
              <TabIcon name="person-outline" color={color} focused={focused} />
            ),
          }}
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
          options={{
            title: 'Resumen',
            tabBarIcon: ({ color, focused }) => (
              <TabIcon name="dashboard" color={color} focused={focused} />
            ),
          }}
        />
        <TeacherTabs.Screen
          name="Students"
          component={TeacherStudentsScreen}
          options={{
            title: 'Alumnos',
            tabBarIcon: ({ color, focused }) => (
              <TabIcon name="groups" color={color} focused={focused} />
            ),
          }}
        />
        <TeacherTabs.Screen
          name="Profile"
          component={ProfileScreen}
          options={{
            title: 'Perfil',
            tabBarIcon: ({ color, focused }) => (
              <TabIcon name="person-outline" color={color} focused={focused} />
            ),
          }}
        />
      </TeacherTabs.Navigator>
    );
  }

  return (
    <LabTabs.Navigator screenOptions={tabOptions}>
      <LabTabs.Screen
        name="Requests"
        component={LabRequestsScreen}
        options={{
          title: 'Solicitudes',
          tabBarIcon: ({ color, focused }) => (
            <TabIcon name="schedule" color={color} focused={focused} />
          ),
        }}
      />
      <LabTabs.Screen
        name="Inventory"
        component={InventoryScreen}
        options={{
          title: 'Inventario',
          tabBarIcon: ({ color, focused }) => (
            <TabIcon name="inventory-2" color={color} focused={focused} />
          ),
        }}
      />
      <LabTabs.Screen
        name="Profile"
        component={ProfileScreen}
        options={{
          title: 'Perfil',
          tabBarIcon: ({ color, focused }) => (
            <TabIcon name="person-outline" color={color} focused={focused} />
          ),
        }}
      />
    </LabTabs.Navigator>
  );
}
