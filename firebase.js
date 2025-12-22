// firebase.js - shared Firebase initialization (Modular CDN)
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.13.1/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/10.13.1/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.13.1/firebase-firestore.js";
import { getStorage } from "https://www.gstatic.com/firebasejs/10.13.1/firebase-storage.js";

const firebaseConfig = {
  apiKey: "AIzaSyD2hTcFgZQXwBERXpOduws0E_UwgaT75g",
  authDomain: "ogrencify-eb70b.firebaseapp.com",
  projectId: "ogrencify-eb70b",
  storageBucket: "ogrencify-eb70b.firebasestorage.app",
  messagingSenderId: "467595249158",
  appId: "1:467595249158:web:55373baf2ee993bee3a587",
  measurementId: "G-L1NJGJZE66"
};

export const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
export const storage = getStorage(app);
