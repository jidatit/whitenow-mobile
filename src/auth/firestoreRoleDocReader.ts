import { doc, getDocFromServer, type Firestore } from 'firebase/firestore';

import type { RoleDocReader } from './resolveRole';

/**
 * Reads exactly `<collection>/<uid>` from the server. getDocFromServer never answers from
 * the local cache, so an empty snapshot is a confirmed-absent document and an offline
 * device surfaces as an `unavailable` error instead of a false "no profile".
 */
export function createFirestoreRoleDocReader(db: Firestore): RoleDocReader {
  return async (collection, uid) => {
    const snapshot = await getDocFromServer(doc(db, collection, uid));
    if (!snapshot.exists()) return { exists: false };
    return { exists: true, data: snapshot.data() };
  };
}
