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
  storageBucket: "ogrencify.appspot.com",
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
  const msg = String(text || "").trim();

  if (!msg) {
    box.textContent = "";
    box.className = "message-box";
    box.style.display = "none";
    return;
  }

  box.textContent = msg;
  box.className = "message-box " + (type || "");
  box.style.display = "block";
}

function setFieldError(inputId, errorId, message) {
  const input = document.getElementById(inputId);
  const err = document.getElementById(errorId);
  if (input) input.classList.toggle("is-invalid", !!message);
  if (err) err.textContent = message || "";
}

function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(email||"").trim());
}

function normalizeTRMobile(phone) {
  return String(phone||"").replace(/\s+/g,"").replace(/^\+90/,"").replace(/^0/,"");
}

function isValidTRMobile(phone) {
  const p = normalizeTRMobile(phone);
  return p === "" || /^5\d{9}$/.test(p);
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

    setFieldError("signup-name","err-signup-name","");
    setFieldError("signup-phone","err-signup-phone","");
    setFieldError("signup-email","err-signup-email","");
    setFieldError("signup-password","err-signup-password","");
    showMsg(msgBox, "", "");

    const name = safeVal("signup-name");
    const phoneRaw = safeVal("signup-phone");
    const phone = normalizeTRMobile(phoneRaw);
    const email = safeVal("signup-email");
    const password = document.getElementById("signup-password")?.value || "";

    let hasError = false;

    if (!name || name.length < 2) {
      setFieldError("signup-name","err-signup-name","Ad Soyad en az 2 karakter olmalı.");
      hasError = true;
    }

    if (!isValidTRMobile(phoneRaw)) {
      setFieldError("signup-phone","err-signup-phone","Telefon 5XXXXXXXXX formatında olmalı (opsiyonel).");
      hasError = true;
    }

    if (!email || !isValidEmail(email)) {
      setFieldError("signup-email","err-signup-email","Geçerli bir e-posta girin.");
      hasError = true;
    }

    if (!password || password.length < 8) {
      setFieldError("signup-password","err-signup-password","Şifre en az 8 karakter olmalı.");
      hasError = true;
    }

    if (hasError) {
      showMsg(msgBox, "Lütfen hatalı alanları düzeltin.", "error");
      return;
    }

    const btn = form.querySelector("button");
    if (btn) btn.disabled = true;

    try {
      const cred = await createUserWithEmailAndPassword(auth, email, password);

      if (auth.currentUser) {
        await updateProfile(auth.currentUser, { displayName: name });
      }

      await setDoc(doc(db, "users", cred.user.uid), {
        name,
        phone: phone || "",
        email,
        role: "buyer",
        createdAt: serverTimestamp()
      });

      if (auth.currentUser) {
        await sendEmailVerification(auth.currentUser);
      }

      showMsg(msgBox, "Kayıt başarılı! Lütfen e-postanı doğrula ve sonra giriş yap.", "success");
      setTimeout(() => { window.location.href = "login.html"; }, 1200);
    } catch (err) {
      console.error(err);
      const code = err?.code || "";
      let message = "Kayıt başarısız. Lütfen tekrar deneyin.";
      if (code === "auth/email-already-in-use") message = "Bu e-posta zaten kullanılıyor.";
      if (code === "auth/invalid-email") message = "E-posta formatı geçersiz.";
      if (code === "auth/weak-password") message = "Şifre çok zayıf. Daha güçlü bir şifre deneyin.";
      showMsg(msgBox, message, "error");
    } finally {
      if (btn) btn.disabled = false;
    }
  });
}

function setupLogin(form) {
  const msgBox = document.getElementById("login-message");

  form.addEventListener("submit", async (e) => {
    e.preventDefault();

    // Clear field errors
    setFieldError("login-email","err-login-email","");
    setFieldError("login-password","err-login-password","");
    showMsg(msgBox, "", "");

    const email = safeVal("login-email");
    const password = document.getElementById("login-password")?.value || "";

    let hasError = false;
    if (!email || !isValidEmail(email)) {
      setFieldError("login-email","err-login-email","Geçerli bir e-posta girin.");
      hasError = true;
    }
    if (!password || password.length < 8) {
      setFieldError("login-password","err-login-password","Şifre en az 8 karakter olmalı.");
      hasError = true;
    }
    if (hasError) {
      showMsg(msgBox, "Lütfen hatalı alanları düzeltin.", "error");
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
      const code = err?.code || "";
      let message = "Giriş başarısız. E-posta veya şifre hatalı.";
      if (code === "auth/user-not-found") message = "Bu e-posta ile kayıtlı bir hesap bulunamadı.";
      if (code === "auth/wrong-password") message = "Şifre hatalı. Lütfen tekrar deneyin.";
      if (code === "auth/invalid-email") message = "E-posta formatı geçersiz.";
      if (code === "auth/too-many-requests") message = "Çok fazla deneme yapıldı. Lütfen biraz sonra tekrar deneyin.";
      showMsg(msgBox, message, "error");
    } finally {
      if (btn) btn.disabled = false;
    }
  });
}
