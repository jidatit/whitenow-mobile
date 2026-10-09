import { getApp, getApps, initializeApp, type FirebaseApp } from 'firebase/app';

import { getEnv } from '@/config/env';

/**
 * The single Firebase app instance. Reuses an existing default app (for example after a
 * Fast Refresh) instead of initialising a second one.
 *
 * Client SDK only: access is governed by Firebase Security Rules. Privileged operations go
 * through the authenticated backend, never through Admin credentials in this app.
 */
export function getFirebaseApp(): FirebaseApp {
  return getApps().length > 0 ? getApp() : initializeApp(getEnv().firebase);
}
