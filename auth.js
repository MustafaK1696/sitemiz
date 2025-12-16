// auth.js (Firebase MODULAR v9+ / v10+ CDN)
import { initializeApp, getApp, getApps } from "https://www.gstatic.com/firebasejs/10.13.1/firebase-app.js";
import {
  getAuth,
  setPersistence,
  browserLocalPersistence,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  sendEmailVerification,
  updateProfile
} from "https://www.gstatic.com/firebasejs/10.13.1/firebase-auth.js";
import {
  getFirestore,
  doc,
  setDoc,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.13.1/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyD2hTcFgZQXwBERXpOduwPnxOC8FcjsCR4",
  authDomain: "ogrencify.firebaseapp.com",
  projectId: "ogrencify",
  storageBucket: "ogrencify.firebasestorage.app",
  messagingSenderId: "467595249158",
  appId: "1:467595249158:web:55373baf2ee993bee3a587",
  measurementId: "G-VS0KGRBLN0"
};

const app = getApps().length ? getApp() : initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

// ✅ Login sonrası "giriş yapılmamış" görünmesini engellemek için kalıcı oturum
setPersistence(auth, browserLocalPersistence).catch(() => {});

function showMsg(box, text, type) {
  if (!box) return;
  box.textContent = text;
  box.className = "auth-message " + (type || "");
}

function safeVal(id) {
  const el = document.getElementById(id);
  return el ? (el.value || "").trim() : "";
}

document.addEventListener("DOMContentLoaded", () => {
  const signupForm = document.getElementById("signup-form");
  const loginForm = document.getElementById("login-form");

  if (signupForm) setupSignup(signupForm);
  if (loginForm) setupLogin(loginForm);
});

function setupSignup(form) {
  const msgBox = document.getElementById("signup-message");

  form.addEventListener("submit", async (e) => {
    e.preventDefault();

    const username = safeVal("signup-username");
    const phone = safeVal("signup-phone");
    const email = safeVal("signup-email");
    const password = document.getElementById("signup-password")?.value || "";

    if (!username || !phone || !email || !password) {
      showMsg(msgBox, "Lütfen tüm alanları doldurun.", "error");
      return;
    }

    try {
      const cred = await createUserWithEmailAndPassword(auth, email, password);

      // displayName
      await updateProfile(cred.user, { displayName: username });

      // users/{uid} (role varsayılan customer)
      await setDoc(doc(db, "users", cred.user.uid), {
        username,
        phone,
        email,
        role: "customer",
        createdAt: serverTimestamp()
      }, { merge: true });

      // mail doğrulama (opsiyonel)
      try { await sendEmailVerification(cred.user); } catch {}

      showMsg(msgBox, "Kayıt başarılı! Giriş sayfasına yönlendiriliyorsun...", "success");
      setTimeout(() => { window.location.href = "login.html"; }, 900);
    } catch (err) {
      console.error(err);
      showMsg(msgBox, "Kayıt olurken hata oluştu. E-posta zaten kayıtlı olabilir.", "error");
    }
  });
}

function setupLogin(form) {
  const msgBox = document.getElementById("login-message");

  form.addEventListener("submit", async (e) => {
    e.preventDefault();

    const email = safeVal("login-email");
    const password = document.getElementById("login-password")?.value || "";

    if (!email || !password) {
      showMsg(msgBox, "Lütfen e-posta ve şifreyi girin.", "error");
      return;
    }

    const btn = form.querySelector("button");
    if (btn) btn.disabled = true;

    try {
      await signInWithEmailAndPassword(auth, email, password);

      showMsg(msgBox, "Giriş başarılı, ana sayfaya yönlendiriliyorsun...", "success");
      setTimeout(() => { window.location.href = "index.html"; }, 600);
    } catch (err) {
      console.error(err);
      showMsg(msgBox, "Giriş başarısız. E-posta veya şifre hatalı.", "error");
    } finally {
      if (btn) btn.disabled = false;
    }
  });
}
