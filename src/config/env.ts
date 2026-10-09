import { z } from 'zod';

const nonEmpty = (name: string) =>
  z.string({ error: `${name} is required` }).trim().min(1, `${name} is required`);

export const envSchema = z.object({
  firebase: z.object({
    apiKey: nonEmpty('EXPO_PUBLIC_FIREBASE_API_KEY'),
    authDomain: nonEmpty('EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN'),
    projectId: nonEmpty('EXPO_PUBLIC_FIREBASE_PROJECT_ID'),
    storageBucket: nonEmpty('EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET'),
    messagingSenderId: nonEmpty('EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID'),
    appId: nonEmpty('EXPO_PUBLIC_FIREBASE_APP_ID'),
  }),
  apiBaseUrl: z.url({
    protocol: /^https?$/,
    error: 'EXPO_PUBLIC_API_BASE_URL must be an http(s) URL',
  }),
});

export type Env = z.infer<typeof envSchema>;

// Expo inlines EXPO_PUBLIC_* only for static `process.env.NAME` references, so each
// variable is read explicitly here rather than by iterating over process.env.
export function readRawEnv() {
  return {
    firebase: {
      apiKey: process.env.EXPO_PUBLIC_FIREBASE_API_KEY,
      authDomain: process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN,
      projectId: process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID,
      storageBucket: process.env.EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET,
      messagingSenderId: process.env.EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
      appId: process.env.EXPO_PUBLIC_FIREBASE_APP_ID,
    },
    apiBaseUrl: process.env.EXPO_PUBLIC_API_BASE_URL,
  };
}

export class EnvConfigError extends Error {
  constructor(details: string) {
    super(`Invalid app configuration. Check your .env against .env.example.\n${details}`);
    this.name = 'EnvConfigError';
  }
}

export function parseEnv(raw: unknown): Env {
  const result = envSchema.safeParse(raw);
  if (!result.success) {
    throw new EnvConfigError(z.prettifyError(result.error));
  }
  return result.data;
}

let cached: Env | undefined;

/** Validated public configuration. Throws EnvConfigError on first use if anything is missing. */
export function getEnv(): Env {
  cached ??= parseEnv(readRawEnv());
  return cached;
}
