import * as AppleAuthentication from 'expo-apple-authentication';
import Constants from 'expo-constants';
import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  Linking,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import Animated, {
  FadeInUp,
  FadeOutUp,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Avatar } from '@/components/Avatar';
import { ChevronLeftIcon, EyeIcon, EyeOffIcon } from '@/components/icons';
import {
  deleteAccount,
  isAppleAuthAvailable,
  pickAndUploadAvatar,
  signInWithApple,
  signInWithEmail,
  signOut,
  upgradeWithEmail,
  upsertProfile,
} from '@/lib/authActions';
import { supabase } from '@/lib/supabase';
import { palette, radius } from '@/lib/theme';
import { selectIsAnonymous, useAuthStore } from '@/store/useAuthStore';
import { useProfileStore } from '@/store/useProfileStore';
import { useTranslation } from '@/store/useAppStore';

type Flash = (type: 'error' | 'ok', text: string) => void;

export default function ProfileScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const user = useAuthStore((s) => s.user);
  const isAnon = useAuthStore(selectIsAnonymous);

  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ type: 'error' | 'ok'; text: string; id: number } | null>(null);
  const flash: Flash = (type, text) => setMsg({ type, text, id: Date.now() });

  // Auto-dismiss the toast after a few seconds (errors linger a touch longer).
  useEffect(() => {
    if (!msg) return;
    const id = setTimeout(() => setMsg(null), msg.type === 'error' ? 4200 : 3000);
    return () => clearTimeout(id);
  }, [msg]);

  // After a successful sign-in: go home if the profile is already set up,
  // otherwise stay so the avatar nudge + name field can prompt the user.
  const onAuthed = async () => {
    try {
      const { data } = await supabase.auth.getUser();
      if (!data.user) return;
      const { data: prof } = await supabase
        .from('profiles')
        .select('display_name, avatar_url')
        .eq('user_id', data.user.id)
        .maybeSingle();
      if (prof?.display_name && prof?.avatar_url) {
        router.replace('/');
      } else {
        flash('ok', t.account.welcome);
      }
    } catch {
      router.replace('/');
    }
  };

  return (
    <View style={styles.screen}>
      <View style={[styles.header, { paddingTop: insets.top + 10 }]}>
        <Pressable style={styles.closeBtn} onPress={() => router.back()} hitSlop={8}>
          <ChevronLeftIcon color={palette.text} size={22} />
        </Pressable>
        <View>
          <Text style={styles.eyebrow}>{t.account.eyebrow}</Text>
          <Text style={styles.title}>{t.account.title}</Text>
        </View>
      </View>

      {/* Floating toast — absolute so it never shifts the form or hides under
          the keyboard; auto-dismisses via the effect above. */}
      {msg ? (
        <Animated.View
          key={msg.id}
          entering={FadeInUp.springify().damping(18)}
          exiting={FadeOutUp.duration(220)}
          style={[
            styles.toast,
            { top: insets.top + 64 },
            msg.type === 'error' ? styles.toastErr : styles.toastOk,
          ]}>
          <Text style={styles.toastText}>{msg.text}</Text>
        </Animated.View>
      ) : null}

      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? insets.top + 56 : 0}>
        <ScrollView
          contentContainerStyle={styles.body}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="interactive"
          showsVerticalScrollIndicator={false}>
          <AvatarPicker busy={busy} setBusy={setBusy} flash={flash} />

          {isAnon ? (
            <GuestView busy={busy} setBusy={setBusy} flash={flash} onAuthed={onAuthed} />
          ) : (
            <MemberView
              email={user?.email ?? ''}
              busy={busy}
              setBusy={setBusy}
              flash={flash}
              onDone={() => router.back()}
            />
          )}

          <AboutSection />
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

function AboutItem({ label, onPress }: { label: string; onPress: () => void }) {
  return (
    <Pressable style={styles.aboutItem} onPress={onPress}>
      <Text style={styles.aboutLabel}>{label}</Text>
      <Text style={styles.aboutChevron}>›</Text>
    </Pressable>
  );
}

function AboutSection() {
  const { t } = useTranslation();
  const router = useRouter();
  const version = Constants.expoConfig?.version ?? '1.0.0';

  return (
    <View style={styles.aboutWrap}>
      <Text style={styles.aboutTitle}>{t.account.about}</Text>
      <View style={styles.aboutCard}>
        <AboutItem label={t.account.privacyPolicy} onPress={() => router.push('/legal/privacy')} />
        <View style={styles.aboutDivider} />
        <AboutItem label={t.account.termsOfService} onPress={() => router.push('/legal/terms')} />
        <View style={styles.aboutDivider} />
        <AboutItem
          label={t.account.support}
          onPress={() => Linking.openURL('mailto:info@portela11.com')}
        />
      </View>
      <Text style={styles.aboutMeta}>
        {t.account.version} {version}
      </Text>
      <Text style={styles.aboutAttribution}>{t.account.attribution}</Text>
    </View>
  );
}

function AvatarPicker({
  busy,
  setBusy,
  flash,
}: {
  busy: boolean;
  setBusy: (b: boolean) => void;
  flash: Flash;
}) {
  const { t } = useTranslation();
  const avatarUrl = useProfileStore((s) => s.avatarUrl);
  const displayName = useProfileStore((s) => s.displayName);
  const setProfile = useProfileStore((s) => s.setProfile);
  const incomplete = !avatarUrl;

  // Gently pulse the avatar + badge while no photo is set, hinting the user to
  // add one. Stops as soon as a photo exists.
  const pulse = useSharedValue(0);
  useEffect(() => {
    if (incomplete) {
      pulse.value = withRepeat(
        withSequence(withTiming(1, { duration: 900 }), withTiming(0, { duration: 900 })),
        -1,
        false,
      );
    } else {
      pulse.value = withTiming(0, { duration: 200 });
    }
  }, [incomplete, pulse]);

  const ringStyle = useAnimatedStyle(() => ({
    opacity: 0.55 * (1 - pulse.value),
    transform: [{ scale: 1 + pulse.value * 0.18 }],
  }));
  const badgeStyle = useAnimatedStyle(() => ({
    transform: [{ scale: 1 + pulse.value * 0.22 }],
  }));

  const change = async () => {
    setBusy(true);
    const res = await pickAndUploadAvatar();
    setBusy(false);
    if (res.ok && res.url) setProfile({ avatarUrl: res.url });
    else if (res.error) flash('error', res.error);
  };

  return (
    <View style={styles.avatarWrap}>
      <Pressable onPress={change} disabled={busy} style={styles.avatarPress}>
        {incomplete ? <Animated.View style={[styles.avatarRing, ringStyle]} /> : null}
        <Avatar url={avatarUrl} name={displayName} size={100} />
        <Animated.View style={[styles.avatarEdit, badgeStyle]}>
          <Text style={styles.avatarEditText}>＋</Text>
        </Animated.View>
      </Pressable>
      <Text style={[styles.avatarHint, incomplete && styles.avatarHintStrong]}>
        {incomplete ? t.account.completeProfile : t.account.changePhoto}
      </Text>
    </View>
  );
}

/** Password input with a minimalist show/hide eye toggle. */
function PasswordField({
  value,
  onChangeText,
}: {
  value: string;
  onChangeText: (v: string) => void;
}) {
  const { t } = useTranslation();
  const [show, setShow] = useState(false);
  return (
    <View style={styles.field}>
      <Text style={styles.label}>{t.account.passwordLabel}</Text>
      <View style={styles.passwordWrap}>
        <TextInput
          style={[styles.input, styles.passwordInput]}
          value={value}
          onChangeText={onChangeText}
          secureTextEntry={!show}
          autoCapitalize="none"
          autoComplete="password"
          placeholder="••••••••"
          placeholderTextColor={palette.textTertiary}
        />
        <Pressable
          style={styles.eyeBtn}
          onPress={() => setShow((s) => !s)}
          hitSlop={10}
          accessibilityRole="button"
          accessibilityLabel={show ? t.account.hidePassword : t.account.showPassword}>
          {show ? (
            <EyeOffIcon color={palette.textSecondary} size={20} />
          ) : (
            <EyeIcon color={palette.textSecondary} size={20} />
          )}
        </Pressable>
      </View>
    </View>
  );
}

function GuestView({
  busy,
  setBusy,
  flash,
  onAuthed,
}: {
  busy: boolean;
  setBusy: (b: boolean) => void;
  flash: Flash;
  onAuthed: () => void;
}) {
  const { t } = useTranslation();
  const [mode, setMode] = useState<'create' | 'signin'>('create');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [appleAvailable, setAppleAvailable] = useState(false);

  useEffect(() => {
    isAppleAuthAvailable().then(setAppleAvailable);
  }, []);

  const submit = async () => {
    if (!email || !password) return;
    const trimmedEmail = email.trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedEmail)) {
      return flash('error', t.account.invalidEmail);
    }
    // Only enforce a minimum on account creation; sign-in just forwards to Supabase.
    if (mode === 'create' && password.length < 8) {
      return flash('error', t.account.weakPassword);
    }
    setBusy(true);
    const res =
      mode === 'create'
        ? await upgradeWithEmail(trimmedEmail, password)
        : await signInWithEmail(trimmedEmail, password);
    setBusy(false);
    if (!res.ok) return flash('error', res.error ?? 'Error');
    if (res.needsConfirmation) {
      flash('ok', t.account.checkEmail); // create flow — must confirm by email
    } else {
      onAuthed(); // existing account signed in → home (or nudge profile)
    }
  };

  return (
    <View style={{ gap: 16 }}>
      <Text style={styles.note}>{t.account.guestNote}</Text>

      {appleAvailable ? (
        <AppleAuthentication.AppleAuthenticationButton
          buttonType={AppleAuthentication.AppleAuthenticationButtonType.CONTINUE}
          buttonStyle={AppleAuthentication.AppleAuthenticationButtonStyle.WHITE}
          cornerRadius={radius.pill}
          style={styles.appleBtn}
          onPress={async () => {
            setBusy(true);
            const res = await signInWithApple();
            setBusy(false);
            if (!res.ok && res.error) flash('error', res.error);
            else if (res.ok) onAuthed();
          }}
        />
      ) : null}

      <View style={styles.field}>
        <Text style={styles.label}>{t.account.emailLabel}</Text>
        <TextInput
          style={styles.input}
          value={email}
          onChangeText={setEmail}
          autoCapitalize="none"
          autoComplete="email"
          keyboardType="email-address"
          placeholder="you@email.com"
          placeholderTextColor={palette.textTertiary}
        />
      </View>

      <PasswordField value={password} onChangeText={setPassword} />

      <Pressable
        style={[styles.primary, busy && { opacity: 0.6 }]}
        onPress={submit}
        disabled={busy}>
        <Text style={styles.primaryText}>
          {mode === 'create' ? t.account.createAccount : t.account.signIn}
        </Text>
      </Pressable>

      <Pressable onPress={() => setMode(mode === 'create' ? 'signin' : 'create')}>
        <Text style={styles.link}>
          {mode === 'create' ? t.account.haveAccount : t.account.noAccount}
        </Text>
      </Pressable>
    </View>
  );
}

function MemberView({
  email,
  busy,
  setBusy,
  flash,
  onDone,
}: {
  email: string;
  busy: boolean;
  setBusy: (b: boolean) => void;
  flash: Flash;
  onDone: () => void;
}) {
  const { t } = useTranslation();
  const [displayName, setDisplayName] = useState('');
  const storeName = useProfileStore((s) => s.displayName);
  const nameMissing = !storeName && !displayName.trim();

  useEffect(() => {
    (async () => {
      const { data } = await supabase.auth.getUser();
      if (!data.user) return;
      const { data: prof } = await supabase
        .from('profiles')
        .select('display_name')
        .eq('user_id', data.user.id)
        .maybeSingle();
      if (prof?.display_name) setDisplayName(prof.display_name);
    })();
  }, []);

  const save = async () => {
    setBusy(true);
    const res = await upsertProfile({ display_name: displayName.trim() });
    setBusy(false);
    if (res.ok) useProfileStore.getState().setProfile({ displayName: displayName.trim() });
    flash(res.ok ? 'ok' : 'error', res.ok ? t.account.saved : res.error ?? 'Error');
  };

  const confirmDelete = () => {
    Alert.alert(t.account.deleteTitle, t.account.deleteConfirm, [
      { text: t.common.cancel, style: 'cancel' },
      {
        text: t.account.delete,
        style: 'destructive',
        onPress: async () => {
          setBusy(true);
          const res = await deleteAccount();
          setBusy(false);
          if (res.ok) onDone();
          else flash('error', res.error ?? 'Error');
        },
      },
    ]);
  };

  return (
    <View style={{ gap: 16 }}>
      <View style={styles.field}>
        <Text style={styles.label}>{t.account.signedInAs}</Text>
        <Text style={styles.email}>{email}</Text>
      </View>

      <View style={styles.field}>
        <Text style={styles.label}>{t.account.displayNameLabel}</Text>
        <TextInput
          style={[styles.input, nameMissing && styles.inputHint]}
          value={displayName}
          onChangeText={setDisplayName}
          autoFocus={nameMissing}
          placeholder={t.account.displayNamePlaceholder}
          placeholderTextColor={palette.textTertiary}
        />
      </View>
      <Pressable style={[styles.primary, busy && { opacity: 0.6 }]} onPress={save} disabled={busy}>
        <Text style={styles.primaryText}>{t.account.save}</Text>
      </Pressable>

      <Pressable style={styles.ghost} onPress={async () => { await signOut(); onDone(); }}>
        <Text style={styles.ghostText}>{t.account.signOut}</Text>
      </Pressable>

      <Pressable style={styles.danger} onPress={confirmDelete} disabled={busy}>
        <Text style={styles.dangerText}>{t.account.deleteAccount}</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: palette.bg },
  flex: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 14,
    paddingHorizontal: 20,
    paddingBottom: 16,
  },
  closeBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: palette.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  eyebrow: {
    color: palette.gold,
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1.6,
    textTransform: 'uppercase',
  },
  title: { color: palette.text, fontSize: 30, fontWeight: '900' },
  body: { paddingHorizontal: 20, paddingBottom: 80, paddingTop: 4, gap: 16 },
  avatarWrap: { alignItems: 'center', gap: 8, marginBottom: 4 },
  avatarPress: { position: 'relative', alignItems: 'center', justifyContent: 'center' },
  avatarRing: {
    position: 'absolute',
    width: 100,
    height: 100,
    borderRadius: 50,
    borderWidth: 2,
    borderColor: palette.gold,
  },
  avatarEdit: {
    position: 'absolute',
    right: -2,
    bottom: -2,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: palette.gold,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 3,
    borderColor: palette.bg,
  },
  avatarEditText: { color: palette.bg, fontSize: 18, fontWeight: '900', lineHeight: 20 },
  avatarHint: { color: palette.textSecondary, fontSize: 13, fontWeight: '600', textAlign: 'center' },
  avatarHintStrong: { color: palette.gold, paddingHorizontal: 24 },
  note: { color: palette.textSecondary, fontSize: 14, lineHeight: 20 },
  field: { gap: 6 },
  label: {
    color: palette.textSecondary,
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  input: {
    backgroundColor: palette.surface,
    borderWidth: 1,
    borderColor: palette.border,
    borderRadius: radius.md,
    paddingHorizontal: 14,
    paddingVertical: 13,
    color: palette.text,
    fontSize: 15,
  },
  inputHint: { borderColor: palette.gold },
  passwordWrap: { position: 'relative', justifyContent: 'center' },
  passwordInput: { paddingRight: 48 },
  eyeBtn: {
    position: 'absolute',
    right: 6,
    height: 40,
    width: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  email: { color: palette.text, fontSize: 16, fontWeight: '600' },
  appleBtn: { height: 50, width: '100%' },
  primary: {
    backgroundColor: palette.gold,
    borderRadius: radius.pill,
    paddingVertical: 15,
    alignItems: 'center',
  },
  primaryText: { color: palette.bg, fontSize: 16, fontWeight: '900' },
  link: { color: palette.gold, fontSize: 14, fontWeight: '700', textAlign: 'center' },
  ghost: {
    borderWidth: 1,
    borderColor: palette.border2,
    borderRadius: radius.pill,
    paddingVertical: 14,
    alignItems: 'center',
  },
  ghostText: { color: palette.text, fontSize: 15, fontWeight: '700' },
  danger: { paddingVertical: 14, alignItems: 'center' },
  dangerText: { color: palette.live, fontSize: 14, fontWeight: '700' },
  toast: {
    position: 'absolute',
    left: 20,
    right: 20,
    zIndex: 50,
    borderRadius: radius.md,
    padding: 13,
    borderWidth: 1,
    shadowColor: '#000',
    shadowOpacity: 0.3,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 6,
  },
  toastErr: { backgroundColor: '#2A1518', borderColor: palette.live },
  toastOk: { backgroundColor: '#1E2A1A', borderColor: palette.gold },
  toastText: { color: palette.text, fontSize: 13.5, fontWeight: '700', textAlign: 'center' },
  aboutWrap: { marginTop: 24, gap: 8 },
  aboutTitle: {
    color: palette.textSecondary,
    fontSize: 12,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  aboutCard: {
    backgroundColor: palette.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: palette.border,
    overflow: 'hidden',
  },
  aboutItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  aboutLabel: { color: palette.text, fontSize: 15, fontWeight: '600' },
  aboutChevron: { color: palette.textTertiary, fontSize: 20, fontWeight: '300' },
  aboutDivider: { height: 1, backgroundColor: palette.border, marginLeft: 16 },
  aboutMeta: { color: palette.textTertiary, fontSize: 12, marginTop: 8 },
  aboutAttribution: { color: palette.textTertiary, fontSize: 11, lineHeight: 16 },
});
