import { useRouter } from 'expo-router';
import { Pressable, StyleSheet, View } from 'react-native';

import { useProfileStore } from '@/store/useProfileStore';
import { Avatar } from './Avatar';
import { LangToggle } from './LangToggle';

/** Shared header-right cluster: EN/ES toggle + avatar account button.
 *  Used on every screen so the account entry point is always reachable. */
export function HeaderActions() {
  const router = useRouter();
  const avatarUrl = useProfileStore((s) => s.avatarUrl);
  const displayName = useProfileStore((s) => s.displayName);

  return (
    <View style={styles.row}>
      <LangToggle />
      <Pressable onPress={() => router.push('/profile')} hitSlop={8}>
        <Avatar url={avatarUrl} name={displayName} size={38} />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 10 },
});
