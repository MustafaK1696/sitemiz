// auth.js

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.13.1/firebase-app.js";
import {
  getAuth,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  sendEmailVerification,
  signOut,
  updateProfile
} from "https://www.gstatic.com/firebasejs/10.13.1/firebase-auth.js";
import {
  getFirestore,
  doc,
  setDoc
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

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

function showMsg(element, message, type) {
  if (!element) return;
  element.style.display = "block";
  element.className = "message-box " + type;
  element.innerText = message;
}

document.addEventListener("DOMContentLoaded", () => {
  const signupForm = document.getElementById("signup-form");
  const loginForm = document.getElementById("login-form");

  if (signupForm) setupSignup(signupForm);
  if (loginForm) setupLogin(loginForm);
});

// ---- Kayıt Ol ----

function setupSignup(form) {
  const msgBox = document.getElementById("signup-message");

  form.addEventListener("submit", async (e) => {
    e.preventDefault();

    const username = document.getElementById("signup-username").value.trim();
    const phone = document.getElementById("signup-phone").value.trim();
    const email = document.getElementById("signup-email").value.trim();
    const password = document.getElementById("signup-password").value;

    if (!username || !phone || !email || !password) {
      showMsg(msgBox, "Lütfen tüm alanları doldurun.", "error");
      return;
    }

    const phonePattern = /^\+?\d{10,15}$/;
    if (!phonePattern.test(phone)) {
      showMsg(
        msgBox,
        "Telefon numarasını başında 0 olmadan ve boşluksuz girin. Örn: +905xxxxxxxxx",
        "error"
      );
      return;
    }

    const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailPattern.test(email)) {
      showMsg(msgBox, "Geçerli bir e-posta adresi girin.", "error");
      return;
    }

    const strongPassword = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)[A-Za-z\d\S]{8,}$/;
    if (!strongPassword.test(password)) {
      showMsg(
        msgBox,
        "Şifre en az 8 karakter olmalı ve en az 1 büyük harf, 1 küçük harf, 1 rakam içermelidir.",
        "error"
      );
      return;
    }

    const submitBtn = form.querySelector("button");
    submitBtn.disabled = true;
    submitBtn.innerText = "Kaydediliyor...";

    try {
      const userCredential = await createUserWithEmailAndPassword(
        auth,
        email,
        password
      );
      const user = userCredential.user;

      await updateProfile(user, { displayName: username });

      await setDoc(doc(db, "users", user.uid), {
        username,
        phone,
        email,
        createdAt: new Date().toISOString()
      });

      await sendEmailVerification(user);
      await signOut(auth);

      showMsg(
        msgBox,
        "Kayıt başarılı! E-posta adresine doğrulama linki gönderdik. Lütfen mailini kontrol et.",
        "success"
      );

      setTimeout(() => {
        window.location.href = "login.html";
      }, 3000);
    } catch (error) {
      console.error(error);
      let msg = "Kayıt başarısız.";

      if (error.code === "auth/email-already-in-use") {
        msg = "Bu e-posta zaten kayıtlı.";
      } else if (error.code === "auth/invalid-email") {
        msg = "Geçersiz e-posta adresi.";
      } else if (error.code === "auth/weak-password") {
        msg = "Şifre çok zayıf.";
      }

      showMsg(msgBox, msg, "error");
    } finally {
      submitBtn.disabled = false;
      submitBtn.innerText = "Kayıt Ol";
    }
  });
}

// ---- Giriş Yap ----

function setupLogin(form) {
  const msgBox = document.getElementById("login-message");

  form.addEventListener("submit", async (e) => {
    e.preventDefault();

    const email = document.getElementById("login-email").value.trim();
    const password = document.getElementById("login-password").value;

    if (!email || !password) {
      showMsg(msgBox, "Lütfen e-posta ve şifreyi girin.", "error");
      return;
    }

    const submitBtn = form.querySelector("button");
    submitBtn.disabled = true;
    submitBtn.innerText = "Giriş Yapılıyor...";

    try {
      const userCredential = await signInWithEmailAndPassword(
        auth,
        email,
        password
      );
      const user = userCredential.user;

      if (!user.emailVerified) {
        await signOut(auth);
        showMsg(
          msgBox,
          "Lütfen önce e-posta adresini doğrula. Mail kutunu kontrol et.",
          "error"
        );
        return;
      }

      showMsg(
        msgBox,
        "Giriş başarılı, ana sayfaya yönlendiriliyorsun...",
        "success"
      );

      setTimeout(() => {
        window.location.href = "index.html";
      }, 1000);
    } catch (error) {
      console.error(error);
      let msg = "Giriş başarısız.";
      if (
        error.code === "auth/user-not-found" ||
        error.code === "auth/wrong-password"
      ) {
        msg = "E-posta veya şifre hatalı.";
      }
      showMsg(msgBox, msg, "error");
    } finally {
      submitBtn.disabled = false;
      submitBtn.innerText = "Giriş Yap";
    }
  });
}

// ÇIKIŞ (isteyen isterse başka yerde de kullanabilir)
export async function logoutUser() {
  try {
    await signOut(auth);
  } catch (err) {
    console.error(err);
  } finally {
    window.location.href = "index.html";
  }
}

window.logoutUser = logoutUser;
