import * as AppleAuthentication from 'expo-apple-authentication';
import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import {
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Avatar } from '@/components/Avatar';
import { ChevronLeftIcon } from '@/components/icons';
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

export default function ProfileScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const user = useAuthStore((s) => s.user);
  const isAnon = useAuthStore(selectIsAnonymous);

  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ type: 'error' | 'ok'; text: string } | null>(null);
  const flash = (type: 'error' | 'ok', text: string) => setMsg({ type, text });

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

      <ScrollView contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled">
        {msg ? (
          <View style={[styles.alert, msg.type === 'error' ? styles.alertErr : styles.alertOk]}>
            <Text style={styles.alertText}>{msg.text}</Text>
          </View>
        ) : null}

        <AvatarPicker busy={busy} setBusy={setBusy} flash={flash} />

        {isAnon ? (
          <GuestView busy={busy} setBusy={setBusy} flash={flash} />
        ) : (
          <MemberView
            email={user?.email ?? ''}
            busy={busy}
            setBusy={setBusy}
            flash={flash}
            onDone={() => router.back()}
          />
        )}
      </ScrollView>
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
  flash: (t: 'error' | 'ok', s: string) => void;
}) {
  const { t } = useTranslation();
  const avatarUrl = useProfileStore((s) => s.avatarUrl);
  const displayName = useProfileStore((s) => s.displayName);
  const setProfile = useProfileStore((s) => s.setProfile);

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
        <Avatar url={avatarUrl} name={displayName} size={100} />
        <View style={styles.avatarEdit}>
          <Text style={styles.avatarEditText}>＋</Text>
        </View>
      </Pressable>
      <Text style={styles.avatarHint}>{t.account.changePhoto}</Text>
    </View>
  );
}

function GuestView({
  busy,
  setBusy,
  flash,
}: {
  busy: boolean;
  setBusy: (b: boolean) => void;
  flash: (t: 'error' | 'ok', s: string) => void;
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
    setBusy(true);
    const res =
      mode === 'create'
        ? await upgradeWithEmail(email.trim(), password)
        : await signInWithEmail(email.trim(), password);
    setBusy(false);
    if (!res.ok) return flash('error', res.error ?? 'Error');
    if (res.needsConfirmation) flash('ok', t.account.checkEmail);
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
          keyboardType="email-address"
          placeholder="you@email.com"
          placeholderTextColor={palette.textTertiary}
        />
      </View>
      <View style={styles.field}>
        <Text style={styles.label}>{t.account.passwordLabel}</Text>
        <TextInput
          style={styles.input}
          value={password}
          onChangeText={setPassword}
          secureTextEntry
          placeholder="••••••••"
          placeholderTextColor={palette.textTertiary}
        />
      </View>

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
  flash: (t: 'error' | 'ok', s: string) => void;
  onDone: () => void;
}) {
  const { t } = useTranslation();
  const [displayName, setDisplayName] = useState('');

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
          style={styles.input}
          value={displayName}
          onChangeText={setDisplayName}
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
  body: { paddingHorizontal: 20, paddingBottom: 60, gap: 16 },
  avatarWrap: { alignItems: 'center', gap: 8, marginBottom: 4 },
  avatarPress: { position: 'relative' },
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
  avatarHint: { color: palette.textSecondary, fontSize: 13, fontWeight: '600' },
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
  alert: { borderRadius: radius.md, padding: 12, borderWidth: 1 },
  alertErr: { backgroundColor: palette.liveDim, borderColor: palette.live },
  alertOk: { backgroundColor: palette.goldDim, borderColor: palette.gold },
  alertText: { color: palette.text, fontSize: 13, fontWeight: '600' },
});
