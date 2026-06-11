// Custom entry point — hardened.
//
// 1. `expo-asset-guard` runs before anything else (it imports nothing) and
//    stubs the ExpoAsset native module if the binary failed to register it —
//    the cause of the white-screen-at-launch in EAS release builds.
// 2. The whole app (including the `expo` package itself) is loaded lazily
//    inside try/catch, so ANY module-evaluation error renders on screen as
//    selectable text (via bare React Native AppRegistry — no expo imports)
//    instead of a silent blank screen.
import './expo-asset-guard';

function registerFatalScreen(error) {
  try {
    const React = require('react');
    const { AppRegistry, ScrollView, Text } = require('react-native');
    const message = error ? error.message || String(error) : 'Unknown startup error';
    const stack = error && error.stack ? String(error.stack) : '';
    function FatalScreen() {
      return React.createElement(
        ScrollView,
        {
          style: { flex: 1, backgroundColor: '#0A0E1A' },
          contentContainerStyle: { padding: 24, paddingTop: 80 },
        },
        React.createElement(
          Text,
          { selectable: true, style: { color: '#D4AF37', fontSize: 20, fontWeight: '800', marginBottom: 12 } },
          'Startup error',
        ),
        React.createElement(
          Text,
          { selectable: true, style: { color: '#FFFFFF', fontSize: 14, marginBottom: 12 } },
          message,
        ),
        React.createElement(
          Text,
          { selectable: true, style: { color: '#8A93A6', fontSize: 11 } },
          stack,
        ),
      );
    }
    AppRegistry.registerComponent('main', () => FatalScreen);
  } catch (_e) {
    // truly nothing more we can do
  }
}

// Capture async / uncaught fatal errors too (e.g. thrown outside render).
if (global.ErrorUtils && typeof global.ErrorUtils.setGlobalHandler === 'function') {
  const previous = global.ErrorUtils.getGlobalHandler && global.ErrorUtils.getGlobalHandler();
  global.ErrorUtils.setGlobalHandler((error, isFatal) => {
    if (isFatal) {
      registerFatalScreen(error);
    }
    if (previous) {
      try {
        previous(error, isFatal);
      } catch (_e) {
        // ignore
      }
    }
  });
}

try {
  // Side-effect import: evaluates the app tree and registers the router root.
  require('expo-router/entry');
} catch (error) {
  registerFatalScreen(error);
}
