import {
  generateAuthenticationOptions,
  generateRegistrationOptions,
  verifyAuthenticationResponse,
  verifyRegistrationResponse,
} from '@simplewebauthn/server';
import type {
  VerifiedAuthenticationResponse,
  VerifiedRegistrationResponse,
  AuthenticationResponseJSON,
  RegistrationResponseJSON,
  AuthenticatorTransportFuture,
} from '@simplewebauthn/server';

import { createAdminClient, createClient } from '@/lib/supabase/server';
import { AUTH_PORTAL, getAuthPortalHostname, getPasskeyRpId } from '@/lib/auth-config';
import { debugLog } from '@/lib/auth-debug';

function getExpectedOrigin(): string {
  // Must match the browser origin exactly (scheme + host + optional port)
  return AUTH_PORTAL.BASE_URL;
}

function getRpName(): string {
  return process.env.NEXT_PUBLIC_AUTH_PASSKEY_RP_NAME || 'Auth Portal';
}

export type PasskeyCredentialRow = {
  id: string;
  user_id: string;
  credential_id: string;
  public_key: string;
  counter: number;
  device_type: string | null;
  backed_up: boolean | null;
  transports: string[] | null;
  name: string | null;
  created_at: string;
  last_used_at: string | null;
};

function toBase64Url(buf: Uint8Array): string {
  return Buffer.from(buf).toString('base64url');
}

function fromBase64Url(str: string): Uint8Array<ArrayBuffer> {
  const buffer = Buffer.from(str, 'base64url');
  return new Uint8Array(buffer.buffer, buffer.byteOffset, buffer.byteLength) as Uint8Array<ArrayBuffer>;
}

async function storeChallenge(params: {
  challenge: string;
  type: 'registration' | 'authentication';
  userId?: string | null;
}): Promise<void> {
  const supabase = await createAdminClient();
  const { error } = await supabase
    .schema('access_broker_app')
    .from('passkey_challenges')
    .insert({
      challenge: params.challenge,
      type: params.type,
      user_id: params.userId ?? null,
    });
  if (error) {
    console.error('[Passkey] Failed to store challenge:', error);
    throw error;
  }
  debugLog('[Passkey] Challenge stored for user:', params.userId, 'type:', params.type);
}

async function loadChallenge(params: {
  type: 'registration' | 'authentication';
  userId?: string | null;
  challenge?: string | null;
}): Promise<{ id: string; challenge: string; user_id: string | null } | null> {
  const supabase = await createAdminClient();

  debugLog('[Passkey] Loading challenge:', { type: params.type, userId: params.userId, now: new Date().toISOString() });

  let q = supabase
    .schema('access_broker_app')
    .from('passkey_challenges')
    .select('id,challenge,user_id,expires_at,created_at,type')
    .eq('type', params.type)
    .gt('expires_at', new Date().toISOString())
    .order('created_at', { ascending: false })
    .limit(1);

  if (params.userId) q = q.eq('user_id', params.userId);
  if (params.challenge) q = q.eq('challenge', params.challenge);

  const { data, error } = await q.maybeSingle();
  if (error) {
    console.error('[Passkey] Failed to load challenge:', error);
  }
  debugLog('[Passkey] Challenge lookup result:', data ? { id: data.id, expires_at: data.expires_at } : 'not found');
  return data ? { id: data.id, challenge: data.challenge, user_id: data.user_id } : null;
}

async function deleteChallenge(id: string): Promise<void> {
  const supabase = await createAdminClient();
  await supabase.schema('access_broker_app').from('passkey_challenges').delete().eq('id', id);
}

export async function getUserPasskeys(userId: string): Promise<PasskeyCredentialRow[]> {
  const supabase = await createAdminClient();
  const { data, error } = await supabase
    .schema('access_broker_app')
    .from('passkey_credentials')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false });

  if (error) throw error;
  return (data || []) as PasskeyCredentialRow[];
}

export async function generateRegistrationOptionsForCurrentUser(): Promise<{
  options: Awaited<ReturnType<typeof generateRegistrationOptions>>;
}> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user?.id || !user.email) {
    throw new Error('Not authenticated');
  }

  const existing = await getUserPasskeys(user.id);
  const rpID = getPasskeyRpId();

  const options = await generateRegistrationOptions({
    rpName: getRpName(),
    rpID,
    userID: new TextEncoder().encode(user.id),
    userName: user.email,
    userDisplayName: user.email,
    attestationType: 'none',
    excludeCredentials: existing.map((c) => ({
      id: c.credential_id,
      transports: c.transports as AuthenticatorTransportFuture[] | undefined,
    })),
    authenticatorSelection: {
      residentKey: 'preferred',
      userVerification: 'required',
    },
  });

  await storeChallenge({ challenge: options.challenge, type: 'registration', userId: user.id });

  return { options };
}

export async function verifyRegistrationForCurrentUser(params: {
  response: RegistrationResponseJSON;
  name?: string | null;
}): Promise<VerifiedRegistrationResponse> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user?.id) {
    throw new Error('Not authenticated');
  }

  const stored = await loadChallenge({ type: 'registration', userId: user.id });
  if (!stored) {
    throw new Error('Registration challenge not found or expired');
  }

  const expectedOrigin = getExpectedOrigin();
  const expectedRPID = getPasskeyRpId();

  const verification = await verifyRegistrationResponse({
    response: params.response,
    expectedChallenge: stored.challenge,
    expectedOrigin,
    expectedRPID,
    requireUserVerification: true,
  });

  if (verification.verified && verification.registrationInfo) {
    const { credential, credentialDeviceType, credentialBackedUp } = verification.registrationInfo;

    const supabaseAdmin = await createAdminClient();
    const insert = await supabaseAdmin
      .schema('access_broker_app')
      .from('passkey_credentials')
      .insert({
        user_id: user.id,
        credential_id: credential.id,
        public_key: toBase64Url(credential.publicKey),
        counter: credential.counter,
        device_type: credentialDeviceType,
        backed_up: credentialBackedUp,
        transports: params.response.response.transports || null,
        name: params.name || null,
      });
    if (insert.error) throw insert.error;
  }

  await deleteChallenge(stored.id);
  return verification;
}

export async function generateAuthenticationOptionsForLogin(): Promise<{
  options: Awaited<ReturnType<typeof generateAuthenticationOptions>>;
}> {
  const rpID = getPasskeyRpId();

  const options = await generateAuthenticationOptions({
    rpID,
    userVerification: 'required',
  });

  // We intentionally keep this discoverable (no allowCredentials) so we don't need to
  // look up users by email (Supabase doesn't provide a simple getUserByEmail).
  await storeChallenge({ challenge: options.challenge, type: 'authentication', userId: null });

  return { options };
}

export async function verifyAuthentication(params: {
  response: AuthenticationResponseJSON;
}): Promise<VerifiedAuthenticationResponse & { userId: string }> {
  // Extract the challenge from clientDataJSON so we can load the stored record.
  const clientData = JSON.parse(Buffer.from(params.response.response.clientDataJSON, 'base64').toString('utf-8')) as {
    challenge?: string;
  };
  const challenge = clientData.challenge;
  if (!challenge) throw new Error('Missing challenge in clientData');

  const storedByChallenge = await loadChallenge({ type: 'authentication', challenge });
  if (!storedByChallenge) throw new Error('Authentication challenge not found or expired');

  const credentialIdB64Url = params.response.id;

  const supabaseAdmin = await createAdminClient();
  const { data: keyRow, error: keyErr } = await supabaseAdmin
    .schema('access_broker_app')
    .from('passkey_credentials')
    .select('*')
    .eq('credential_id', credentialIdB64Url)
    .maybeSingle();
  if (keyErr) throw keyErr;
  if (!keyRow) throw new Error('Unknown credential');

  if (storedByChallenge.user_id && storedByChallenge.user_id !== keyRow.user_id) {
    throw new Error('Credential does not match requested user');
  }

  const expectedOrigin = getExpectedOrigin();
  const expectedRPID = getPasskeyRpId();

  const verification = await verifyAuthenticationResponse({
    response: params.response,
    expectedChallenge: storedByChallenge.challenge,
    expectedOrigin,
    expectedRPID,
    requireUserVerification: true,
    credential: {
      id: keyRow.credential_id,
      publicKey: fromBase64Url(keyRow.public_key),
      counter: keyRow.counter || 0,
      transports: keyRow.transports as AuthenticatorTransportFuture[] | undefined,
    },
  });

  if (verification.verified) {
    const newCounter = verification.authenticationInfo.newCounter;
    await supabaseAdmin
      .schema('access_broker_app')
      .from('passkey_credentials')
      .update({ counter: newCounter, last_used_at: new Date().toISOString() })
      .eq('id', keyRow.id);
  }

  await deleteChallenge(storedByChallenge.id);
  return Object.assign(verification, { userId: keyRow.user_id as string });
}

export async function generateSupabaseMagicLinkForUser(params: {
  userId: string;
  redirectTo: string;
}): Promise<string> {
  const supabaseAdmin = await createAdminClient();

  const { data: userData, error: userErr } = await supabaseAdmin.auth.admin.getUserById(
    params.userId
  );
  if (userErr) throw userErr;
  const email = userData.user?.email;
  if (!email) throw new Error('User has no email');

  const { data, error } = await supabaseAdmin.auth.admin.generateLink({
    type: 'magiclink',
    email,
    options: { redirectTo: params.redirectTo },
  });
  if (error) throw error;

  const actionLink = data.properties?.action_link;
  if (!actionLink) throw new Error('Failed to generate action link');
  return actionLink;
}

export function getDefaultPasskeyRpIdDebug(): { rpId: string; origin: string; host: string } {
  return { rpId: getPasskeyRpId(), origin: getExpectedOrigin(), host: getAuthPortalHostname() };
}
