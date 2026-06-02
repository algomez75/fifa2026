import { useRouter } from 'expo-router';
import { useCallback } from 'react';
import { Alert } from 'react-native';

import { selectIsAnonymous, useAuthStore } from '@/store/useAuthStore';
import { useTranslation } from '@/store/useAppStore';

/**
 * Gate account-bound actions (favorites, predictions, challenges) behind a real
 * account. Anonymous guests — and the brief no-session bootstrap window — get a
 * prompt that sends them to the account screen instead of performing the action.
 *
 * Call the returned `requireAccount()` before the action: it returns `true` when
 * the user is a real (non-anonymous) member, otherwise it shows the prompt and
 * returns `false`.
 *
 * Gate *before* opening any in-app `<Modal>` (PredictionModal/ChallengeModal):
 * navigating to /profile while an RN Modal is visible would hide it behind the
 * modal.
 */
export function useRequireAccount() {
  const router = useRouter();
  const { t } = useTranslation();
  const user = useAuthStore((s) => s.user);
  const isAnon = useAuthStore(selectIsAnonymous);
  const isMember = !!user && !isAnon;

  const requireAccount = useCallback((): boolean => {
    if (isMember) return true;
    Alert.alert(t.account.signInRequiredTitle, t.account.signInRequiredBody, [
      { text: t.common.cancel, style: 'cancel' },
      { text: t.account.signIn, onPress: () => router.push('/profile') },
    ]);
    return false;
  }, [isMember, router, t]);

  return { isMember, requireAccount };
}
