import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { TeacherStudentsScreen } from '../screens/TeacherStudentsScreen';
import { TeacherStudentHistoryScreen } from '../screens/TeacherStudentHistoryScreen';

export type TeacherStudentsStackParamList = {
  StudentsList: undefined;
  StudentHistory: {
    studentId: string;
    studentName: string;
    studentNumber: string | null;
  };
};

const Stack = createNativeStackNavigator<TeacherStudentsStackParamList>();

export function TeacherStudentsStack() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="StudentsList" component={TeacherStudentsScreen} />
      <Stack.Screen name="StudentHistory" component={TeacherStudentHistoryScreen} />
    </Stack.Navigator>
  );
}
