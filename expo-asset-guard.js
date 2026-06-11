// Safety net for the release-build crash:
//   "Cannot find native module 'ExpoAsset'" — thrown at bundle evaluation when
//   the ExpoAsset native module is missing from the binary's module registry
//   (EAS release builds since 2026-06-09; dev client and Expo Go are fine).
//
// expo-asset's JS only uses `AssetModule.downloadAsync(url, md5, type)`, which
// matters for REMOTE assets; bundled/embedded assets resolve to local files
// without it. Returning the URL unchanged is a graceful degradation that keeps
// the app booting even when the native module didn't register.
//
// MUST be the very first import of the app entry (imports nothing itself).
try {
  const g = globalThis;
  if (g.expo && g.expo.modules && !g.expo.modules.ExpoAsset) {
    g.expo.modules.ExpoAsset = {
      downloadAsync: function downloadAsync(url, _md5Hash, _type) {
        return Promise.resolve(url);
      },
    };
    g.__EXPO_ASSET_STUBBED__ = true;
  }
} catch (e) {
  // Host object refused the assignment — nothing else we can do here; the
  // root error screen will surface the original error instead.
}
