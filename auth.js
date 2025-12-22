// auth.js (Firebase Modular CDN) - Login / Signup only
// NOTE: Firebase init is in firebase.js. Do NOT re-initialize here.

import { auth, db } from "./firebase.js";
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  sendEmailVerification,
  updateProfile,
} from "https://www.gstatic.com/firebasejs/10.12.5/firebase-auth.js";
import {
  doc,
  setDoc,
  serverTimestamp,
} from "https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js";

/** -----------------------------
 *  Helpers
 *  ----------------------------- */

function qs(id) {
  return document.getElementById(id);
}

function setFieldError(inputEl, errEl, message) {
  if (!inputEl || !errEl) return;
  errEl.textContent = message || "";
  if (message) {
    inputEl.classList.add("is-invalid");
    inputEl.setAttribute("aria-invalid", "true");
  } else {
    inputEl.classList.remove("is-invalid");
    inputEl.removeAttribute("aria-invalid");
  }
}

function showFormMessage(boxEl, message, type = "error") {
  if (!boxEl) return;
  if (!message) {
    boxEl.style.display = "none";
    boxEl.textContent = "";
    boxEl.className = "message-box";
    return;
  }
  boxEl.style.display = "block";
  boxEl.textContent = message;
  boxEl.className = `message-box ${type}`;
}

function isValidEmail(email) {
  // Basic but effective email check
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(email || "").trim());
}

function validatePassword(password) {
  // Rule set: >=8, at least 1 lower, 1 upper, 1 digit, 1 special
  const p = String(password || "");
  if (p.length < 8) return "Şifre en az 8 karakter olmalı.";
  if (!/[a-z]/.test(p)) return "Şifre en az 1 küçük harf içermeli.";
  if (!/[A-Z]/.test(p)) return "Şifre en az 1 büyük harf içermeli.";
  if (!/[0-9]/.test(p)) return "Şifre en az 1 rakam içermeli.";
  if (!/[^A-Za-z0-9]/.test(p)) return "Şifre en az 1 özel karakter içermeli.";
  return "";
}

function normalizePhoneTR(phone) {
  const raw = String(phone || "").replace(/\D/g, "");
  if (!raw) return "";
  // Accept: 10 digits starting with 5XXXXXXXXX, or 11 digits 05XXXXXXXXX
  if (raw.length === 11 && raw.startsWith("0")) return raw.slice(1);
  return raw;
}

function firebaseErrorToTR(code) {
  switch (code) {
    case "auth/invalid-email":
      return "E-posta adresi geçersiz.";
    case "auth/user-not-found":
      return "Bu e-posta ile kayıtlı hesap bulunamadı.";
    case "auth/wrong-password":
    case "auth/invalid-credential":
      return "E-posta veya şifre hatalı.";
    case "auth/too-many-requests":
      return "Çok fazla deneme yapıldı. Lütfen biraz sonra tekrar deneyin.";
    case "auth/email-already-in-use":
      return "Bu e-posta zaten kullanılıyor.";
    case "auth/weak-password":
      return "Şifre çok zayıf. Lütfen daha güçlü bir şifre seçin.";
    default:
      return "Bir hata oluştu. Lütfen tekrar deneyin.";
  }
}

/** -----------------------------
 *  LOGIN
 *  ----------------------------- */

function setupLogin() {
  const form = qs("login-form");
  if (!form) return;

  const emailEl = qs("login-email");
  const passEl = qs("login-password");
  const errEmail = qs("err-login-email");
  const errPass = qs("err-login-password");
  const msgBox = qs("login-message");
  const submitBtn = form.querySelector('button[type="submit"]');

  const clearInlineErrors = () => {
    setFieldError(emailEl, errEmail, "");
    setFieldError(passEl, errPass, "");
  };

  // URL: ?verified=1 (optional)
  const params = new URLSearchParams(window.location.search);
  if (params.get("verified") === "1") {
    showFormMessage(msgBox, "E-posta doğrulandı. Şimdi giriş yapabilirsiniz.", "success");
  }

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    showFormMessage(msgBox, "");
    clearInlineErrors();

    const email = String(emailEl?.value || "").trim();
    const password = String(passEl?.value || "");

    let hasErr = false;
    if (!isValidEmail(email)) {
      setFieldError(emailEl, errEmail, "Geçerli bir e-posta girin.");
      hasErr = true;
    }
    if (!password) {
      setFieldError(passEl, errPass, "Şifre gerekli.");
      hasErr = true;
    }
    if (hasErr) return;

    if (submitBtn) {
      submitBtn.disabled = true;
      submitBtn.dataset.originalText = submitBtn.dataset.originalText || submitBtn.textContent;
      submitBtn.textContent = "Giriş yapılıyor...";
    }

    try {
      await signInWithEmailAndPassword(auth, email, password);
      showFormMessage(msgBox, "Giriş başarılı. Ana sayfaya yönlendiriliyorsunuz...", "success");

      // Redirect after a short tick so UI can render the message
      setTimeout(() => {
        window.location.href = "index.html";
      }, 600);
    } catch (err) {
      const code = err?.code || "";
      showFormMessage(msgBox, firebaseErrorToTR(code), "error");
    } finally {
      if (submitBtn) {
        submitBtn.disabled = false;
        submitBtn.textContent = submitBtn.dataset.originalText || "Giriş Yap";
      }
    }
  });
}

/** -----------------------------
 *  SIGNUP
 *  ----------------------------- */

function setupSignup() {
  const form = qs("signup-form");
  if (!form) return;

  const nameEl = qs("signup-name");
  const phoneEl = qs("signup-phone");
  const emailEl = qs("signup-email");
  const passEl = qs("signup-password");

  const errName = qs("err-signup-name");
  const errPhone = qs("err-signup-phone");
  const errEmail = qs("err-signup-email");
  const errPass = qs("err-signup-password");

  const msgBox = qs("signup-message");
  const submitBtn = form.querySelector('button[type="submit"]');

  const clearInlineErrors = () => {
    setFieldError(nameEl, errName, "");
    setFieldError(phoneEl, errPhone, "");
    setFieldError(emailEl, errEmail, "");
    setFieldError(passEl, errPass, "");
  };

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    showFormMessage(msgBox, "");
    clearInlineErrors();

    const name = String(nameEl?.value || "").trim();
    const phone = normalizePhoneTR(phoneEl?.value || "");
    const email = String(emailEl?.value || "").trim();
    const password = String(passEl?.value || "");

    let hasErr = false;

    if (name.length < 2) {
      setFieldError(nameEl, errName, "Ad Soyad en az 2 karakter olmalı.");
      hasErr = true;
    }

    if (phone) {
      // TR mobile: 10 digits, starts with 5
      if (!(phone.length === 10 && phone.startsWith("5"))) {
        setFieldError(phoneEl, errPhone, "Telefon 5XXXXXXXXX formatında olmalı.");
        hasErr = true;
      }
    }

    if (!isValidEmail(email)) {
      setFieldError(emailEl, errEmail, "Geçerli bir e-posta girin.");
      hasErr = true;
    }

    const passErr = validatePassword(password);
    if (passErr) {
      setFieldError(passEl, errPass, passErr);
      hasErr = true;
    }

    if (hasErr) return;

    if (submitBtn) {
      submitBtn.disabled = true;
      submitBtn.dataset.originalText = submitBtn.dataset.originalText || submitBtn.textContent;
      submitBtn.textContent = "Kayıt yapılıyor...";
    }

    try {
      const cred = await createUserWithEmailAndPassword(auth, email, password);

      // displayName
      try {
        await updateProfile(cred.user, { displayName: name });
      } catch (_) {}

      // store user profile
      await setDoc(
        doc(db, "users", cred.user.uid),
        {
          name,
          phone: phone || "",
          email,
          role: "user",
          createdAt: serverTimestamp(),
        },
        { merge: true }
      );

      // send verification email
      await sendEmailVerification(cred.user);

      showFormMessage(
        msgBox,
        "Kayıt başarılı. Lütfen e-postanızı doğrulayın. Giriş sayfasına yönlendiriliyorsunuz...",
        "success"
      );

      setTimeout(() => {
        window.location.href = "login.html";
      }, 900);
    } catch (err) {
      const code = err?.code || "";
      showFormMessage(msgBox, firebaseErrorToTR(code), "error");
    } finally {
      if (submitBtn) {
        submitBtn.disabled = false;
        submitBtn.textContent = submitBtn.dataset.originalText || "Kayıt Ol";
      }
    }
  });
}

document.addEventListener("DOMContentLoaded", () => {
  setupLogin();
  setupSignup();
});
