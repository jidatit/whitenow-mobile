import type { ConfigContext, ExpoConfig } from 'expo/config';

type AppVariant = 'development' | 'preview' | 'production';

const VARIANTS: readonly AppVariant[] = ['development', 'preview', 'production'];

function resolveVariant(value: string | undefined): AppVariant {
  if (value === undefined || value === '') return 'development';
  if ((VARIANTS as readonly string[]).includes(value)) return value as AppVariant;
  throw new Error(`APP_VARIANT must be one of ${VARIANTS.join(', ')}; got "${value}".`);
}

const variant = resolveVariant(process.env.APP_VARIANT);

// TODO(client #11, #12): replace with the approved, permanent iOS bundle identifier and
// Android package name. Placeholder only; do not register it in Firebase or the stores.
const BASE_IDENTIFIER = 'com.whitenow.app.placeholder';

const VARIANT_SETTINGS: Record<AppVariant, { nameSuffix: string; idSuffix: string }> = {
  development: { nameSuffix: ' (Dev)', idSuffix: '.dev' },
  preview: { nameSuffix: ' (Preview)', idSuffix: '.preview' },
  production: { nameSuffix: '', idSuffix: '' },
};

export default ({ config }: ConfigContext): ExpoConfig => {
  const { nameSuffix, idSuffix } = VARIANT_SETTINGS[variant];
  const identifier = `${BASE_IDENTIFIER}${idSuffix}`;

  return {
    ...config,
    // TODO(client #10): confirm the final app name.
    name: `Whitenow${nameSuffix}`,
    slug: 'whitenow-mobile',
    scheme: 'whitenow',
    version: '1.0.0',
    orientation: 'portrait',
    // TODO(client #13): replace template icon and splash artwork with approved brand assets.
    icon: './assets/icon.png',
    userInterfaceStyle: 'light',
    ios: {
      bundleIdentifier: identifier,
      // TODO(client #31): confirm whether iPad support is required.
      supportsTablet: false,
    },
    android: {
      package: identifier,
      adaptiveIcon: {
        backgroundColor: '#FFFFFF',
        foregroundImage: './assets/android-icon-foreground.png',
        backgroundImage: './assets/android-icon-background.png',
        monochromeImage: './assets/android-icon-monochrome.png',
      },
      predictiveBackGestureEnabled: false,
    },
    plugins: ['expo-router'],
    experiments: {
      typedRoutes: true,
    },
    extra: {
      appVariant: variant,
    },
  };
};
