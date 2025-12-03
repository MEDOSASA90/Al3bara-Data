// Updated to use Firebase SDK v9+ modular syntax to match the loaded library in index.html.
import { initializeApp } from "firebase/app";
import { initializeFirestore } from "firebase/firestore";
import { getAuth } from "firebase/auth";
import { getStorage } from "firebase/storage";
import { getFunctions } from "firebase/functions";

// Your web app's Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyDgMxJjb_ENhCgpmn1l02AwhWzDkGAxAa0",
  authDomain: "al3bara-data-b1abe.firebaseapp.com",
  projectId: "al3bara-data-b1abe",
  storageBucket: "al3bara-data-b1abe.appspot.com",   // ← FIXED
  messagingSenderId: "87091757430",
  appId: "1:87091757430:web:edcede33053c79f239ba57"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Get Firebase services
export const db = initializeFirestore(app, {
  experimentalForceLongPolling: true,  // Important for mobile & restricted networks
});

export const auth = getAuth(app);
export const storage = getStorage(app); 
export const functions = getFunctions(app);

export default app;
