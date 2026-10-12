/**
 * Resolves a signed-in user's role from their profile documents, mirroring how the
 * published Firestore rules define roles (ruleset b35bcf47, see docs/RULES_DEPENDENCIES.md):
 * a role is `<collection>/{auth uid}` existing with the matching `userType`.
 *
 * Pure: it never signs anyone out and never touches Firebase directly. Firestore access is
 * injected through a RoleDocReader (see firestoreRoleDocReader.ts) so the logic is testable.
 */

export type Role = 'Admin' | 'Employee' | 'Client';
export type RoleCollection = 'admins' | 'employees' | 'clients';

/** Read order is role precedence: Admin > Employee > Client (same as the web app). */
export const ROLE_COLLECTIONS: readonly { collection: RoleCollection; role: Role }[] = [
  { collection: 'admins', role: 'Admin' },
  { collection: 'employees', role: 'Employee' },
  { collection: 'clients', role: 'Client' },
];

export type ProfileData = Record<string, unknown>;

/** A server read of exactly `<collection>/<uid>`. Rejects with the SDK error on failure. */
export type RoleDocReader = (
  collection: RoleCollection,
  uid: string,
) => Promise<{ exists: false } | { exists: true; data: ProfileData }>;

export type ProfileInvalidReason =
  | 'user-type-missing'
  | 'user-type-mismatch'
  | 'uid-not-string'
  | 'uid-mismatch';

export type ResolveRoleError =
  /** The document exists but the rules would not grant its role (or its uid is inconsistent). */
  | { kind: 'profile-invalid'; collection: RoleCollection; reason: ProfileInvalidReason }
  /**
   * Firestore denied the read. Under ruleset b35bcf47 a signed-in user can always read their
   * own role documents, so this is never "not this role": it points at a missing/expired
   * session or at something outside the rules (App Check, wrong project). The caller decides
   * whether to treat it as signed out (e.g. when auth.currentUser is null).
   */
  | { kind: 'permission'; collection: RoleCollection; code: string }
  | { kind: 'unauthenticated'; collection: RoleCollection | null; code: string }
  | { kind: 'network'; collection: RoleCollection; code: string }
  | { kind: 'config'; collection: RoleCollection; code: string }
  | { kind: 'unknown'; collection: RoleCollection; code: string | null };

export type ResolveRoleResult =
  | { status: 'resolved'; uid: string; role: Role; collection: RoleCollection; profile: ProfileData }
  | { status: 'no-profile'; uid: string }
  | { status: 'error'; uid: string; error: ResolveRoleError };

type ErrorKind = Exclude<ResolveRoleError['kind'], 'profile-invalid'>;

// Firestore codes have no prefix; auth/* codes can surface when the SDK refreshes the
// ID token for a request.
const CODE_KINDS: Record<string, ErrorKind> = {
  'permission-denied': 'permission',
  unauthenticated: 'unauthenticated',
  'auth/user-token-expired': 'unauthenticated',
  'auth/user-disabled': 'unauthenticated',
  'auth/user-not-found': 'unauthenticated',
  'auth/invalid-user-token': 'unauthenticated',
  unavailable: 'network',
  'deadline-exceeded': 'network',
  'auth/network-request-failed': 'network',
  'failed-precondition': 'config',
  'invalid-argument': 'config',
  'not-found': 'config',
  'auth/invalid-api-key': 'config',
  'auth/api-key-not-valid': 'config',
  'auth/app-not-authorized': 'config',
};

function errorCode(error: unknown): string | null {
  if (typeof error === 'object' && error !== null && 'code' in error) {
    const { code } = error as { code: unknown };
    if (typeof code === 'string') return code;
  }
  return null;
}

export function classifyReadError(error: unknown, collection: RoleCollection): ResolveRoleError {
  // Thrown by src/config/env.ts when public Firebase config is missing or malformed.
  if (error instanceof Error && error.name === 'EnvConfigError') {
    return { kind: 'config', collection, code: 'env-config' };
  }
  const code = errorCode(error);
  const kind = code === null ? undefined : CODE_KINDS[code];
  if (kind === undefined) return { kind: 'unknown', collection, code };
  return { kind, collection, code: code as string };
}

/**
 * `userType` must equal the collection's role (the rules require it).
 * `uid` is optional: the backend and signup always write it, but the rules do not require it
 * and Admin documents are created by hand. When present it must be a string equal to the
 * document id (the Auth UID).
 */
export function validateProfile(
  collection: RoleCollection,
  role: Role,
  uid: string,
  data: ProfileData,
): ProfileInvalidReason | null {
  const userType = data.userType;
  if (userType === undefined || userType === null || userType === '') return 'user-type-missing';
  if (userType !== role) return 'user-type-mismatch';
  if ('uid' in data && data.uid !== undefined) {
    if (typeof data.uid !== 'string') return 'uid-not-string';
    if (data.uid !== uid) return 'uid-mismatch';
  }
  return null;
}

export async function resolveRole(uid: string, readRoleDoc: RoleDocReader): Promise<ResolveRoleResult> {
  if (uid.trim() === '') {
    return { status: 'error', uid, error: { kind: 'unauthenticated', collection: null, code: 'missing-uid' } };
  }

  for (const { collection, role } of ROLE_COLLECTIONS) {
    let snapshot: Awaited<ReturnType<RoleDocReader>>;
    try {
      snapshot = await readRoleDoc(collection, uid);
    } catch (error) {
      return { status: 'error', uid, error: classifyReadError(error, collection) };
    }

    // Only a confirmed-absent document moves on to the next role.
    if (!snapshot.exists) continue;

    const invalid = validateProfile(collection, role, uid, snapshot.data);
    if (invalid) {
      return { status: 'error', uid, error: { kind: 'profile-invalid', collection, reason: invalid } };
    }
    return { status: 'resolved', uid, role, collection, profile: snapshot.data };
  }

  return { status: 'no-profile', uid };
}
