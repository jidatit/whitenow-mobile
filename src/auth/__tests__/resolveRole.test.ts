import { EnvConfigError } from '@/config/env';

import {
  resolveRole,
  type ProfileData,
  type RoleCollection,
  type RoleDocReader,
} from '../resolveRole';

const UID = 'user-123';

type Outcome = { exists: false } | { exists: true; data: ProfileData } | { throws: unknown };

function codeError(code: string) {
  return Object.assign(new Error(`firebase: ${code}`), { name: 'FirebaseError', code });
}

/** Fake reader: every collection is absent unless an outcome is given. Records each call. */
function fakeReader(outcomes: Partial<Record<RoleCollection, Outcome>> = {}) {
  const reader = jest.fn<ReturnType<RoleDocReader>, Parameters<RoleDocReader>>(async (collection) => {
    const outcome = outcomes[collection] ?? { exists: false };
    if ('throws' in outcome) throw outcome.throws;
    return outcome;
  });
  return reader;
}

const admin = { uid: UID, userType: 'Admin', name: 'A' };
const employee = { uid: UID, userType: 'Employee', name: 'E' };
const client = { uid: UID, userType: 'Client', name: 'C' };

describe('resolveRole: successful resolution', () => {
  it.each([
    ['admins', 'Admin', admin],
    ['employees', 'Employee', employee],
    ['clients', 'Client', client],
  ] as const)('resolves %s as %s', async (collection, role, data) => {
    const read = fakeReader({ [collection]: { exists: true, data } });
    await expect(resolveRole(UID, read)).resolves.toEqual({
      status: 'resolved',
      uid: UID,
      role,
      collection,
      profile: data,
    });
  });

  it('reads admins, then employees, then clients, each by document id', async () => {
    const read = fakeReader({ clients: { exists: true, data: client } });
    await resolveRole(UID, read);
    expect(read.mock.calls).toEqual([
      ['admins', UID],
      ['employees', UID],
      ['clients', UID],
    ]);
  });

  it('applies precedence Admin > Employee > Client and stops at the first valid role', async () => {
    const read = fakeReader({
      admins: { exists: true, data: admin },
      employees: { exists: true, data: employee },
      clients: { exists: true, data: client },
    });
    const result = await resolveRole(UID, read);
    expect(result).toMatchObject({ status: 'resolved', role: 'Admin' });
    expect(read).toHaveBeenCalledTimes(1);
  });

  it('prefers Employee over Client and does not read clients', async () => {
    const read = fakeReader({
      employees: { exists: true, data: employee },
      clients: { exists: true, data: client },
    });
    await expect(resolveRole(UID, read)).resolves.toMatchObject({ role: 'Employee' });
    expect(read.mock.calls.map(([c]) => c)).toEqual(['admins', 'employees']);
  });

  it('accepts a profile without a uid field (optional per schema decision)', async () => {
    const data = { userType: 'Admin', name: 'Hand-made admin' };
    const read = fakeReader({ admins: { exists: true, data } });
    await expect(resolveRole(UID, read)).resolves.toMatchObject({ status: 'resolved', role: 'Admin' });
  });
});

describe('resolveRole: missing documents', () => {
  it('returns no-profile when all three documents are absent', async () => {
    const read = fakeReader();
    await expect(resolveRole(UID, read)).resolves.toEqual({ status: 'no-profile', uid: UID });
    expect(read).toHaveBeenCalledTimes(3);
  });

  it('rejects an empty uid without reading anything', async () => {
    const read = fakeReader();
    await expect(resolveRole('  ', read)).resolves.toEqual({
      status: 'error',
      uid: '  ',
      error: { kind: 'unauthenticated', collection: null, code: 'missing-uid' },
    });
    expect(read).not.toHaveBeenCalled();
  });
});

describe('resolveRole: invalid profiles never fall through', () => {
  it.each([
    ['missing userType', { uid: UID }, 'user-type-missing'],
    ['null userType', { uid: UID, userType: null }, 'user-type-missing'],
    ['empty userType', { uid: UID, userType: '' }, 'user-type-missing'],
    ['mismatched userType', { uid: UID, userType: 'Employee' }, 'user-type-mismatch'],
    ['wrong-case userType', { uid: UID, userType: 'admin' }, 'user-type-mismatch'],
    ['mismatched uid', { uid: 'someone-else', userType: 'Admin' }, 'uid-mismatch'],
    ['non-string uid', { uid: 42, userType: 'Admin' }, 'uid-not-string'],
    ['null uid', { uid: null, userType: 'Admin' }, 'uid-not-string'],
  ] as const)('admins doc with %s is profile-invalid', async (_label, data, reason) => {
    const read = fakeReader({
      admins: { exists: true, data: data as ProfileData },
      employees: { exists: true, data: employee },
    });
    await expect(resolveRole(UID, read)).resolves.toEqual({
      status: 'error',
      uid: UID,
      error: { kind: 'profile-invalid', collection: 'admins', reason },
    });
    expect(read).toHaveBeenCalledTimes(1);
  });

  it('reports the collection where the invalid profile was found', async () => {
    const read = fakeReader({
      employees: { exists: true, data: { uid: UID, userType: 'Client' } },
      clients: { exists: true, data: client },
    });
    await expect(resolveRole(UID, read)).resolves.toMatchObject({
      status: 'error',
      error: { kind: 'profile-invalid', collection: 'employees', reason: 'user-type-mismatch' },
    });
    expect(read).toHaveBeenCalledTimes(2);
  });
});

describe('resolveRole: read errors stop resolution and are classified', () => {
  it.each([
    ['permission-denied', 'permission'],
    ['unauthenticated', 'unauthenticated'],
    ['auth/user-token-expired', 'unauthenticated'],
    ['auth/user-disabled', 'unauthenticated'],
    ['unavailable', 'network'],
    ['deadline-exceeded', 'network'],
    ['auth/network-request-failed', 'network'],
    ['failed-precondition', 'config'],
    ['invalid-argument', 'config'],
    ['not-found', 'config'],
    ['auth/invalid-api-key', 'config'],
    ['internal', 'unknown'],
    ['resource-exhausted', 'unknown'],
  ])('%s -> %s', async (code, kind) => {
    const read = fakeReader({ admins: { throws: codeError(code) }, employees: { exists: true, data: employee } });
    await expect(resolveRole(UID, read)).resolves.toEqual({
      status: 'error',
      uid: UID,
      error: { kind, collection: 'admins', code },
    });
    // An error is never treated as "absent": the next role is not read.
    expect(read).toHaveBeenCalledTimes(1);
  });

  it('treats permission-denied on a later collection as an error, not a missing role', async () => {
    const read = fakeReader({
      employees: { throws: codeError('permission-denied') },
      clients: { exists: true, data: client },
    });
    await expect(resolveRole(UID, read)).resolves.toEqual({
      status: 'error',
      uid: UID,
      error: { kind: 'permission', collection: 'employees', code: 'permission-denied' },
    });
    expect(read.mock.calls.map(([c]) => c)).toEqual(['admins', 'employees']);
  });

  it('classifies a missing or invalid public config as config', async () => {
    const read = fakeReader({ admins: { throws: new EnvConfigError('EXPO_PUBLIC_FIREBASE_API_KEY is required') } });
    await expect(resolveRole(UID, read)).resolves.toMatchObject({
      error: { kind: 'config', collection: 'admins', code: 'env-config' },
    });
  });

  it.each([
    ['an Error without a code', new Error('boom')],
    ['a non-string code', Object.assign(new Error('x'), { code: 7 })],
    ['a thrown string', 'boom'],
    ['undefined', undefined],
  ])('classifies %s as unknown', async (_label, thrown) => {
    const read = fakeReader({ admins: { throws: thrown } });
    await expect(resolveRole(UID, read)).resolves.toMatchObject({
      status: 'error',
      error: { kind: 'unknown', collection: 'admins', code: null },
    });
  });
});
