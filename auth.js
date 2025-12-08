// auth.js
// Tüm giriş & kayıt işlemleri burada, Firebase ile konuşuyor.

// Firebase importları (modüler v10+)
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.13.1/firebase-app.js";
import {
  getAuth,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  sendEmailVerification,
  signOut,
  onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/10.13.1/firebase-auth.js";
import {
  getFirestore,
  doc,
  setDoc
} from "https://www.gstatic.com/firebasejs/10.13.1/firebase-firestore.js";

// 🔹 BURAYA KENDİ firebaseConfig'İNİ YAPIŞTIR 🔹
const firebaseConfig = {
  apiKey: "AIzaSyD2hTcFgZQXwBERXpOduwPnxOC8FcjsCR4",
  authDomain: "ogrencify.firebaseapp.com",
  projectId: "ogrencify",
  storageBucket: "ogrencify.firebasestorage.app",
  messagingSenderId: "467595249158",
  appId: "1:467595249158:web:55373baf2ee993bee3a587",
  measurementId: "G-VS0KGRBLN0"
};
// Firebase başlat
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

// Küçük helper: mesaj kutusu göster
function showMsg(element, message, type) {
  if (!element) return;
  element.style.display = "block";
  element.className = "message-box " + type;
  element.innerText = message;
}

// DOM hazır olduğunda
document.addEventListener("DOMContentLoaded", () => {
  const signupForm = document.getElementById("signup-form");
  const loginForm = document.getElementById("login-form");

  if (signupForm) {
    setupSignup(signupForm);
  }

  if (loginForm) {
    setupLogin(loginForm);
  }

  // İstersen navbar için login state'i burada da takip edebiliriz
  // onAuthStateChanged(auth, user => { ... });
});

// =============== KAYIT OL ===============
function setupSignup(form) {
  const msgBox = document.getElementById("signup-message");

  form.addEventListener("submit", async (e) => {
    e.preventDefault();

    const username = document.getElementById("signup-username").value.trim();
    const phone = document.getElementById("signup-phone").value.trim();
    const email = document.getElementById("signup-email").value.trim();
    const password = document.getElementById("signup-password").value;

    if (!username || !email || !password) {
      showMsg(msgBox, "Lütfen zorunlu alanları doldurun.", "error");
      return;
    }

    if (password.length < 8) {
      showMsg(msgBox, "Şifre en az 8 karakter olmalı.", "error");
      return;
    }

    const submitBtn = form.querySelector("button");
    submitBtn.disabled = true;
    submitBtn.innerText = "Kaydediliyor...";

    try {
      // Firebase Authentication ile kullanıcı oluştur
      const userCredential = await createUserWithEmailAndPassword(
        auth,
        email,
        password
      );
      const user = userCredential.user;

      // Firestore'a da profil bilgilerini kaydet
      await setDoc(doc(db, "users", user.uid), {
        username,
        phone,
        email,
        createdAt: new Date().toISOString()
      });

      // E-posta doğrulama maili gönder
      await sendEmailVerification(user);

      // Kullanıcıyı çıkışa zorlayalım ki maili doğrulamadan giriş yapamasın
      await signOut(auth);

      showMsg(
        msgBox,
        "Kayıt başarılı! E-posta adresine doğrulama linki gönderdik. Lütfen mailini kontrol et.",
        "success"
      );

      // Bir süre sonra login sayfasına yönlendir
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
        msg = "Şifre çok zayıf. En az 6-8 karakter olmalı.";
      }
      showMsg(msgBox, msg, "error");
    } finally {
      submitBtn.disabled = false;
      submitBtn.innerText = "Kayıt Ol";
    }
  });
}

// =============== GİRİŞ YAP ===============
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

      // E-posta doğrulanmış mı?
      if (!user.emailVerified) {
        await signOut(auth);
        showMsg(
          msgBox,
          "Lütfen önce e-posta adresini doğrula. Mail kutunu kontrol et.",
          "error"
        );
        return;
      }

      // Başarılı giriş → ana sayfaya yönlendir
      showMsg(msgBox, "Giriş başarılı, ana sayfaya yönlendiriliyorsun...", "success");

      setTimeout(() => {
        window.location.href = "index.html";
      }, 1000);
    } catch (error) {
      console.error(error);
      let msg = "Giriş başarısız.";
      if (error.code === "auth/user-not-found" || error.code === "auth/wrong-password") {
        msg = "E-posta veya şifre hatalı.";
      }
      showMsg(msgBox, msg, "error");
    } finally {
      submitBtn.disabled = false;
      submitBtn.innerText = "Giriş Yap";
    }
  });
}

// =============== ÇIKIŞ YAP (isteğe bağlı) ===============
export async function logoutUser() {
  try {
    await signOut(auth);
  } catch (err) {
    console.error(err);
  } finally {
    window.location.href = "index.html";
  }
}

// HTML içinde <button onclick="logoutUser()">Çıkış</button> dersen çalışsın diye:
window.logoutUser = logoutUser;
