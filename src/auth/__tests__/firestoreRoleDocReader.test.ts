import type { Firestore } from 'firebase/firestore';

import { createFirestoreRoleDocReader } from '../firestoreRoleDocReader';
import { resolveRole } from '../resolveRole';

const mockDocs = new Map<string, Record<string, unknown>>();

// Only doc + getDocFromServer exist on this mock; any query/list API the reader tried to use
// would be undefined and fail the test.
jest.mock('firebase/firestore', () => ({
  doc: jest.fn((_db: unknown, collection: string, id: string) => ({ path: `${collection}/${id}` })),
  getDocFromServer: jest.fn(async (ref: { path: string }) => {
    const data = mockDocs.get(ref.path);
    return { exists: () => data !== undefined, data: () => data };
  }),
}));

const firestore = jest.requireMock<typeof import('firebase/firestore')>('firebase/firestore');
const db = {} as Firestore;

describe('createFirestoreRoleDocReader', () => {
  beforeEach(() => {
    mockDocs.clear();
    jest.clearAllMocks();
  });

  it('reads <collection>/<uid> from the server and returns its data', async () => {
    mockDocs.set('employees/u1', { uid: 'u1', userType: 'Employee' });
    const read = createFirestoreRoleDocReader(db);
    await expect(read('employees', 'u1')).resolves.toEqual({
      exists: true,
      data: { uid: 'u1', userType: 'Employee' },
    });
    expect(firestore.doc).toHaveBeenCalledWith(db, 'employees', 'u1');
    expect(firestore.getDocFromServer).toHaveBeenCalledTimes(1);
  });

  it('reports a confirmed-absent document', async () => {
    const read = createFirestoreRoleDocReader(db);
    await expect(read('admins', 'u1')).resolves.toEqual({ exists: false });
  });

  it('propagates SDK errors unchanged', async () => {
    const error = Object.assign(new Error('offline'), { code: 'unavailable' });
    jest.mocked(firestore.getDocFromServer).mockRejectedValueOnce(error);
    const read = createFirestoreRoleDocReader(db);
    await expect(read('admins', 'u1')).rejects.toBe(error);
  });

  it('with resolveRole, reads only the three role documents by id and stops on the first valid role', async () => {
    mockDocs.set('employees/u1', { uid: 'u1', userType: 'Employee' });
    mockDocs.set('clients/u1', { uid: 'u1', userType: 'Client' });
    const result = await resolveRole('u1', createFirestoreRoleDocReader(db));
    expect(result).toMatchObject({ status: 'resolved', role: 'Employee' });
    expect(jest.mocked(firestore.doc).mock.calls.map(([, c, id]) => `${c}/${id}`)).toEqual([
      'admins/u1',
      'employees/u1',
    ]);
  });
});
