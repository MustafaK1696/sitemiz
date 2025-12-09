// script.js  (ES module)

// Firebase
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.13.1/firebase-app.js";
import {
  getAuth,
  onAuthStateChanged,
  signOut,
  sendPasswordResetEmail,
  sendEmailVerification
} from "https://www.gstatic.com/firebasejs/10.13.1/firebase-auth.js";

import {
  getFirestore,
  doc,
  setDoc,
  getDoc,
  updateDoc,
  collection,
  addDoc,
  query,
  where,
  onSnapshot,
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

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

let currentUser = null;
let currentUserRole = "customer";
let currentTwoFactorEnabled = false;

let adminPanelInitialized = false;
let sellerPanelInitialized = false;

// Örnek ürünler (ileride products koleksiyonuna geçebilirsin)
const PRODUCTS = [
  { id: 1, name: "El Örgüsü Atkı", price: 150, category: "Giyim", description: "Tamamen yün, el yapımı sıcak atkı." },
  { id: 2, name: "Ahşap Kalemlik", price: 85, category: "Dekorasyon", description: "Doğal ahşaptan oyma masaüstü kalemlik." },
  { id: 3, name: "Deri Cüzdan", price: 250, category: "Aksesuar", description: "Gerçek deri, el dikimi minimalist cüzdan." }
];

// ---------------- TEMA ----------------

const THEME_KEY = "ogrencify_theme";

function applyTheme(theme) {
  if (theme === "dark") document.body.classList.add("theme-dark");
  else document.body.classList.remove("theme-dark");

  localStorage.setItem(THEME_KEY, theme);
  const toggleBtn = document.getElementById("theme-toggle");
  if (toggleBtn) {
    toggleBtn.textContent =
      theme === "dark" ? "Koyu tema: Açık" : "Koyu tema: Kapalı";
  }
}

function initTheme() {
  const stored = localStorage.getItem(THEME_KEY) || "light";
  applyTheme(stored);
}

// ---------------- ORTAK YARDIMCILAR ----------------

function loadPartial(placeholderId, url, callback) {
  const container = document.getElementById(placeholderId);
  if (!container) {
    if (callback) callback();
    return;
  }

  fetch(url)
    .then((res) => res.text())
    .then((html) => {
      container.innerHTML = html;
      if (callback) callback();
    })
    .catch((err) => {
      console.error("Partial yüklenemedi:", url, err);
      if (callback) callback();
    });
}

// Sepet
const CART_KEY = "ogrencify_cart";

function getCart() {
  try {
    const raw = localStorage.getItem(CART_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveCart(cart) {
  localStorage.setItem(CART_KEY, JSON.stringify(cart));
}

function getCartCount() {
  return getCart().reduce((sum, item) => sum + item.qty, 0);
}

function getCartSubtotal() {
  const cart = getCart();
  let subtotal = 0;
  cart.forEach((item) => {
    const product = PRODUCTS.find((p) => p.id === item.id);
    if (product) subtotal += product.price * item.qty;
  });
  return subtotal;
}

function updateCartProgress(subtotal) {
  const bar = document.getElementById("cart-progress-fill");
  if (!bar) return;
  const LIMIT = 400;
  const ratio = Math.max(0, Math.min(subtotal / LIMIT, 1));
  bar.style.width = `${(ratio * 100).toFixed(0)}%`;
  if (subtotal >= LIMIT) bar.classList.add("full");
  else bar.classList.remove("full");
}

function updateCartCount() {
  const count = getCartCount();
  document.querySelectorAll("#cart-count, .cart-count").forEach((el) => {
    el.textContent = count;
  });
  updateCartProgress(getCartSubtotal());
}

function addToCart(productId) {
  const cart = getCart();
  const existing = cart.find((item) => item.id === productId);
  if (existing) existing.qty += 1;
  else cart.push({ id: productId, qty: 1 });
  saveCart(cart);
  updateCartCount();
}

// ---------------- USER DOC & ROLLER ----------------

async function ensureUserDoc(user) {
  if (!user) return;
  const ref = doc(db, "users", user.uid);
  const snap = await getDoc(ref);
  if (!snap.exists()) {
    await setDoc(ref, {
      email: user.email || "",
      role: "customer",
      twoFactorEmailEnabled: false,
      createdAt: serverTimestamp()
    });
    currentUserRole = "customer";
    currentTwoFactorEnabled = false;
  } else {
    const d = snap.data();
    currentUserRole = d.role || "customer";
    currentTwoFactorEnabled = !!d.twoFactorEmailEnabled;
  }
  updateProfilePageUser(user);
}

async function refreshUserRole() {
  if (!currentUser) {
    currentUserRole = "customer";
    currentTwoFactorEnabled = false;
    return;
  }
  const ref = doc(db, "users", currentUser.uid);
  const snap = await getDoc(ref);
  if (snap.exists()) {
    const d = snap.data();
    currentUserRole = d.role || "customer";
    currentTwoFactorEnabled = !!d.twoFactorEmailEnabled;
  }
}

// Sayfa için rol kontrolü
async function requireRole(allowedRoles) {
  if (!currentUser) {
    // auth henüz gelmediyse yönlendirme yapma
    return false;
  }
  await refreshUserRole();

  if (currentTwoFactorEnabled && !currentUser.emailVerified) {
    alert(
      "Bu sayfaya erişmek için e-posta adresinizi doğrulamanız gerekiyor. Profil > Güvenlik bölümünden doğrulama e-postası gönderebilirsiniz."
    );
    window.location.href = "profile.html#security";
    return false;
  }

  if (!allowedRoles.includes(currentUserRole)) {
    window.location.href = "index.html";
    return false;
  }
  return true;
}

// ---------------- ÜRÜNLER ----------------

function handleAddToCart(productId, buttonEl) {
  if (!currentUser) {
    window.location.href = "login-shop.html";
    return;
  }

  addToCart(productId);

  const originalText = buttonEl.textContent;
  buttonEl.textContent = "Sepete eklendi";
  buttonEl.classList.add("btn-added");
  buttonEl.disabled = true;

  setTimeout(() => {
    buttonEl.textContent = originalText;
    buttonEl.classList.remove("btn-added");
    buttonEl.disabled = false;
  }, 10000);
}

function renderProducts() {
  const listEl = document.getElementById("product-list");
  if (!listEl) return;

  const searchBox = document.getElementById("searchBox");
  const queryText = searchBox ? searchBox.value.trim().toLowerCase() : "";

  listEl.innerHTML = "";

  PRODUCTS.filter((p) => {
    if (!queryText) return true;
    return (
      p.name.toLowerCase().includes(queryText) ||
      p.description.toLowerCase().includes(queryText) ||
      (p.category || "").toLowerCase().includes(queryText)
    );
  }).forEach((product) => {
    const card = document.createElement("div");
    card.className = "card";
    card.innerHTML = `
      <div class="card-img">Ürün Görseli</div>
      <div class="card-body">
        <h3>${product.name}</h3>
        <p>${product.description}</p>
        <div class="price">${product.price} TL</div>
        <button class="btn-primary" data-add-to-cart="${product.id}">
          Sepete Ekle
        </button>
      </div>
    `;
    listEl.appendChild(card);
  });

  listEl.querySelectorAll("[data-add-to-cart]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const id = Number(btn.getAttribute("data-add-to-cart"));
      handleAddToCart(id, btn);
    });
  });
}

// ---------------- SEPET ----------------

function renderCart() {
  const container = document.getElementById("cart-items-container");
  if (!container) return;

  const subEl = document.getElementById("sub-total");
  const totalEl = document.getElementById("total-price");
  const warningEl = document.getElementById("limit-warning");

  const cart = getCart();
  if (!cart.length) {
    container.innerHTML = `<p class="empty-cart">Sepetiniz boş.</p>`;
    if (subEl) subEl.textContent = "0 TL";
    if (totalEl) totalEl.textContent = "0 TL";
    if (warningEl) warningEl.textContent = "";
    updateCartProgress(0);
    return;
  }

  container.innerHTML = "";
  let subtotal = 0;

  cart.forEach((item) => {
    const product = PRODUCTS.find((p) => p.id === item.id);
    if (!product) return;
    const lineTotal = product.price * item.qty;
    subtotal += lineTotal;

    const row = document.createElement("div");
    row.className = "cart-item";
    row.innerHTML = `
      <div>
        <h4>${product.name}</h4>
        <p>${product.price} TL x ${item.qty} adet</p>
      </div>
      <div class="cart-item-actions">
        <span class="cart-item-total">${lineTotal.toFixed(2)} TL</span>
        <button class="btn-link" data-remove-from-cart="${product.id}">
          Kaldır
        </button>
      </div>
    `;
    container.appendChild(row);
  });

  if (subEl) subEl.textContent = `${subtotal.toFixed(2)} TL`;
  if (totalEl) totalEl.textContent = `${subtotal.toFixed(2)} TL`;

  if (warningEl) {
    if (subtotal > 0 && subtotal < 400) {
      warningEl.textContent =
        "Sepet tutarınız 400 TL altında. Siparişi tamamlamak için en az 400 TL'lik ürün eklemelisiniz.";
    } else if (subtotal >= 400) {
      warningEl.textContent =
        "Sepet tutarınız minimum limiti geçti, sipariş verebilirsiniz.";
    } else {
      warningEl.textContent = "";
    }
  }

  container.querySelectorAll("[data-remove-from-cart]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const id = Number(btn.getAttribute("data-remove-from-cart"));
      let cartNow = getCart();
      cartNow = cartNow.filter((item) => item.id !== id);
      saveCart(cartNow);
      renderCart();
      updateCartCount();
    });
  });

  updateCartCount();
}

// ---------------- NAVBAR & PROFİL ----------------

function setupNavbar() {
  const toggle = document.querySelector(".nav-toggle");
  const mobileMenu = document.querySelector(".nav-mobile-menu");

  if (toggle && mobileMenu) {
    toggle.addEventListener("click", () => {
      mobileMenu.classList.toggle("open");
    });
  }

  const userBtn = document.getElementById("nav-user-button");
  const dropdown = document.getElementById("nav-user-dropdown");
  const logoutBtn = document.getElementById("logout-btn");

  if (userBtn && dropdown) {
    userBtn.addEventListener("click", () => {
      dropdown.classList.toggle("open");
    });

    document.addEventListener("click", (e) => {
      if (!dropdown.contains(e.target) && !userBtn.contains(e.target)) {
        dropdown.classList.remove("open");
      }
    });
  }

  if (logoutBtn) {
    logoutBtn.addEventListener("click", async () => {
      try {
        await signOut(auth);
      } catch (err) {
        console.error(err);
      }
    });
  }

  updateCartCount();
  updateNavbarForAuth(currentUser);
}

function updateNavbarForAuth(user) {
  const guest = document.querySelector(".nav-auth-guest");
  const userBox = document.querySelector(".nav-auth-user");
  const nameSpan = document.getElementById("nav-user-name");
  const nameBig = document.getElementById("nav-user-name-big");
  const avatar = document.getElementById("nav-user-avatar");
  const avatarBig = document.getElementById("nav-user-avatar-big");
  const emailSpan = document.getElementById("nav-user-email");

  const mobileLogin = document.querySelector(".nav-mobile-login");
  const mobileSignup = document.querySelector(".nav-signup-mobile");

  const adminLink = document.querySelector(".nav-admin-link");
  const adminLinkMobile = document.querySelector(".nav-admin-link-mobile");
  const sellerPanelLink = document.querySelector(".nav-seller-panel-link");
  const sellerPanelMobile = document.querySelector(".nav-seller-panel-mobile");

  if (!guest || !userBox) return;

  if (user) {
    const displayName =
      user.displayName || (user.email ? user.email.split("@")[0] : "Kullanıcı");
    const firstLetter = displayName.charAt(0).toUpperCase();

    if (nameSpan) nameSpan.textContent = displayName;
    if (nameBig) nameBig.textContent = displayName;
    if (avatar) avatar.textContent = firstLetter;
    if (avatarBig) avatarBig.textContent = firstLetter;
    if (emailSpan && user.email) emailSpan.textContent = user.email;

    guest.style.display = "none";
    userBox.style.display = "flex";

    if (mobileLogin) mobileLogin.style.display = "none";
    if (mobileSignup) mobileSignup.style.display = "none";

    const isAdmin = currentUserRole === "admin";
    const isSeller = currentUserRole === "seller" || isAdmin;

    if (adminLink) adminLink.style.display = isAdmin ? "" : "none";
    if (adminLinkMobile) adminLinkMobile.style.display = isAdmin ? "" : "none";

    if (sellerPanelLink) sellerPanelLink.style.display = isSeller ? "" : "none";
    if (sellerPanelMobile) sellerPanelMobile.style.display = isSeller ? "" : "none";
  } else {
    guest.style.display = "flex";
    userBox.style.display = "none";

    if (mobileLogin) mobileLogin.style.display = "";
    if (mobileSignup) mobileSignup.style.display = "";

    if (adminLink) adminLink.style.display = "none";
    if (adminLinkMobile) adminLinkMobile.style.display = "none";
    if (sellerPanelLink) sellerPanelLink.style.display = "none";
    if (sellerPanelMobile) sellerPanelMobile.style.display = "none";
  }
}

// PROFİL SAYFASI

function updateProfilePageUser(user) {
  const emailSpan = document.getElementById("profile-email");
  const twoFactorToggle = document.getElementById("twofactor-toggle");
  if (!emailSpan && !twoFactorToggle) return;

  if (emailSpan) {
    if (user && user.email) emailSpan.textContent = user.email;
    else emailSpan.textContent = "- (Giriş yapılmamış)";
  }

  if (twoFactorToggle) {
    twoFactorToggle.checked = currentTwoFactorEnabled;
  }
}

function setupProfilePage() {
  const themeToggle = document.getElementById("theme-toggle");
  if (themeToggle) {
    themeToggle.addEventListener("click", () => {
      const isDark = document.body.classList.contains("theme-dark");
      applyTheme(isDark ? "light" : "dark");
    });
  }

  const resetBtn = document.getElementById("password-reset-btn");
  const msgBox = document.getElementById("profile-message");

  if (resetBtn && msgBox) {
    resetBtn.addEventListener("click", async () => {
      if (!currentUser || !currentUser.email) {
        msgBox.textContent =
          "Şifre sıfırlama için önce hesabınıza giriş yapmalısınız.";
        msgBox.classList.remove("success");
        return;
      }

      try {
        await sendPasswordResetEmail(auth, currentUser.email);
        msgBox.textContent =
          "Şifre sıfırlama bağlantısı e-posta adresinize gönderildi.";
        msgBox.classList.add("success");
      } catch (err) {
        console.error(err);
        msgBox.textContent = "İşlem sırasında bir hata oluştu. Lütfen tekrar deneyin.";
        msgBox.classList.remove("success");
      }
    });
  }

  const tfToggle = document.getElementById("twofactor-toggle");
  if (tfToggle) {
    tfToggle.addEventListener("change", async () => {
      if (!currentUser) {
        alert("Bu ayarı değiştirmek için giriş yapmalısınız.");
        tfToggle.checked = currentTwoFactorEnabled;
        return;
      }
      const ref = doc(db, "users", currentUser.uid);
      try {
        await updateDoc(ref, { twoFactorEmailEnabled: tfToggle.checked });
        currentTwoFactorEnabled = tfToggle.checked;
        if (tfToggle.checked && !currentUser.emailVerified) {
          alert(
            "İki aşamalı koruma açıldı. Şimdi e-posta adresinizi doğrulamanız gerekiyor."
          );
          await sendEmailVerification(currentUser);
        }
      } catch (e) {
        console.error(e);
        tfToggle.checked = currentTwoFactorEnabled;
      }
    });
  }

  updateProfilePageUser(currentUser);
}

// ---------------- SATICI OL SAYFASI: satıcı başvurusu ----------------

function setupSellerRequest() {
  const btn = document.getElementById("request-seller-btn");
  const msg = document.getElementById("request-seller-message");
  if (!btn || !msg) return;

  btn.addEventListener("click", async () => {
    if (!currentUser) {
      msg.textContent = "Satıcı başvurusu yapmak için önce giriş yapmanız gerekiyor.";
      return;
    }
    try {
      await addDoc(collection(db, "sellerRequests"), {
        uid: currentUser.uid,
        email: currentUser.email || "",
        status: "pending",
        createdAt: serverTimestamp()
      });
      msg.textContent =
        "Başvurunuz alındı. Yönetici onayı sonrasında hesabınıza satıcı yetkisi tanımlanacaktır.";
    } catch (e) {
      console.error(e);
      msg.textContent = "Başvuru sırasında bir hata oluştu. Lütfen tekrar deneyin.";
    }
  });
}

// ---------------- SATICI PANELİ ----------------

async function setupSellerPanel() {
  if (sellerPanelInitialized) return;
  const panel = document.getElementById("seller-panel");
  if (!panel) return;
  sellerPanelInitialized = true;

  const ok = await requireRole(["seller", "admin"]);
  if (!ok) return;

  const form = document.getElementById("seller-product-form");
  const msg = document.getElementById("seller-form-message");
  const list = document.getElementById("seller-product-list");

  if (form && msg) {
    form.addEventListener("submit", async (e) => {
      e.preventDefault();
      const title = document.getElementById("sp-title").value.trim();
      const price = Number(document.getElementById("sp-price").value);
      const cat = document.getElementById("sp-category").value.trim();
      const img = document.getElementById("sp-image").value.trim();
      const desc = document.getElementById("sp-description").value.trim();

      if (!title || !desc || !cat || isNaN(price) || price <= 0) {
        msg.textContent = "Lütfen tüm alanları doğru doldurunuz.";
        return;
      }

      try {
        await addDoc(collection(db, "productRequests"), {
          sellerId: currentUser.uid,
          title,
          price,
          category: cat,
          imageUrl: img,
          description: desc,
          status: "pending",
          createdAt: serverTimestamp()
        });
        msg.textContent =
          "Ürün başvurunuz alındı. Yönetici onayı sonrası yayına alınacaktır.";
        form.reset();
      } catch (e2) {
        console.error(e2);
        msg.textContent = "Kayıt sırasında hata oluştu.";
      }
    });
  }

  if (list) {
    const qMy = query(
      collection(db, "productRequests"),
      where("sellerId", "==", currentUser.uid)
    );

    onSnapshot(qMy, (snap) => {
      if (snap.empty) {
        list.innerHTML = "<p>Henüz ürün başvurunuz bulunmuyor.</p>";
        return;
      }
      let html =
        '<table class="simple-table"><thead><tr><th>Ürün</th><th>Fiyat</th><th>Durum</th></tr></thead><tbody>';
      snap.forEach((docSnap) => {
        const d = docSnap.data();
        const statusText =
          d.status === "approved"
            ? "✅ Onaylandı"
            : d.status === "rejected"
            ? "❌ Reddedildi"
            : "⏳ Beklemede";
        html += `<tr>
          <td>${d.title}</td>
          <td>${d.price} TL</td>
          <td>${statusText}</td>
        </tr>`;
      });
      html += "</tbody></table>";
      list.innerHTML = html;
    });
  }
}

// ---------------- ADMİN PANELİ ----------------

async function setupAdminPanel() {
  if (adminPanelInitialized) return;
  const panel = document.getElementById("admin-panel");
  if (!panel) return;
  adminPanelInitialized = true;

  const ok = await requireRole(["admin"]);
  if (!ok) return;

  const usersBox = document.getElementById("admin-users-list");
  const sellerBox = document.getElementById("admin-seller-requests");
  const productBox = document.getElementById("admin-product-requests");

  // Kullanıcı listesi & roller
  if (usersBox) {
    const usersCol = collection(db, "users");
    onSnapshot(usersCol, (snap) => {
      if (snap.empty) {
        usersBox.innerHTML = "<p>Kayıtlı kullanıcı bulunamadı.</p>";
        return;
      }
      let html =
        '<table class="simple-table"><thead><tr><th>E-posta</th><th>UID</th><th>Rol</th><th>İşlem</th></tr></thead><tbody>';
      snap.forEach((docSnap) => {
        const d = docSnap.data();
        const uid = docSnap.id;
        const role = d.role || "customer";
        html += `<tr data-uid="${uid}">
          <td>${d.email || "-"}</td>
          <td style="font-size:0.8rem;">${uid}</td>
          <td>
            <select class="admin-role-select">
              <option value="customer" ${role === "customer" ? "selected" : ""}>customer</option>
              <option value="seller" ${role === "seller" ? "selected" : ""}>seller</option>
              <option value="admin" ${role === "admin" ? "selected" : ""}>admin</option>
            </select>
          </td>
          <td>
            <button class="btn-secondary" data-action="save-role">Kaydet</button>
          </td>
        </tr>`;
      });
      html += "</tbody></table>";
      usersBox.innerHTML = html;

      usersBox.querySelectorAll("button[data-action='save-role']").forEach((btn) => {
        btn.addEventListener("click", async () => {
          const tr = btn.closest("tr");
          const uid = tr.getAttribute("data-uid");
          const select = tr.querySelector(".admin-role-select");
          const newRole = select.value;

          const userRef = doc(db, "users", uid);
          try {
            await updateDoc(userRef, { role: newRole });
          } catch (e) {
            console.error(e);
            alert("Rol güncellenirken hata oluştu (rules kontrol edin).");
          }
        });
      });
    });
  }

  // Satıcı başvuruları
  if (sellerBox) {
    const qSel = query(
      collection(db, "sellerRequests"),
      where("status", "==", "pending")
    );
    onSnapshot(qSel, (snap) => {
      if (snap.empty) {
        sellerBox.innerHTML = "<p>Bekleyen satıcı başvurusu yok.</p>";
        return;
      }
      let html =
        '<table class="simple-table"><thead><tr><th>E-posta</th><th>İşlem</th></tr></thead><tbody>';
      snap.forEach((docSnap) => {
        const d = docSnap.data();
        html += `<tr data-id="${docSnap.id}" data-uid="${d.uid}">
          <td>${d.email}</td>
          <td>
            <button class="btn-secondary" data-action="approve-seller">Satıcı olarak yetkilendir</button>
            <button class="btn-link" data-action="reject-seller">Reddet</button>
          </td>
        </tr>`;
      });
      html += "</tbody></table>";
      sellerBox.innerHTML = html;

      sellerBox.querySelectorAll("button[data-action]").forEach((btn) => {
        btn.addEventListener("click", async () => {
          const tr = btn.closest("tr");
          const id = tr.getAttribute("data-id");
          const uid = tr.getAttribute("data-uid");
          const action = btn.getAttribute("data-action");
          const reqRef = doc(db, "sellerRequests", id);
          const userRef = doc(db, "users", uid);

          try {
            if (action === "approve-seller") {
              await updateDoc(reqRef, {
                status: "approved",
                processedAt: serverTimestamp(),
                processedBy: currentUser.uid
              });
              await updateDoc(userRef, { role: "seller" });
            } else {
              await updateDoc(reqRef, {
                status: "rejected",
                processedAt: serverTimestamp(),
                processedBy: currentUser.uid
              });
            }
          } catch (e) {
            console.error(e);
          }
        });
      });
    });
  }

  // Ürün başvuruları
  if (productBox) {
    const qProd = query(
      collection(db, "productRequests"),
      where("status", "==", "pending")
    );
    onSnapshot(qProd, (snap) => {
      if (snap.empty) {
        productBox.innerHTML = "<p>Bekleyen ürün başvurusu yok.</p>";
        return;
      }
      let html =
        '<table class="simple-table"><thead><tr><th>Ürün</th><th>Fiyat</th><th>Satıcı ID</th><th>İşlem</th></tr></thead><tbody>';
      snap.forEach((docSnap) => {
        const d = docSnap.data();
        html += `<tr data-id="${docSnap.id}">
          <td>${d.title}</td>
          <td>${d.price} TL</td>
          <td style="font-size:0.8rem;">${d.sellerId}</td>
          <td>
            <button class="btn-secondary" data-action="approve-product">Onayla</button>
            <button class="btn-link" data-action="reject-product">Reddet</button>
          </td>
        </tr>`;
      });
      html += "</tbody></table>";
      productBox.innerHTML = html;

      productBox.querySelectorAll("button[data-action]").forEach((btn) => {
        btn.addEventListener("click", async () => {
          const tr = btn.closest("tr");
          const id = tr.getAttribute("data-id");
          const action = btn.getAttribute("data-action");
          const reqRef = doc(db, "productRequests", id);

          const snapOne = await getDoc(reqRef);
          if (!snapOne.exists()) return;
          const d = snapOne.data();

          try {
            if (action === "approve-product") {
              await addDoc(collection(db, "products"), {
                title: d.title,
                price: d.price,
                category: d.category,
                imageUrl: d.imageUrl || "",
                description: d.description,
                sellerId: d.sellerId,
                createdAt: serverTimestamp()
              });
              await updateDoc(reqRef, {
                status: "approved",
                processedAt: serverTimestamp(),
                processedBy: currentUser.uid
              });
            } else {
              await updateDoc(reqRef, {
                status: "rejected",
                processedAt: serverTimestamp(),
                processedBy: currentUser.uid
              });
            }
          } catch (e) {
            console.error(e);
          }
        });
      });
    });
  }
}

// ---------------- AUTH DURUMU ----------------

onAuthStateChanged(auth, async (user) => {
  currentUser = user || null;
  await ensureUserDoc(user);
  updateNavbarForAuth(user);

  const path = window.location.pathname;

  // Giriş yoksa admin/seller paneline erişmeye çalışıyorsa login'e yolla
  if (!user) {
    if (
      path.endsWith("admin.html") ||
      path.endsWith("seller-dashboard.html")
    ) {
      window.location.href = "login.html";
    }
    return;
  }

  // Giriş varsa ve DOM hazırsa ilgili panelleri kur
  setupSellerPanel();
  setupAdminPanel();
});

// ---------------- DOM YÜKLENDİĞİNDE ----------------

document.addEventListener("DOMContentLoaded", () => {
  initTheme();

  loadPartial("navbar-placeholder", "navbar.html", () => {
    setupNavbar();
    applyTheme(localStorage.getItem(THEME_KEY) || "light");
  });
  loadPartial("footer-placeholder", "footer.html");

  const searchBox = document.getElementById("searchBox");
  if (searchBox) searchBox.addEventListener("input", () => renderProducts());
  renderProducts();

  renderCart();

  // Sepeti onayla
  const checkoutBtn = document.getElementById("checkout-btn");
  if (checkoutBtn) {
    checkoutBtn.addEventListener("click", async () => {
      const subtotal = getCartSubtotal();
      if (subtotal < 400) {
        const warningEl = document.getElementById("limit-warning");
        if (warningEl) {
          warningEl.textContent =
            "Sepet tutarınız 400 TL altında. Siparişi tamamlamak için en az 400 TL'lik ürün eklemelisiniz.";
        }
        return;
      }

      if (!currentUser) {
        window.location.href = "login-shop.html";
        return;
      }
      await refreshUserRole();
      if (currentTwoFactorEnabled && !currentUser.emailVerified) {
        alert(
          "Siparişi tamamlamak için e-posta adresinizi doğrulamanız gerekiyor. Profil > Güvenlik bölümünden doğrulama maili gönderebilirsiniz."
        );
        window.location.href = "profile.html#security";
        return;
      }

      const phone = "905425029440";
      const message = encodeURIComponent(
        `Merhaba, ÖğrenciFy üzerinden sipariş vermek istiyorum. Sepet tutarım: ${subtotal.toFixed(
          2
        )} TL`
      );
      window.location.href = `https://wa.me/${phone}?text=${message}`;
    });
  }

  setupProfilePage();
  setupSellerRequest();
});
