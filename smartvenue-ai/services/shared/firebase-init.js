/**
 * Shared Firebase Admin SDK initialization for backend services
 * Validates environment variables and returns configured instances
 */

const { initializeApp, cert } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');
const { getAuth } = require('firebase-admin/auth');

/**
 * Initialize Firebase Admin SDK with validation
 * Fails loudly if required environment variables are missing or invalid
 *
 * @returns {{
 *   db: FirebaseFirestore.Firestore,
 *   admin: any,
 *   auth: FirebaseAuth.Auth
 * }}
 *   - db: Firestore database instance
 *   - admin: Firebase Admin app instance
 *   - auth: Firebase Authentication instance
 *
 * @throws {Error} If FIREBASE_KEY is missing or invalid JSON
 * @throws {Error} If Firebase initialization fails
 *
 * @example
 * const { db, admin, auth } = initializeFirebase();
 */
function initializeFirebase() {
  // Validate FIREBASE_KEY environment variable
  const firebaseKeyJson = process.env.FIREBASE_KEY;
  if (!firebaseKeyJson) {
    throw new Error(
      'FIREBASE_KEY environment variable is required. ' +
      'Set it to the JSON content of your Firebase service account key.'
    );
  }

  let firebaseKey;
  try {
    firebaseKey = JSON.parse(firebaseKeyJson);
  } catch (err) {
    throw new Error(
      `FIREBASE_KEY is not valid JSON: ${err.message}. ` +
      'Ensure it contains the complete service account key JSON.'
    );
  }

  // Validate required fields in service account key
  if (!firebaseKey.project_id || !firebaseKey.private_key || !firebaseKey.client_email) {
    throw new Error(
      'FIREBASE_KEY is missing required fields: ' +
      'project_id, private_key, or client_email. ' +
      'Ensure you are using a complete Firebase service account key.'
    );
  }

  try {
    // Initialize Firebase Admin with the service account credential
    const adminApp = initializeApp({
      credential: cert(firebaseKey),
    });

    const db = getFirestore(adminApp);
    const auth = getAuth(adminApp);

    console.log(
      `Firebase initialized for project: ${firebaseKey.project_id}`,
      `Initialized at: ${new Date().toISOString()}`
    );

    return {
      db,
      admin: adminApp,
      auth,
    };
  } catch (err) {
    console.error('Failed to initialize Firebase:', err);
    throw new Error(`Firebase initialization failed: ${err.message}`);
  }
}

module.exports = initializeFirebase;
