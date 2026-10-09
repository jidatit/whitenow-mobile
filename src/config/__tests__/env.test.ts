import { EnvConfigError, parseEnv } from '../env';

// Dummy values for schema tests only; not real configuration.
const valid = {
  firebase: {
    apiKey: 'test-api-key',
    authDomain: 'example.firebaseapp.com',
    projectId: 'example-project',
    storageBucket: 'example-project.firebasestorage.app',
    messagingSenderId: '000000000000',
    appId: '1:000000000000:web:0000000000000000',
  },
  apiBaseUrl: 'https://api.example.test',
};

describe('parseEnv', () => {
  it('accepts a complete configuration', () => {
    expect(parseEnv(valid)).toEqual(valid);
  });

  it('rejects a missing Firebase value and names the variable', () => {
    const raw = { ...valid, firebase: { ...valid.firebase, apiKey: undefined } };
    expect(() => parseEnv(raw)).toThrow(EnvConfigError);
    expect(() => parseEnv(raw)).toThrow(/EXPO_PUBLIC_FIREBASE_API_KEY/);
  });

  it('rejects blank values', () => {
    const raw = { ...valid, firebase: { ...valid.firebase, projectId: '   ' } };
    expect(() => parseEnv(raw)).toThrow(/EXPO_PUBLIC_FIREBASE_PROJECT_ID/);
  });

  it('rejects a non-http API base URL', () => {
    expect(() => parseEnv({ ...valid, apiBaseUrl: 'ftp://api.example.test' })).toThrow(
      /EXPO_PUBLIC_API_BASE_URL/,
    );
    expect(() => parseEnv({ ...valid, apiBaseUrl: 'not a url' })).toThrow(/EXPO_PUBLIC_API_BASE_URL/);
  });
});
