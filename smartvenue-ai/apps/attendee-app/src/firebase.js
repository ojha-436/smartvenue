import { initializeApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: "AIzaSyCf2irbQHAyCSA806-nnuXh39AHxU-kQMg",
  authDomain: "black-network-493006-g9.firebaseapp.com",
  projectId: "black-network-493006-g9",
  storageBucket: "black-network-493006-g9.firebasestorage.app",
  messagingSenderId: "543110321230",
  appId: "1:543110321230:web:feafdceb8f92e9a1e79f1f"
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
export const googleProvider = new GoogleAuthProvider(); // We added this line!
