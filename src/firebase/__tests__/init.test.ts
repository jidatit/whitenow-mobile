const mockApp = { name: '[DEFAULT]' };
const mockAuth = { app: mockApp };
const mockApps: object[] = [];

jest.mock('@/config/env', () => ({
  getEnv: () => ({ firebase: { projectId: 'test-project' }, apiBaseUrl: 'https://api.example.test' }),
}));

jest.mock('firebase/app', () => {
  class FirebaseError extends Error {
    code: string;
    constructor(errorCode: string, message: string) {
      super(message);
      this.code = errorCode;
    }
  }
  return {
    FirebaseError,
    getApps: jest.fn(() => mockApps),
    getApp: jest.fn(() => mockApp),
    initializeApp: jest.fn(() => {
      mockApps.push(mockApp);
      return mockApp;
    }),
  };
});

jest.mock('firebase/auth', () => ({
  initializeAuth: jest.fn(() => mockAuth),
  getAuth: jest.fn(() => mockAuth),
  getReactNativePersistence: jest.fn(() => 'rn-persistence'),
}));

jest.mock('@react-native-async-storage/async-storage', () => ({}));

// Loads fresh copies of the modules under test together with the mocks they see.
function load() {
  jest.resetModules();
  mockApps.length = 0;
  return {
    firebaseApp: jest.requireMock<typeof import('firebase/app')>('firebase/app'),
    firebaseAuth: jest.requireMock<typeof import('firebase/auth')>('firebase/auth'),
    app: require('../app') as typeof import('../app'),
    auth: require('../auth') as typeof import('../auth'),
  };
}

describe('Firebase initialisation', () => {

  it('initialises the app once and reuses it', () => {
    const { firebaseApp, app } = load();
    expect(app.getFirebaseApp()).toBe(mockApp);
    expect(app.getFirebaseApp()).toBe(mockApp);
    expect(firebaseApp.initializeApp).toHaveBeenCalledTimes(1);
  });

  it('initialises auth with React Native persistence once', () => {
    const { firebaseAuth, auth } = load();
    expect(auth.getFirebaseAuth()).toBe(mockAuth);
    expect(auth.getFirebaseAuth()).toBe(mockAuth);
    expect(firebaseAuth.initializeAuth).toHaveBeenCalledTimes(1);
    expect(firebaseAuth.initializeAuth).toHaveBeenCalledWith(mockApp, { persistence: 'rn-persistence' });
  });

  it('falls back to the existing auth instance when auth was already initialised', () => {
    const { firebaseApp, firebaseAuth, auth } = load();
    jest.mocked(firebaseAuth.initializeAuth).mockImplementationOnce(() => {
      throw new firebaseApp.FirebaseError('auth/already-initialized', 'already initialised');
    });
    expect(auth.getFirebaseAuth()).toBe(mockAuth);
    expect(firebaseAuth.getAuth).toHaveBeenCalledWith(mockApp);
  });

  it('rethrows unexpected auth initialisation errors', () => {
    const { firebaseAuth, auth } = load();
    jest.mocked(firebaseAuth.initializeAuth).mockImplementationOnce(() => {
      throw new Error('boom');
    });
    expect(() => auth.getFirebaseAuth()).toThrow('boom');
  });
});
