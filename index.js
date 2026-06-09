// Custom entry point.
//
// A production build that throws BEFORE React mounts (e.g. an error while a
// module is being evaluated at startup) shows only a blank white screen with no
// way to read the cause on-device. This entry wraps the expo-router bootstrap in
// a try/catch and installs a global error handler, so any such error is rendered
// on screen (selectable text) instead of a white screen — we can then copy it
// from a TestFlight build. Once the startup bug is fixed this stays as a safety net.
import { registerRootComponent } from 'expo';
import React from 'react';
import { ScrollView, Text } from 'react-native';

function FatalScreen({ error }) {
  const message = error ? error.message || String(error) : 'Unknown startup error';
  const stack = error && error.stack ? String(error.stack) : '';
  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: '#0A0E1A' }}
      contentContainerStyle={{ padding: 24, paddingTop: 80 }}>
      <Text style={{ color: '#D4AF37', fontSize: 20, fontWeight: '800', marginBottom: 12 }}>
        Startup error
      </Text>
      <Text selectable style={{ color: '#FFFFFF', fontSize: 14, marginBottom: 12 }}>
        {message}
      </Text>
      <Text selectable style={{ color: '#8A93A6', fontSize: 11 }}>
        {stack}
      </Text>
    </ScrollView>
  );
}

// Capture async / uncaught errors too (e.g. thrown outside render).
if (global.ErrorUtils && typeof global.ErrorUtils.setGlobalHandler === 'function') {
  const previous = global.ErrorUtils.getGlobalHandler && global.ErrorUtils.getGlobalHandler();
  global.ErrorUtils.setGlobalHandler((error, isFatal) => {
    if (isFatal) {
      try {
        registerRootComponent(() => <FatalScreen error={error} />);
      } catch (_e) {
        // ignore — fall through to the previous handler
      }
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
  registerRootComponent(() => <FatalScreen error={error} />);
}
