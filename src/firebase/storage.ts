import { getStorage, type FirebaseStorage } from 'firebase/storage';

import { getFirebaseApp } from './app';

export function getFirebaseStorage(): FirebaseStorage {
  return getStorage(getFirebaseApp());
}
