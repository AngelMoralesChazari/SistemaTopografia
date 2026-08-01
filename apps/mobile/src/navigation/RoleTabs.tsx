import React from 'react';
import { Text } from 'react-native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { theme } from '@lab-topo/config';
import type { UserRole } from '@lab-topo/domain';
import { PlaceholderScreen, ProfileScreen } from '../screens/PlaceholderScreen';

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

const tabOptions = {
  headerShown: false,
  tabBarActiveTintColor: theme.color.navy,
  tabBarInactiveTintColor: '#8A96A2',
  tabBarLabelStyle: { fontSize: 10, fontWeight: '700' as const },
  tabBarStyle: {
    borderTopColor: theme.color.line,
    height: 58,
    paddingBottom: 6,
    paddingTop: 6,
  },
};

function TabIcon({ label }: { label: string }) {
  return <Text style={{ fontSize: 14 }}>{label}</Text>;
}

export function RoleTabs({ role }: { role: UserRole }) {
  if (role === 'student') {
    return (
      <StudentTabs.Navigator screenOptions={tabOptions}>
        <StudentTabs.Screen
          name="Catalog"
          options={{ title: 'Catálogo', tabBarIcon: () => <TabIcon label="⌂" /> }}
        >
          {() => (
            <PlaceholderScreen
              title="Catálogo"
              subtitle="Aquí verás el material disponible y podrás solicitar préstamos. Módulo en construcción."
            />
          )}
        </StudentTabs.Screen>
        <StudentTabs.Screen
          name="Requests"
          options={{ title: 'Solicitudes', tabBarIcon: () => <TabIcon label="◷" /> }}
        >
          {() => (
            <PlaceholderScreen
              title="Mis solicitudes"
              subtitle="Consulta el estado de tus préstamos."
            />
          )}
        </StudentTabs.Screen>
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
          options={{ title: 'Resumen', tabBarIcon: () => <TabIcon label="⌂" /> }}
        >
          {() => (
            <PlaceholderScreen
              title="Resumen"
              subtitle="Alertas y préstamos vigentes de tus grupos."
            />
          )}
        </TeacherTabs.Screen>
        <TeacherTabs.Screen
          name="Students"
          options={{ title: 'Alumnos', tabBarIcon: () => <TabIcon label="▣" /> }}
        >
          {() => (
            <PlaceholderScreen
              title="Mis alumnos"
              subtitle="Supervisión de préstamos por alumno."
            />
          )}
        </TeacherTabs.Screen>
        <TeacherTabs.Screen
          name="Profile"
          component={ProfileScreen}
          options={{ title: 'Perfil', tabBarIcon: () => <TabIcon label="◯" /> }}
        />
      </TeacherTabs.Navigator>
    );
  }

  // admin y lab_manager comparten shell operativo del encargado
  return (
    <LabTabs.Navigator screenOptions={tabOptions}>
      <LabTabs.Screen
        name="Requests"
        options={{ title: 'Solicitudes', tabBarIcon: () => <TabIcon label="◷" /> }}
      >
        {() => (
          <PlaceholderScreen
            title="Solicitudes"
            subtitle="Cola de entrada: aprobar, entregar y devolver material."
          />
        )}
      </LabTabs.Screen>
      <LabTabs.Screen
        name="Inventory"
        options={{ title: 'Inventario', tabBarIcon: () => <TabIcon label="▣" /> }}
      >
        {() => (
          <PlaceholderScreen
            title="Inventario"
            subtitle="Consulta y gestión del material del laboratorio."
          />
        )}
      </LabTabs.Screen>
      <LabTabs.Screen
        name="Profile"
        component={ProfileScreen}
        options={{ title: 'Perfil', tabBarIcon: () => <TabIcon label="◯" /> }}
      />
    </LabTabs.Navigator>
  );
}
