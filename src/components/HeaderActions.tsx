import { useRouter } from 'expo-router';
import { Pressable, StyleSheet, View } from 'react-native';

import { useInbox } from '@/hooks/useInbox';
import { useProfileStore } from '@/store/useProfileStore';
import { AnimatedBall } from './AnimatedBall';
import { Avatar } from './Avatar';
import { LangToggle } from './LangToggle';

/** Shared header-right cluster: EN/ES toggle + notification ball + avatar.
 *  Used on every screen so account & alerts are always reachable. */
export function HeaderActions() {
  const router = useRouter();
  const avatarUrl = useProfileStore((s) => s.avatarUrl);
  const displayName = useProfileStore((s) => s.displayName);
  const { unread } = useInbox();

  return (
    <View style={styles.row}>
      <LangToggle />
      <AnimatedBall count={unread} onPress={() => router.push('/notifications')} />
      <Pressable onPress={() => router.push('/profile')} hitSlop={8}>
        <Avatar url={avatarUrl} name={displayName} size={38} />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 10 },
});
