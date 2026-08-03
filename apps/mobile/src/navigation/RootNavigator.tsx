import React, { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { theme } from '@lab-topo/config';
import { useAuth } from '../auth/AuthContext';
import { LoginScreen } from '../screens/LoginScreen';
import { RenterPendingScreen } from '../screens/RenterPendingScreen';
import { RenterRegisterScreen } from '../screens/RenterRegisterScreen';
import { RoleTabs } from './RoleTabs';

export type RootStackParamList = {
  Login: undefined;
  Register: undefined;
  Pending: undefined;
  App: undefined;
};

const Stack = createNativeStackNavigator<RootStackParamList>();

export function RootNavigator() {
  const { user, loading } = useAuth();
  const [authView, setAuthView] = useState<'login' | 'register'>('login');

  useEffect(() => {
    if (user) setAuthView('login');
  }, [user?.uid]);

  if (loading) {
    return (
      <View style={styles.boot}>
        <ActivityIndicator color={theme.color.navy} size="large" />
      </View>
    );
  }

  const renterBlocked =
    user?.role === 'renter' && user.renterStatus !== 'approved';

  return (
    <NavigationContainer>
      <Stack.Navigator screenOptions={{ headerShown: false }}>
        {user ? (
          renterBlocked ? (
            <Stack.Screen name="Pending" component={RenterPendingScreen} />
          ) : (
            <Stack.Screen name="App">{() => <RoleTabs role={user.role} />}</Stack.Screen>
          )
        ) : authView === 'register' ? (
          <Stack.Screen name="Register">
            {() => <RenterRegisterScreen onBack={() => setAuthView('login')} />}
          </Stack.Screen>
        ) : (
          <Stack.Screen name="Login">
            {() => <LoginScreen onGoRegister={() => setAuthView('register')} />}
          </Stack.Screen>
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
}

const styles = StyleSheet.create({
  boot: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.color.canvasMobile,
  },
});
