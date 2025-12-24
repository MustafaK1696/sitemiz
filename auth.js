// auth.js (Firebase Modular CDN) - Login & Signup handlers
// Works with firebase.js (exports auth, db)

import { auth, db } from "./firebase.js";

import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  updateProfile,
  sendEmailVerification
} from "https://www.gstatic.com/firebasejs/10.13.1/firebase-auth.js";

import {
  doc,
  setDoc,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.13.1/firebase-firestore.js";

// ---------------- Helpers ----------------
function $(id) {
  return document.getElementById(id);
}

function setMsg(box, text, type = "error") {
  if (!box) return;
  box.style.display = "block";
  box.className = `message-box ${type}`;
  box.textContent = text;
}

function clearMsg(box) {
  if (!box) return;
  box.style.display = "none";
  box.textContent = "";
}

function isValidEmail(email) {
  // simple, robust enough for client-side
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(email || "").trim());
}

function normalizePhone(phone) {
  const p = String(phone || "").trim();
  if (!p) return "";
  // keep digits only
  return p.replace(/\D/g, "");
}

function passwordRuleOk(pw) {
  const p = String(pw || "");
  // min 8, at least 1 letter and 1 digit
  return p.length >= 8 && /[A-Za-z]/.test(p) && /\d/.test(p);
}

function humanAuthError(err) {
  const code = err?.code || "";
  const msg = err?.message || "";

  const map = {
    "auth/invalid-email": "E-posta formatı geçersiz.",
    "auth/user-disabled": "Bu hesap devre dışı bırakılmış.",
    "auth/user-not-found": "Bu e-posta ile kayıtlı bir hesap bulunamadı.",
    "auth/wrong-password": "Şifre hatalı. Lütfen tekrar deneyin.",
    "auth/email-already-in-use": "Bu e-posta zaten kullanılıyor.",
    "auth/weak-password": "Şifre zayıf. En az 8 karakter, 1 harf ve 1 rakam içermeli.",
    "auth/too-many-requests": "Çok fazla deneme yapıldı. Lütfen biraz sonra tekrar deneyin.",
    "auth/network-request-failed": "Ağ hatası oluştu. İnternet bağlantınızı kontrol edin."
  };

  return map[code] || (msg ? "İşlem başarısız: " + msg : "Bir hata oluştu. Lütfen tekrar deneyin.");
}

// ---------------- Signup ----------------
const signupForm = $("signup-form");
if (signupForm) {
  const msgBox = $("signup-message") || $("auth-message");

  signupForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    clearMsg(msgBox);

    const name = ( $("signup-name")?.value || $("signup-username")?.value || "" ).trim();
    const email = ( $("signup-email")?.value || "" ).trim();
    const phoneRaw = $("signup-phone")?.value || "";
    const phone = normalizePhone(phoneRaw);
    const password = $("signup-password")?.value || "";

    // client validations
    if (!name || name.length < 2) {
      setMsg(msgBox, "Ad Soyad en az 2 karakter olmalı.", "error");
      return;
    }
    if (!isValidEmail(email)) {
      setMsg(msgBox, "Geçerli bir e-posta girin.", "error");
      return;
    }
    if (phoneRaw && (phone.length < 10 || phone.length > 15)) {
      setMsg(msgBox, "Telefon numarası geçersiz (10-15 hane).", "error");
      return;
    }
    if (!passwordRuleOk(password)) {
      setMsg(msgBox, "Şifre en az 8 karakter olmalı ve en az 1 harf + 1 rakam içermeli.", "error");
      return;
    }

    const btn = signupForm.querySelector("button[type='submit'], button") ;
    if (btn) {
      btn.disabled = true;
      btn.dataset._oldText = btn.textContent;
      btn.textContent = "Kaydediliyor...";
    }

    try {
      const cred = await createUserWithEmailAndPassword(auth, email, password);

      // set displayName
      try {
        await updateProfile(cred.user, { displayName: name });
      } catch (_) {}

      // store user doc (non-sensitive)
      try {
        await setDoc(doc(db, "users", cred.user.uid), {
          name,
          email,
          phone: phone || "",
          createdAt: serverTimestamp()
        }, { merge: true });
      } catch (_) {}

      // send verification (non-blocking)
      try {
        await sendEmailVerification(cred.user);
      } catch (_) {}

      setMsg(msgBox, "Kayıt başarılı. Giriş sayfasına yönlendiriliyorsunuz…", "success");
      setTimeout(() => {
        window.location.href = "login.html";
      }, 900);
    } catch (err) {
      console.error("Signup error:", err);
      setMsg(msgBox, humanAuthError(err), "error");
    } finally {
      if (btn) {
        btn.disabled = false;
        btn.textContent = btn.dataset._oldText || "Kayıt Ol";
      }
    }
  });
}

// ---------------- Login ----------------
const loginForm = $("login-form");
if (loginForm) {
  const msgBox = $("login-message") || $("auth-message");

  loginForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    clearMsg(msgBox);

    const email = ( $("login-email")?.value || "" ).trim();
    const password = $("login-password")?.value || "";

    if (!isValidEmail(email)) {
      setMsg(msgBox, "Geçerli bir e-posta girin.", "error");
      return;
    }
    if (!password) {
      setMsg(msgBox, "Şifre boş olamaz.", "error");
      return;
    }

    const btn = loginForm.querySelector("button[type='submit'], button");
    if (btn) {
      btn.disabled = true;
      btn.dataset._oldText = btn.textContent;
      btn.textContent = "Giriş yapılıyor...";
    }

    try {
      await signInWithEmailAndPassword(auth, email, password);

      setMsg(msgBox, "Giriş başarılı. Ana sayfaya yönlendiriliyorsunuz…", "success");
      setTimeout(() => {
        window.location.href = "index.html";
      }, 700);
    } catch (err) {
      console.error("Login error:", err);
      setMsg(msgBox, humanAuthError(err), "error");
    } finally {
      if (btn) {
        btn.disabled = false;
        btn.textContent = btn.dataset._oldText || "Giriş Yap";
      }
    }
  });
}
