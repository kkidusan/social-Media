// ./app/api/auth/route.js
import { cert, initializeApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';

let adminApp;

try {
  if (!process.env.FIREBASE_SERVICE_ACCOUNT_KEY) {
    throw new Error('Missing Firebase service account key');
  }

  const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_KEY);

  adminApp = initializeApp({
    credential: cert(serviceAccount),
    databaseURL: `https://${process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID}.firebaseio.com`,
  });
} catch (error) {
  console.error('Firebase Admin initialization error:', error.message);
  throw error;
}

export const adminAuth = getAuth(adminApp);

export async function GET() {
  return new Response(JSON.stringify({ message: 'Auth route active' }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
}