import { cert, initializeApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';

if (!process.env.FIREBASE_SERVICE_ACCOUNT_KEY) {
  throw new Error('Missing Firebase service account key');
}

const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_KEY);

const adminApp = initializeApp({
  credential: cert(serviceAccount),
  databaseURL: `https://${process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID}.firebaseio.com`
});

export const adminAuth = getAuth(adminApp);