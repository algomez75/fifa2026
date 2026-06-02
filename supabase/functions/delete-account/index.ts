// supabase/functions/delete-account/index.ts
//
// Permanently deletes the calling user's account (and all their data via
// ON DELETE CASCADE on auth.users → user_settings, profiles, predictions).
// Required by App Store guideline 5.1.1(v): in-app account deletion.
//
// Deploy: supabase functions deploy delete-account
import { createClient } from 'jsr:@supabase/supabase-js@2';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SERVICE_ROLE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });

  const authHeader = req.headers.get('Authorization');
  if (!authHeader) {
    return Response.json({ error: 'Missing Authorization' }, { status: 401, headers: cors });
  }
  const token = authHeader.replace('Bearer ', '');

  const admin = createClient(SUPABASE_URL, SERVICE_ROLE, {
    auth: { persistSession: false },
  });

  // Verify the caller and resolve their id from the token.
  const { data: userData, error: userErr } = await admin.auth.getUser(token);
  if (userErr || !userData.user) {
    return Response.json({ error: 'Invalid session' }, { status: 401, headers: cors });
  }

  const { error: delErr } = await admin.auth.admin.deleteUser(userData.user.id);
  if (delErr) {
    return Response.json({ error: delErr.message }, { status: 500, headers: cors });
  }

  return Response.json({ ok: true }, { headers: cors });
});
