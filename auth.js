// auth.js (Firebase MODULAR v9+ / v10+ CDN)
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
