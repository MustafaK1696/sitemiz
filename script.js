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
  serverTimestamp,
  deleteDoc
} from "https://www.gstatic.com/firebasejs/10.13.1/firebase-firestore.js";

import {
  getStorage,
  ref as storageRef,
  uploadBytes,
  getDownloadURL
} from "https://www.gstatic.com/firebasejs/10.13.1/firebase-storage.js";

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
const storage = getStorage(app);

let currentUser = null;
let currentUserRole = "customer";
let currentTwoFactorEnabled = false;

let adminPanelInitialized = false;
let sellerPanelInitialized = false;

// Firestore'dan gelen ürünler
let PRODUCTS = [];

// ---------------- TEMA ----------------

const THEME_KEY = "ogrencify_theme";

function applyTheme(theme) {
  if (theme === "dark") document.body.classList.add("theme-dark");
  else document.body.classList.remove("theme-dark");

  localStorage.setItem(THEME_KEY, theme);
  const toggleBtn = document.getElementById("theme-toggle");
  if (toggleBtn) {
    toggleBtn.textContent = theme === "dark" ? "☀️ Aydınlık Tema" : "🌙 Karanlık Tema";
  }
}

function initTheme() {
  const saved = localStorage.getItem(THEME_KEY) || "light";
  applyTheme(saved);
}

// ---------------- ORTAK HELPERS ----------------

function loadPartial(id, url, callback) {
  const el = document.getElementById(id);
  if (!el) return;
  fetch(url)
    .then((r) => r.text())
    .then((html) => {
      el.innerHTML = html;
      if (callback) callback();
    })
    .catch((e) => console.error("Partial yüklenirken hata:", e));
}

function formatPrice(value) {
  return (value || 0).toFixed(2) + " TL";
}

// ---------------- NAVBAR ----------------

function setupNavbar() {
  const themeToggle = document.getElementById("theme-toggle");
  if (themeToggle) {
    themeToggle.addEventListener("click", () => {
      const newTheme = document.body.classList.contains("theme-dark") ? "light" : "dark";
      applyTheme(newTheme);
    });
  }

  const logoutBtn = document.getElementById("logout-btn");
  if (logoutBtn) {
    logoutBtn.addEventListener("click", async () => {
      try {
        await signOut(auth);
      } catch (e) {
        console.error("Çıkış hatası:", e);
      }
    });
  }
}

function updateNavbarForAuth(user) {
  const loginLinks = document.querySelectorAll(".nav-login-only");
  const logoutLinks = document.querySelectorAll(".nav-logout-only");

  if (!user) {
    loginLinks.forEach((el) => (el.style.display = "inline-block"));
    logoutLinks.forEach((el) => (el.style.display = "none"));
  } else {
    loginLinks.forEach((el) => (el.style.display = "none"));
    logoutLinks.forEach((el) => (el.style.display = "inline-block"));
  }
}

// ---------------- CART (LOCALSTORAGE) ----------------

const CART_KEY = "ogrencify_cart";

function getCart() {
  try {
    const raw = localStorage.getItem(CART_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch (e) {
    console.error("Cart parse error:", e);
    return [];
  }
}

function saveCart(cart) {
  localStorage.setItem(CART_KEY, JSON.stringify(cart));
}

function addToCart(productId) {
  const cart = getCart();
  const existing = cart.find((item) => item.id === productId);
  if (existing) {
    existing.qty += 1;
  } else {
    cart.push({ id: productId, qty: 1 });
  }
  saveCart(cart);
  updateCartCount();
  renderCart();
}

function removeFromCart(productId) {
  let cart = getCart();
  cart = cart.filter((item) => item.id !== productId);
  saveCart(cart);
  updateCartCount();
  renderCart();
}

function changeCartQuantity(productId, delta) {
  const cart = getCart();
  const item = cart.find((i) => i.id === productId);
  if (!item) return;
  item.qty += delta;
  if (item.qty <= 0) {
    const idx = cart.indexOf(item);
    cart.splice(idx, 1);
  }
  saveCart(cart);
  updateCartCount();
  renderCart();
}

function getCartSubtotal() {
  const cart = getCart();
  let sum = 0;
  for (const item of cart) {
    const prod = PRODUCTS.find((p) => p.id === item.id);
    if (prod) {
      sum += prod.price * item.qty;
    }
  }
  return sum;
}

function updateCartCount() {
  const cart = getCart();
  const count = cart.reduce((acc, item) => acc + item.qty, 0);
  const el = document.getElementById("cart-count");
  if (el) el.textContent = count;
}

function renderCart() {
  const cartContainer = document.getElementById("cart-items");
  if (!cartContainer) return;

  const cart = getCart();
  if (!cart.length) {
    cartContainer.innerHTML = "<p>Sepetiniz boş.</p>";
    const subtotalEl = document.getElementById("cart-subtotal");
    if (subtotalEl) subtotalEl.textContent = "0.00 TL";
    const limitWarning = document.getElementById("limit-warning");
    if (limitWarning) limitWarning.textContent = "";
    return;
  }

  let html = "";
  cart.forEach((item) => {
    const prod = PRODUCTS.find((p) => p.id === item.id);
    if (!prod) return;
    html += `
      <div class="cart-item">
        <img src="${prod.imageUrl}" alt="${prod.name}" class="cart-item-image" />
        <div class="cart-item-info">
          <h3>${prod.name}</h3>
          <p>${formatPrice(prod.price)} x ${item.qty}</p>
          <div class="cart-actions">
            <button class="btn-sm" data-action="dec" data-id="${prod.id}">-</button>
            <button class="btn-sm" data-action="inc" data-id="${prod.id}">+</button>
            <button class="btn-sm btn-danger" data-action="remove" data-id="${prod.id}">
              Sil
            </button>
          </div>
        </div>
      </div>
    `;
  });
  cartContainer.innerHTML = html;

  const subtotal = getCartSubtotal();
  const subtotalEl = document.getElementById("cart-subtotal");
  if (subtotalEl) subtotalEl.textContent = subtotal.toFixed(2) + " TL";

  const limitWarning = document.getElementById("limit-warning");
  if (limitWarning) {
    if (subtotal < 400) {
      limitWarning.textContent =
        "Sepet tutarınız 400 TL altında. Siparişi tamamlamak için en az 400 TL'lik ürün eklemelisiniz.";
    } else {
      limitWarning.textContent = "";
    }
  }

  cartContainer.querySelectorAll("button[data-action]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const action = btn.getAttribute("data-action");
      const id = btn.getAttribute("data-id");
      if (action === "inc") changeCartQuantity(id, 1);
      else if (action === "dec") changeCartQuantity(id, -1);
      else if (action === "remove") removeFromCart(id);
    });
  });
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
      createdAt: serverTimestamp(),
      twoFactorEnabled: false
    });
  }
}

async function refreshUserRole() {
  if (!currentUser) return;
  const ref = doc(db, "users", currentUser.uid);
  const snap = await getDoc(ref);
  if (snap.exists()) {
    const data = snap.data();
    currentUserRole = data.role || "customer";
    currentTwoFactorEnabled = !!data.twoFactorEnabled;
  }
}

// Sayfa için rol kontrolü
async function requireRole(allowedRoles) {
  if (!currentUser) return false;

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

// ---------------- ÜRÜNLERİ FIRESTORE'DAN YÜKLE ----------------

function loadProductsFromFirestore() {
  const productsCol = collection(db, "products");
  onSnapshot(productsCol, (snap) => {
    PRODUCTS = [];
    snap.forEach((docSnap) => {
      const d = docSnap.data();
      PRODUCTS.push({
        id: docSnap.id,
        name: d.title,
        price: d.price,
        category: d.category || "",
        description: d.description || "",
        imageUrl: d.imageUrl || "",
        sellerId: d.sellerId || "",
        featured: !!d.featured
      });
    });
    renderProducts();
    renderCart();
    renderFeatured();
  });
}

// ---------------- ÜRÜNLER SAYFASI ----------------

function handleAddToCart(productId, buttonEl) {
  if (!currentUser) {
    window.location.href = "login-shop.html";
    return;
  }

  addToCart(productId);

  if (buttonEl) {
    buttonEl.disabled = true;
    buttonEl.textContent = "Eklendi";
    setTimeout(() => {
      buttonEl.disabled = false;
      buttonEl.textContent = "Sepete Ekle";
    }, 1000);
  }
}

function renderProducts() {
  const grid = document.getElementById("products-grid");
  if (!grid) return;

  const searchBox = document.getElementById("searchBox");
  const filterCat = document.getElementById("filter-category");

  let filtered = [...PRODUCTS];

  if (searchBox && searchBox.value.trim()) {
    const q = searchBox.value.trim().toLowerCase();
    filtered = filtered.filter(
      (p) =>
        p.name.toLowerCase().includes(q) ||
        p.description.toLowerCase().includes(q) ||
        p.category.toLowerCase().includes(q)
    );
  }

  if (filterCat && filterCat.value !== "all") {
    filtered = filtered.filter((p) => p.category === filterCat.value);
  }

  if (!filtered.length) {
    grid.innerHTML = "<p>Bu kriterlere uygun ürün bulunamadı.</p>";
    return;
  }

  grid.innerHTML = "";
  filtered.forEach((p) => {
    const card = document.createElement("div");
    card.className = "product-card";
    card.innerHTML = `
      <img src="${p.imageUrl}" alt="${p.name}" class="product-image" />
      <div class="product-body">
        <h3>${p.name}</h3>
        <p class="product-category">${p.category || ""}</p>
        <p class="product-description">${p.description}</p>
        <p class="product-price">${formatPrice(p.price)}</p>
        <button class="btn-primary" data-id="${p.id}">Sepete Ekle</button>
      </div>
    `;
    const btn = card.querySelector("button");
    btn.addEventListener("click", () => handleAddToCart(p.id, btn));
    grid.appendChild(card);
  });
}

// ---------------- VİTRİN ----------------

function renderFeatured() {
  const container = document.getElementById("featured-products");
  if (!container) return;

  const featured = PRODUCTS.filter((p) => p.featured);
  if (!featured.length) {
    container.innerHTML = "<p>Şu anda vitrin ürünü bulunmamaktadır.</p>";
    return;
  }

  let html = "";
  featured.forEach((p) => {
    html += `
      <div class="featured-card">
        <img src="${p.imageUrl}" alt="${p.name}" class="featured-image" />
        <div class="featured-body">
          <h3>${p.name}</h3>
          <p>${p.description}</p>
          <p class="featured-price">${formatPrice(p.price)}</p>
          <button class="btn-primary" data-id="${p.id}">Sepete Ekle</button>
        </div>
      </div>
    `;
  });
  container.innerHTML = html;

  container.querySelectorAll("button[data-id]").forEach((btn) => {
    const id = btn.getAttribute("data-id");
    btn.addEventListener("click", () => handleAddToCart(id, btn));
  });
}

// ---------------- PROFİL SAYFASI ----------------

function setupProfilePage() {
  const profileSection = document.getElementById("profile-page");
  if (!profileSection) return;

  const emailField = document.getElementById("profile-email");
  const roleField = document.getElementById("profile-role");
  const twoFactorCheckbox = document.getElementById("twofactor-checkbox");
  const twoFactorStatus = document.getElementById("twofactor-status");
  const resendVerifyBtn = document.getElementById("resend-verify-btn");

  if (!currentUser) {
    window.location.href = "login.html";
    return;
  }

  refreshUserRole().then(() => {
    if (emailField) emailField.textContent = currentUser.email || "-";
    if (roleField) roleField.textContent = currentUserRole;
    if (twoFactorCheckbox)
      twoFactorCheckbox.checked = currentTwoFactorEnabled;
    if (twoFactorStatus) {
      twoFactorStatus.textContent = currentTwoFactorEnabled
        ? "Etkin"
        : "Kapalı";
    }
  });

  if (twoFactorCheckbox) {
    twoFactorCheckbox.addEventListener("change", async () => {
      const newVal = twoFactorCheckbox.checked;
      const ref = doc(db, "users", currentUser.uid);
      try {
        await updateDoc(ref, { twoFactorEnabled: newVal });
        currentTwoFactorEnabled = newVal;
        if (twoFactorStatus) {
          twoFactorStatus.textContent = newVal ? "Etkin" : "Kapalı";
        }
      } catch (e) {
        console.error(e);
        twoFactorCheckbox.checked = !newVal;
      }
    });
  }

  if (resendVerifyBtn) {
    resendVerifyBtn.addEventListener("click", async () => {
      if (!currentUser) return;
      try {
        await sendEmailVerification(currentUser);
        alert("Doğrulama e-postası gönderildi. Lütfen e-posta kutunuzu kontrol edin.");
      } catch (e) {
        console.error(e);
        alert("E-posta gönderilirken hata oluştu.");
      }
    });
  }
}

// ---------------- SATICI OL BAŞVURUSU ----------------

function setupSellerRequest() {
  const form = document.getElementById("seller-request-form");
  if (!form) return;

  const msg = document.getElementById("seller-request-message");

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    if (!currentUser) {
      window.location.href = "login.html";
      retu
      rn;
    }

    const reason = document.getElementById("seller-reason").value.trim();
    if (!reason) {
      msg.textContent = "Lütfen satıcı olmak istemenizin nedenini açıklayın.";
      return;
    }

    try {
      await addDoc(collection(db, "sellerRequests"), {
        uid: currentUser.uid,
        email: currentUser.email || "",
        reason,
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
      const desc = document.getElementById("sp-description").value.trim();
      const imageUrl = document.getElementById("sp-image-url").value.trim();

      if (!title || !desc || !cat || isNaN(price) || price <= 0 || !imageUrl) {
        msg.textContent = "Lütfen tüm alanları eksiksiz doldurunuz.";
        return;
      }

      if (!imageUrl.startsWith("http://") && !imageUrl.startsWith("https://")) {
        msg.textContent =
          "Lütfen geçerli bir URL giriniz (http veya https ile başlamalı).";
        return;
      }

      const allowedExts = ["jpg", "jpeg", "png", "pdf"];
      const urlWithoutQuery = imageUrl.split("?")[0].split("#")[0];
      const parts = urlWithoutQuery.split(".");
      const ext = parts.length > 1 ? parts.pop().toLowerCase() : "";

      if (!allowedExts.includes(ext)) {
        msg.textContent =
          "Sadece .jpg, .jpeg, .png veya .pdf uzantılı dosya URL'lerine izin verilmektedir.";
        return;
      }

      msg.textContent = "Ürün başvurunuz kaydediliyor...";

      try {
        await addDoc(collection(db, "productRequests"), {
          sellerId: currentUser.uid,
          title,
          price,
          category: cat,
          description: desc,
          imageUrl,
          fileExt: ext,
          status: "pending",
          createdAt: serverTimestamp()
        });
        msg.textContent =
          "Ürün başvurunuz alındı. Yönetici onayı sonrası yayına alınacaktır.";
        form.reset();
      } catch (e2) {
        console.error(e2);
        msg.textContent =
          "Kayıt sırasında bir hata oluştu. Lütfen tekrar deneyin.";
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
  const productsManageBox = document.getElementById("admin-products-list");

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
          <td>${d.email || "-"}</td>
          <td>
            <button class="btn-secondary" data-action="approve-seller">Onayla</button>
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

  // Ürün başvuruları (onay/red)
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
                featured: false,
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

  // Onaylanmış ürünler & vitrin yönetimi
  if (productsManageBox) {
    const qAll = collection(db, "products");
    onSnapshot(qAll, (snap) => {
      if (snap.empty) {
        productsManageBox.innerHTML = "<p>Henüz onaylanmış ürün bulunmuyor.</p>";
        return;
      }
      let html =
        '<table class="simple-table"><thead><tr><th>Ürün</th><th>Fiyat</th><th>Kategori</th><th>Vitrin</th><th>İşlem</th></tr></thead><tbody>';
      snap.forEach((docSnap) => {
        const d = docSnap.data();
        html += `<tr data-id="${docSnap.id}">
          <td>${d.title}</td>
          <td>
            <input type="number" class="admin-prod-price" value="${d.price}" min="0" step="0.01">
          </td>
          <td>
            <input type="text" class="admin-prod-cat" value="${d.category || ""}">
          </td>
          <td style="text-align:center;">
            <input
              type="checkbox"
              class="admin-prod-featured"
              ${d.featured ? "checked" : ""}
            >
          </td>
          <td>
            <button class="btn-secondary" data-action="save-product">Kaydet</button>
            <button class="btn-link" data-action="delete-product">Sil</button>
          </td>
        </tr>`;
      });
      html += "</tbody></table>";
      productsManageBox.innerHTML = html;

      productsManageBox.querySelectorAll("button[data-action]").forEach((btn) => {
        btn.addEventListener("click", async () => {
          const tr = btn.closest("tr");
          const id = tr.getAttribute("data-id");
          const action = btn.getAttribute("data-action");

          const refProd = doc(db, "products", id);

          if (action === "save-product") {
            const priceInput = tr.querySelector(".admin-prod-price");
            const catInput = tr.querySelector(".admin-prod-cat");
            const featInput = tr.querySelector(".admin-prod-featured");

            const price = Number(priceInput.value);
            const cat = catInput.value.trim();
            const feat = featInput.checked;

            try {
              await updateDoc(refProd, {
                price,
                category: cat,
                featured: feat
              });
            } catch (e) {
              console.error(e);
              alert("Ürün güncellenirken hata oluştu.");
            }
          } else if (action === "delete-product") {
            if (!confirm("Bu ürünü silmek istediğinize emin misiniz?")) return;
            try {
              await deleteDoc(refProd);
            } catch (e) {
              console.error(e);
              alert("Ürün silinirken hata oluştu.");
            }
          }
        });
      });
    });
  }
}

// ---------------- AUTH DURUMU --------------------------

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

  // Ürünleri Firestore'dan dinamik yükle
  loadProductsFromFirestore();

  const searchBox = document.getElementById("searchBox");
  if (searchBox) searchBox.addEventListener("input", () => renderProducts());

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
          "Sepeti onaylamak için e-posta adresinizi doğrulamanız gerekiyor. Profil > Güvenlik bölümünden doğrulama e-postası gönderebilirsiniz."
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
