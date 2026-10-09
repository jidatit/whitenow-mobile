import AsyncStorage from '@react-native-async-storage/async-storage';
import { FirebaseError } from 'firebase/app';
import { getAuth, getReactNativePersistence, initializeAuth, type Auth } from 'firebase/auth';

import { getFirebaseApp } from './app';

let authInstance: Auth | undefined;

/**
 * Firebase Auth with AsyncStorage persistence, so sessions survive app restarts.
 * initializeAuth may only run once per app; if it already ran (e.g. the module was
 * re-evaluated by Fast Refresh) the existing instance is returned instead.
 */
export function getFirebaseAuth(): Auth {
  if (authInstance) return authInstance;
  const app = getFirebaseApp();
  try {
    authInstance = initializeAuth(app, {
      persistence: getReactNativePersistence(AsyncStorage),
    });
  } catch (error) {
    if (error instanceof FirebaseError && error.code === 'auth/already-initialized') {
      authInstance = getAuth(app);
    } else {
      throw error;
    }
  }
  return authInstance;
}
