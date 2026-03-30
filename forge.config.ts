import type { ForgeConfig } from '@electron-forge/shared-types';
import { MakerSquirrel } from '@electron-forge/maker-squirrel';
import { MakerZIP } from '@electron-forge/maker-zip';
import { MakerDeb } from '@electron-forge/maker-deb';
import { MakerRpm } from '@electron-forge/maker-rpm';
import { VitePlugin } from '@electron-forge/plugin-vite';
import { FusesPlugin } from '@electron-forge/plugin-fuses';
import { FuseV1Options, FuseVersion } from '@electron/fuses';
import path from 'node:path';

const isMac = process.platform === 'darwin';
const entitlements = path.resolve(process.cwd(), 'entitlements.mac.plist');
const keychainProfile =
  process.env.APPLE_KEYCHAIN_PROFILE ?? process.env.NOTARYTOOL_KEYCHAIN_PROFILE ?? 'notarytool-password';

/**
 * macOS release builds should sign by default.
 * Set `ELECTRON_FORGE_SIGN_MAC=0` for an unsigned local package.
 */
const signMac = isMac && process.env.ELECTRON_FORGE_SIGN_MAC !== '0';

/**
 * Prefer notarytool keychain credentials for local release builds, but also
 * support API key and app-specific password auth for CI.
 * Set `ELECTRON_FORGE_NOTARIZE=0` to skip notarization.
 */
const notarizeMac = signMac && process.env.ELECTRON_FORGE_NOTARIZE !== '0';

const getOsxNotarize = () => {
  if (!notarizeMac) {
    return undefined;
  }

  if (process.env.APPLE_API_KEY && process.env.APPLE_API_KEY_ID && process.env.APPLE_API_ISSUER) {
    return {
      appleApiKey: process.env.APPLE_API_KEY,
      appleApiKeyId: process.env.APPLE_API_KEY_ID,
      appleApiIssuer: process.env.APPLE_API_ISSUER,
    };
  }

  const appleIdPassword = process.env.APPLE_APP_SPECIFIC_PASSWORD ?? process.env.APPLE_PASSWORD;

  if (process.env.APPLE_ID && appleIdPassword && process.env.APPLE_TEAM_ID) {
    return {
      appleId: process.env.APPLE_ID,
      appleIdPassword,
      teamId: process.env.APPLE_TEAM_ID,
    };
  }

  return process.env.APPLE_KEYCHAIN
    ? {
        keychain: process.env.APPLE_KEYCHAIN,
        keychainProfile,
      }
    : {
        keychainProfile,
      };
};

const osxNotarize = getOsxNotarize();

// Forge's shared config types lag behind the runtime @electron/osx-sign options.
const osxSign = signMac
  ? ({
      hardenedRuntime: true,
      entitlements,
      entitlementsInherit: entitlements,
      ...(process.env.APPLE_SIGN_IDENTITY ? { identity: process.env.APPLE_SIGN_IDENTITY } : {}),
    } as NonNullable<ForgeConfig['packagerConfig']>['osxSign'])
  : undefined;

const config: ForgeConfig = {
  packagerConfig: {
    asar: true,
    appBundleId: 'com.weswecan.oct-wolk',
    extraResource: ['./assets'],
    icon: './src/build-resources/icons/icon', // Electron Forge will add .icns/.ico/.png automatically
    extendInfo: {
      CFBundleDocumentTypes: [
        {
          CFBundleTypeName: 'WOLK Project',
          CFBundleTypeRole: 'Editor',
          LSHandlerRank: 'Default',
          CFBundleTypeExtensions: ['wolk'],
          LSItemContentTypes: ['com.weswecan.oct-wolk.project'],
        },
      ],
      UTExportedTypeDeclarations: [
        {
          UTTypeIdentifier: 'com.weswecan.oct-wolk.project',
          UTTypeDescription: 'WOLK Project',
          UTTypeConformsTo: ['public.data', 'public.content'],
          UTTypeTagSpecification: {
            'public.filename-extension': ['wolk'],
          },
        },
      ],
    },
    ...(osxSign
      ? {
          osxSign,
          ...(osxNotarize ? { osxNotarize } : {}),
        }
      : {}),
  },
  rebuildConfig: {},
  makers: [new MakerSquirrel({}), new MakerZIP({}, ['darwin', 'win32']), new MakerRpm({}), new MakerDeb({})],
  plugins: [
    new VitePlugin({
      // `build` can specify multiple entry builds, which can be Main process, Preload scripts, Worker process, etc.
      // If you are familiar with Vite configuration, it will look really familiar.
      build: [
        {
          // `entry` is just an alias for `build.lib.entry` in the corresponding file of `config`.
          entry: 'src/main.ts',
          config: 'vite.main.config.ts',
          target: 'main',
        },
        {
          entry: 'src/preload.ts',
          config: 'vite.preload.config.ts',
          target: 'preload',
        },
      ],
      renderer: [
        {
          name: 'main_window',
          config: 'vite.renderer.config.ts',
        },
      ],
    }),
    // Fuses are used to enable/disable various Electron functionality
    // at package time, before code signing the application
    new FusesPlugin({
      version: FuseVersion.V1,
      [FuseV1Options.RunAsNode]: false,
      [FuseV1Options.EnableCookieEncryption]: true,
      [FuseV1Options.EnableNodeOptionsEnvironmentVariable]: false,
      [FuseV1Options.EnableNodeCliInspectArguments]: false,
      [FuseV1Options.EnableEmbeddedAsarIntegrityValidation]: true,
      [FuseV1Options.OnlyLoadAppFromAsar]: true,
    }),
  ],
};

export default config;
