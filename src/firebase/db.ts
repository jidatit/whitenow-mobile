import { getFirestore, type Firestore } from 'firebase/firestore';

import { getFirebaseApp } from './app';

export function getDb(): Firestore {
  return getFirestore(getFirebaseApp());
}
