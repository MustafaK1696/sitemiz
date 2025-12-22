// auth.js - Firebase Auth (Modular CDN) for login & signup
// NOTE: This file is loaded as <script type="module" src="auth.js"></script>

import { auth, db } from "./firebase.js";
import {
  setPersistence,
  browserLocalPersistence,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  sendEmailVerification,
  updateProfile
} from "https://www.gstatic.com/firebasejs/10.13.1/firebase-auth.js";
import {
  doc,
  setDoc,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.13.1/firebase-firestore.js";

// Keep users logged in across refresh
setPersistence(auth, browserLocalPersistence).catch(() => {});

function qs(id) { return document.getElementById(id); }

function showMsg(box, text, type = "error") {
  if (!box) return;
  const t = String(text || "").trim();
  if (!t) {
    box.style.display = "none";
    box.textContent = "";
    box.className = "message-box";
    return;
  }
  box.style.display = "block";
  box.textContent = t;
  box.className = "message-box " + type;
}

function setFieldError(el, msg) {
  if (!el) return;
  el.textContent = msg || "";
}

function clearFieldErrors(prefix) {
  const ids = [
    `err-${prefix}-name`,
    `err-${prefix}-phone`,
    `err-${prefix}-email`,
    `err-${prefix}-password`
  ];
  ids.forEach((id) => {
    const el = qs(id);
    if (el) el.textContent = "";
  });
}

function isValidEmail(email) {
  // Simple but effective for UI validation
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(String(email || "").trim());
}

function checkPasswordRules(pw) {
  const p = String(pw || "");
  if (p.length < 8) return "Şifre en az 8 karakter olmalı.";
  if (p.length > 64) return "Şifre en fazla 64 karakter olmalı.";
  if (!/[a-z]/.test(p)) return "Şifre en az 1 küçük harf içermeli.";
  if (!/[A-Z]/.test(p)) return "Şifre en az 1 büyük harf içermeli.";
  if (!/[0-9]/.test(p)) return "Şifre en az 1 rakam içermeli.";
  return "";
}

function normalizeTrPhone(phone) {
  const raw = String(phone || "").replace(/\D/g, "");
  if (!raw) return "";
  // accept 10 digits starting with 5, or 11 digits starting with 0 then 5...
  if (raw.length === 10 && raw.startsWith("5")) return raw;
  if (raw.length === 11 && raw.startsWith("05")) return raw.slice(1);
  return "";
}

function mapFirebaseError(err) {
  const code = err?.code || "";
  switch (code) {
    case "auth/invalid-email":
      return "E-posta adresi geçersiz.";
    case "auth/user-not-found":
    case "auth/wrong-password":
    case "auth/invalid-credential":
      return "E-posta veya şifre hatalı.";
    case "auth/email-already-in-use":
      return "Bu e-posta zaten kullanılıyor.";
    case "auth/weak-password":
      return "Şifre zayıf. Daha güçlü bir şifre deneyin.";
    case "auth/too-many-requests":
      return "Çok fazla deneme yapıldı. Lütfen biraz sonra tekrar deneyin.";
    case "auth/network-request-failed":
      return "Ağ hatası. İnternet bağlantınızı kontrol edin.";
    default:
      return "Bir hata oluştu. Lütfen tekrar deneyin.";
  }
}

function disableBtn(btn, text) {
  if (!btn) return;
  btn.disabled = true;
  btn.dataset._oldText = btn.textContent || "";
  btn.textContent = text || "Lütfen bekleyin...";
}
function enableBtn(btn) {
  if (!btn) return;
  btn.disabled = false;
  btn.textContent = btn.dataset._oldText || btn.textContent || "";
}

// ---------------- LOGIN ----------------
function setupLogin() {
  const form = qs("login-form");
  if (!form) return;

  const emailEl = qs("login-email");
  const passEl = qs("login-password");
  const msgBox = qs("login-message");
  const btn = form.querySelector("button[type='submit']");

  form.addEventListener("submit", async (e) => {
    e.preventDefault();

    // clear errors
    setFieldError(qs("err-login-email"), "");
    setFieldError(qs("err-login-password"), "");
    showMsg(msgBox, "", "error");

    const email = String(emailEl?.value || "").trim();
    const password = String(passEl?.value || "");

    let hasError = false;
    if (!isValidEmail(email)) {
      setFieldError(qs("err-login-email"), "Geçerli bir e-posta girin.");
      hasError = true;
    }
    if (!password) {
      setFieldError(qs("err-login-password"), "Şifre zorunludur.");
      hasError = true;
    }
    if (hasError) return;

    try {
      disableBtn(btn, "Giriş yapılıyor...");
      showMsg(msgBox, "Giriş yapılıyor...", "success");

      await signInWithEmailAndPassword(auth, email, password);

      showMsg(msgBox, "Giriş başarılı, ana sayfaya yönlendiriliyorsunuz...", "success");
      setTimeout(() => {
        window.location.href = "index.html";
      }, 600);
    } catch (err) {
      showMsg(msgBox, mapFirebaseError(err), "error");
    } finally {
      enableBtn(btn);
    }
  });
}

// ---------------- SIGNUP ----------------
function setupSignup() {
  const form = qs("signup-form");
  if (!form) return;

  const nameEl = qs("signup-name");
  const phoneEl = qs("signup-phone");
  const emailEl = qs("signup-email");
  const passEl = qs("signup-password");
  const msgBox = qs("signup-message");
  const btn = form.querySelector("button[type='submit']");

  form.addEventListener("submit", async (e) => {
    e.preventDefault();

    clearFieldErrors("signup");
    showMsg(msgBox, "", "error");

    const name = String(nameEl?.value || "").trim();
    const phoneRaw = String(phoneEl?.value || "").trim();
    const email = String(emailEl?.value || "").trim();
    const password = String(passEl?.value || "");

    let hasError = false;

    if (name.length < 2) {
      setFieldError(qs("err-signup-name"), "Ad Soyad en az 2 karakter olmalı.");
      hasError = true;
    }

    const normalizedPhone = normalizeTrPhone(phoneRaw);
    if (phoneRaw && !normalizedPhone) {
      setFieldError(qs("err-signup-phone"), "Telefon 5XXXXXXXXX formatında olmalı.");
      hasError = true;
    }

    if (!isValidEmail(email)) {
      setFieldError(qs("err-signup-email"), "Geçerli bir e-posta girin.");
      hasError = true;
    }

    const pwErr = checkPasswordRules(password);
    if (pwErr) {
      setFieldError(qs("err-signup-password"), pwErr);
      hasError = true;
    }

    if (hasError) return;

    try {
      disableBtn(btn, "Kayıt yapılıyor...");
      showMsg(msgBox, "Kayıt yapılıyor...", "success");

      const cred = await createUserWithEmailAndPassword(auth, email, password);

      // Set display name
      await updateProfile(cred.user, { displayName: name });

      // Store profile in Firestore
      await setDoc(doc(db, "users", cred.user.uid), {
        name,
        phone: normalizedPhone || "",
        email,
        createdAt: serverTimestamp()
      }, { merge: true });

      // Send verification email (optional - if enabled)
      try { await sendEmailVerification(cred.user); } catch (_) {}

      showMsg(
        msgBox,
        "Kayıt başarılı! Giriş sayfasına yönlendiriliyorsunuz...",
        "success"
      );

      setTimeout(() => {
        window.location.href = "login.html";
      }, 900);
    } catch (err) {
      showMsg(msgBox, mapFirebaseError(err), "error");
    } finally {
      enableBtn(btn);
    }
  });
}

document.addEventListener("DOMContentLoaded", () => {
  setupLogin();
  setupSignup();
});
