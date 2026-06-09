import * as AppleAuthentication from 'expo-apple-authentication';
import * as ImagePicker from 'expo-image-picker';
import { Platform } from 'react-native';

import { supabase } from './supabase';

export interface AuthResult {
  ok: boolean;
  error?: string;
  needsConfirmation?: boolean;
}

/**
 * Convert the current ANONYMOUS user into a permanent email account, preserving
 * their user id (and therefore favorites / predictions). Sends a confirmation
 * email; the address becomes active once confirmed.
 */
export async function upgradeWithEmail(
  email: string,
  password: string,
): Promise<AuthResult> {
  const { error } = await supabase.auth.updateUser({ email, password });
  if (error) return { ok: false, error: error.message };
  return { ok: true, needsConfirmation: true };
}

/** Sign in to an existing email account (e.g. on a second device). */
export async function signInWithEmail(
  email: string,
  password: string,
): Promise<AuthResult> {
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

/** Native Sign in with Apple (iOS only). */
export async function signInWithApple(): Promise<AuthResult> {
  if (Platform.OS !== 'ios') return { ok: false, error: 'Apple Sign-In is iOS only' };
  try {
    const credential = await AppleAuthentication.signInAsync({
      requestedScopes: [
        AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
        AppleAuthentication.AppleAuthenticationScope.EMAIL,
      ],
    });
    if (!credential.identityToken)
      return { ok: false, error: 'No identity token from Apple' };
    const { error } = await supabase.auth.signInWithIdToken({
      provider: 'apple',
      token: credential.identityToken,
    });
    if (error) return { ok: false, error: error.message };
    return { ok: true };
  } catch (e) {
    const err = e as { code?: string; message?: string };
    if (err?.code === 'ERR_REQUEST_CANCELED') return { ok: false };
    return { ok: false, error: err?.message ?? 'Apple Sign-In failed' };
  }
}

export async function isAppleAuthAvailable(): Promise<boolean> {
  // Sign in with Apple is disabled for now (the capability/entitlement was
  // removed). Keep this returning false so the Apple button stays hidden; the
  // email account flow remains available.
  return false;
}

/** Sign out and return to a fresh anonymous session (best-effort). */
export async function signOut(): Promise<void> {
  await supabase.auth.signOut();
  // Try to land back on a guest session. If anonymous sign-ins are disabled on
  // the project this fails — that's fine: the session is now null and the UI
  // falls back to the guest sign-in screen instead of getting stuck.
  const { error } = await supabase.auth.signInAnonymously();
  if (error) console.warn('signInAnonymously failed after sign out:', error.message);
}

/** Read/update the public profile row for the current user. */
export async function upsertProfile(fields: {
  display_name?: string;
  country?: string;
  avatar_url?: string;
}): Promise<AuthResult> {
  const { data } = await supabase.auth.getUser();
  const userId = data.user?.id;
  if (!userId) return { ok: false, error: 'No session' };
  const { error } = await supabase
    .from('profiles')
    .upsert({ user_id: userId, ...fields });
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

export interface AvatarResult extends AuthResult {
  url?: string;
}

/**
 * Let the user pick a photo, upload it to the `avatars` bucket under their own
 * folder, and save the public URL to their profile. Works for guests too (keyed
 * to the anonymous user id).
 */
export async function pickAndUploadAvatar(): Promise<AvatarResult> {
  const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (!perm.granted) return { ok: false, error: 'Permission denied' };

  const picked = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ['images'],
    allowsEditing: true,
    aspect: [1, 1],
    quality: 0.6,
  });
  if (picked.canceled || !picked.assets?.[0]) return { ok: false };

  const asset = picked.assets[0];
  const { data: userData } = await supabase.auth.getUser();
  const userId = userData.user?.id;
  if (!userId) return { ok: false, error: 'No session' };

  try {
    const resp = await fetch(asset.uri);
    const arrayBuffer = await resp.arrayBuffer();

    // Reject oversized uploads (storage abuse) — the picker already downscales
    // (aspect 1:1, quality 0.6), so a legit avatar is well under this.
    const MAX_AVATAR_BYTES = 5 * 1024 * 1024; // 5 MB
    if (arrayBuffer.byteLength > MAX_AVATAR_BYTES) {
      return { ok: false, error: 'Image too large (max 5 MB)' };
    }

    // Force a known image content-type instead of trusting the picker's mimeType.
    const isPng = asset.mimeType?.includes('png') ?? false;
    const ext = isPng ? 'png' : 'jpg';
    const contentType = isPng ? 'image/png' : 'image/jpeg';
    const path = `${userId}/avatar.${ext}`;

    const up = await supabase.storage
      .from('avatars')
      .upload(path, arrayBuffer, {
        contentType,
        upsert: true,
      });
    if (up.error) return { ok: false, error: up.error.message };

    const { data: pub } = supabase.storage.from('avatars').getPublicUrl(path);
    // cache-bust so the new image shows immediately
    const url = `${pub.publicUrl}?v=${Date.now()}`;

    const prof = await upsertProfile({ avatar_url: url });
    if (!prof.ok) return prof;
    return { ok: true, url };
  } catch (e) {
    const err = e as { message?: string };
    return { ok: false, error: err?.message ?? 'Upload failed' };
  }
}

/**
 * Permanently delete the account and all its data (via the delete-account edge
 * function using the service role), then return to a fresh anonymous session.
 */
export async function deleteAccount(): Promise<AuthResult> {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  if (!token) return { ok: false, error: 'No session' };
  const { error } = await supabase.functions.invoke('delete-account', {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (error) return { ok: false, error: error.message };
  await supabase.auth.signOut();
  await supabase.auth.signInAnonymously();
  return { ok: true };
}
