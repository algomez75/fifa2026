// Keeps the user-visible Android app label as "11 Gol" while the Expo project
// `name` stays a valid Swift/Xcode identifier ("OnceGol").
//
// Background: `expo.name` feeds BOTH the iOS Xcode project/module name and the
// Android launcher label. A name starting with a digit ("11 Gol" → "11Gol")
// produces a Swift module Xcode sanitizes to `_11Gol`, but ExpoModulesCore looks
// up `NSClassFromString("\(CFBundleName).ExpoModulesProvider")` with the raw
// name, silently falls back to an EMPTY modules provider, and the app dies at
// startup with "Cannot find native module 'ExpoAsset'" (blank screen). So the
// project name must not start with a digit; this plugin restores the branding
// on Android (iOS uses ios.infoPlist.CFBundleDisplayName).
const { withStringsXml, AndroidConfig } = require('expo/config-plugins');

const APP_LABEL = '11 Gol';

module.exports = function withAndroidAppName(config) {
  return withStringsXml(config, (config) => {
    config.modResults = AndroidConfig.Strings.setStringItem(
      [{ $: { name: 'app_name' }, _: APP_LABEL }],
      config.modResults,
    );
    return config;
  });
};
