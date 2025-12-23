// script.js  (ES module)

// Firebase

// --- Drive public link helpers (manual upload) ---
function extractDriveId(input) {
  const s = String(input || "").trim();
  if (!s) return "";
  // If already looks like an id
  if (/^[a-zA-Z0-9_-]{20,}$/.test(s)) return s;

  // /file/d/ID/
  let m = s.match(/\/file\/d\/([a-zA-Z0-9_-]+)/);
  if (m) return m[1];

  // id=ID
  m = s.match(/[?&]id=([a-zA-Z0-9_-]+)/);
  if (m) return m[1];

  return "";
}

function driveDirectUrl(fileId, kind) {
  const id = String(fileId || "").trim();
  if (!id) return "";
  // PDF: embed-friendly preview
  if (kind === "pdf") return `https://drive.google.com/file/d/${id}/preview`;
  // Images: Drive "uc?export=view" linki bazı durumlarda HTML/redirect döndürebiliyor.
  // Thumbnail endpoint'i görselleri hotlink için daha stabil servis ediyor.
  if (kind === "image") return `https://drive.google.com/thumbnail?id=${id}&sz=w1200`;
  // Video: keep as direct download (playback depends on Drive/CORS, but this is the most compatible here)
  return `https://drive.google.com/uc?export=download&id=${id}`;
}


function normalizeMediaUrl(rawUrl, kind) {
  const s = String(rawUrl || "").trim();
  if (!s) return "";
  // If it's a Drive share link or raw fileId, convert to direct/preview URL.
  const id = extractDriveId(s);
  if (id) return driveDirectUrl(id, kind);
  return s;
}

function normalizeMediaItem(raw) {
  if (!raw) return null;
  const type = String(raw.type || "").toLowerCase() || "image";
  const url = String(raw.url || "").trim();
  const kind = (type === "pdf") ? "pdf" : (type === "video" ? "video" : "image");
  return { type: kind, url: normalizeMediaUrl(url, kind) };
}

function normalizeMediaArray(arr) {
  if (!Array.isArray(arr)) return [];
  return arr.map(normalizeMediaItem).filter(Boolean).filter(m => m.url);
}



import { initializeApp, getApp, getApps } from "https://www.gstatic.com/firebasejs/10.13.1/firebase-app.js";

// --- Drive link helpers ---
function extractDriveFileId(url) {
  if (!url) return null;
  try {
    const u = new URL(url);
    // /file/d/<id>/view
    const m1 = u.pathname.match(/\/file\/d\/([^\/]+)/);
    if (m1 && m1[1]) return m1[1];
    // open?id=<id>
    const id = u.searchParams.get("id");
    if (id) return id;
    // uc?id=<id>
    const id2 = u.searchParams.get("id");
    if (id2) return id2;
  } catch (e) {
    // allow raw id
    if (/^[a-zA-Z0-9_-]{10,}$/.test(String(url).trim())) return String(url).trim();
  }
  return null;
}

function driveImageUrlFromId(fileId) {
  return `https://drive.google.com/uc?export=view&id=${fileId}`;
}

function driveVideoPreviewUrlFromId(fileId) {
  return `https://drive.google.com/file/d/${fileId}/preview`;
}
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
  uploadBytesResumable,
  getDownloadURL
} from "https://www.gstatic.com/firebasejs/10.13.1/firebase-storage.js";

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
const storage = getStorage(app);


// --- Upload yardımcıları ---
function withTimeout(promise, ms, label="işlem") {
  let t;
  const timeout = new Promise((_, rej) => {
    t = setTimeout(() => rej(new Error(`${label} zaman aşımına uğradı. İnternetinizi kontrol edip tekrar deneyin.`)), ms);
  });
  return Promise.race([promise.finally(() => clearTimeout(t)), timeout]);
}

async function uploadFileWithProgress(fileRef, file, onPct) {
  return await withTimeout(new Promise((resolve, reject) => {
    const task = uploadBytesResumable(fileRef, file);
    task.on("state_changed",
      (snap) => {
        if (!snap.totalBytes) return;
        const pct = Math.round((snap.bytesTransferred / snap.totalBytes) * 100);
        if (onPct) onPct(pct);
      },
      (err) => reject(err),
      async () => {
        try {
          const url = await getDownloadURL(task.snapshot.ref);
          resolve(url);
        } catch (e) { reject(e); }
      }
    );
  }), 120000, "Dosya yükleme"); // 2 dk timeout
}

let currentUser = null;
let currentUserRole = "customer";
let currentTwoFactorEnabled = false;

// Kategori kısıtı
const ALLOWED_CATEGORIES = ["ev","dekorasyon","aksesuar","elektronik","hediyelik"];
const CATEGORY_LABELS = {ev:"Ev", dekorasyon:"Dekorasyon", aksesuar:"Aksesuar", elektronik:"Elektronik", hediyelik:"Hediyelik"};

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
    // Prefer price stored in cart (works even before PRODUCTS loads)
    const itemPrice = Number(item.price ?? 0);
    if (itemPrice > 0) {
      subtotal += itemPrice * Number(item.qty || 0);
      return;
    }

    // Fallback: look up from PRODUCTS if available
    const product = PRODUCTS.find((p) => p.id === item.id);
    if (product) subtotal += Number(product.price || 0) * Number(item.qty || 0);
  });

  return subtotal;
}

function getCartLineItems() {
  const cart = getCart();
  return cart
    .map((item) => {
      const id = String(item.id || "");
      const qty = Number(item.qty || 0);
      if (!id || qty <= 0) return null;

      const p = PRODUCTS.find((x) => x.id === id);
      const name = String(item.name || (p ? p.name : "") || "Ürün").trim();
      const price = Number(item.price ?? (p ? p.price : 0) ?? 0);

      return {
        id,
        name,
        qty,
        price,
        lineTotal: price * qty
      };
    })
    .filter(Boolean);
}

function buildWhatsAppOrderMessage(subtotal) {
  const items = getCartLineItems();
  const lines = items.map((it) => {
    const priceTxt = Number.isFinite(it.price) ? `${it.price.toFixed(2)} TL` : "-";
    const lineTotalTxt = Number.isFinite(it.lineTotal) ? `${it.lineTotal.toFixed(2)} TL` : "-";
    return `• ${it.name} (Kod: ${it.id}) x${it.qty} — ${priceTxt} (Satır: ${lineTotalTxt})`;
  });

  const header = "Merhaba, ÖğrenciFy üzerinden sipariş vermek istiyorum.";
  const detailHeader = lines.length ? "\n\nSipariş Detayları:\n" + lines.join("\n") : "";
  const totalLine = `\n\nToplam: ${Number(subtotal || 0).toFixed(2)} TL`;

  return header + detailHeader + totalLine;
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

function setCartItemQty(productId, qty, meta) {
  const cart = getCart();
  const idx = cart.findIndex((i) => i.id === productId);

  if (qty <= 0) {
    if (idx >= 0) cart.splice(idx, 1);
  } else {
    if (idx >= 0) {
      cart[idx].qty = qty;
      // refresh meta if provided
      if (meta && typeof meta === "object") {
        cart[idx].name = meta.name ?? cart[idx].name;
        cart[idx].price = meta.price ?? cart[idx].price;
        cart[idx].imageUrl = meta.imageUrl ?? cart[idx].imageUrl;
      }
    } else {
      const item = { id: productId, qty };
      if (meta && typeof meta === "object") {
        item.name = meta.name ?? "";
        item.price = meta.price ?? 0;
        item.imageUrl = meta.imageUrl ?? "";
      }
      cart.push(item);
    }
  }

  saveCart(cart);

  // If we're on cart page, re-render immediately for UI consistency
  if (document.getElementById("cart-items-container")) renderCart();

  updateCartCount();
}

function adjustCartItem(productId, delta) {
  const cart = getCart();
  const item = cart.find((i) => i.id === productId);
  const nextQty = (item ? Number(item.qty || 0) : 0) + delta;

  // try to pull latest meta from PRODUCTS if available
  const p = PRODUCTS.find((x) => x.id === productId);
  const meta = p
    ? { name: p.name, price: Number(p.price || 0), imageUrl: p.imageUrl || "" }
    : undefined;

  setCartItemQty(productId, nextQty, meta);
}

function addToCart(productId, meta) {
  const cart = getCart();
  const existing = cart.find((item) => item.id === productId);

  if (existing) {
    existing.qty = Number(existing.qty || 0) + 1;
    if (meta && typeof meta === "object") {
      existing.name = meta.name ?? existing.name;
      existing.price = meta.price ?? existing.price;
      existing.imageUrl = meta.imageUrl ?? existing.imageUrl;
    }
  } else {
    const item = { id: productId, qty: 1 };
    if (meta && typeof meta === "object") {
      item.name = meta.name ?? "";
      item.price = meta.price ?? 0;
      item.imageUrl = meta.imageUrl ?? "";
    }
    cart.push(item);
  }

  saveCart(cart);

  if (document.getElementById("cart-items-container")) renderCart();
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
        imageUrl: normalizeMediaUrl(d.imageUrl || "", (String(d.imageUrl||"").toLowerCase().includes(".pdf") ? "pdf" : "image")),
        media: Array.isArray(d.media)
          ? normalizeMediaArray(d.media)
          : (d.imageUrl
              ? [{ type: (String(d.imageUrl).toLowerCase().includes(".pdf") ? "pdf" : "image"), url: normalizeMediaUrl(d.imageUrl, (String(d.imageUrl).toLowerCase().includes(".pdf") ? "pdf" : "image")) }]
              : []),
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

  const p = PRODUCTS.find(x => x.id === productId);
  const meta = p ? { name: p.name, price: Number(p.price || 0), imageUrl: p.imageUrl || "" } : undefined;
  addToCart(productId, meta);

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

  // Başlık (kategori filtreliyse: "Ev ürünleri" vb.)
  const titleEl = document.getElementById("products-title");

  const searchBox = document.getElementById("searchBox");
  const queryText = searchBox ? searchBox.value.trim().toLowerCase() : "";

  // URL kategori filtresi (products.html?cat=ev)
  const allowedCats = ["ev", "dekorasyon", "aksesuar", "elektronik", "hediyelik"];
  const urlCatRaw = (new URLSearchParams(window.location.search).get("cat") || "").trim().toLowerCase();
  const urlCat = allowedCats.includes(urlCatRaw) ? urlCatRaw : "";

  if (titleEl) {
    const label = urlCat ? (CATEGORY_LABELS[urlCat] || urlCat) : "Tüm";
    titleEl.textContent = urlCat ? `${label} ürünleri` : "Tüm Ürünler";
  }
  // Sekme başlığı da kategoriye göre güncellensin
  if (urlCat) document.title = `${(CATEGORY_LABELS[urlCat] || urlCat)} ürünleri - ÖğrenciFy`;
  else document.title = `Ürünler - ÖğrenciFy`;


  listEl.innerHTML = "";

  if (!PRODUCTS.length) {
    listEl.innerHTML = "<p>Henüz ürün eklenmemiş.</p>";
    return;
  }

  PRODUCTS.filter((p) => {
    // Kategori varsa önce onu uygula
    if (urlCat && (p.category || '').toLowerCase() !== urlCat) return false;

    if (!queryText) return true;
    return (
      (p.name || "").toLowerCase().includes(queryText) ||
      (p.description || "").toLowerCase().includes(queryText) ||
      (p.category || "").toLowerCase().includes(queryText)
    );
  }).forEach((product) => {
    // Medya (görsel/pdf + opsiyonel video) -> kaydırmalı alan
    const mediaItems = Array.isArray(product.media) && product.media.length
      ? normalizeMediaArray(product.media)
      : (product.imageUrl
          ? [{ type: (String(product.imageUrl).toLowerCase().includes('.pdf') ? 'pdf' : 'image'), url: normalizeMediaUrl(product.imageUrl, (String(product.imageUrl).toLowerCase().includes('.pdf') ? 'pdf' : 'image')) }]
          : []);

    let mediaHtml = `<div class="card-img placeholder">Ürün Görseli</div>`;

    if (mediaItems.length === 1) {
      const m = mediaItems[0];
      if (m.type === "video") {
        mediaHtml = `
          <div class="card-img">
            <video src="${m.url}" controls preload="metadata"></video>
          </div>`;
      } else if (m.type === "pdf") {
        mediaHtml = `
          <div class="card-img pdf-icon">
            <a class="pdf-open" href="${m.url}" target="_blank" rel="noopener">PDF'yi Aç</a>
          </div>`;
      } else {
        mediaHtml = `
          <div class="card-img">
            <img src="${m.url}" alt="${product.name}" loading="lazy" referrerpolicy="no-referrer" onerror="this.onerror=null;this.src='data:image/svg+xml;charset=UTF-8,%3Csvg%20xmlns='http://www.w3.org/2000/svg'%20width='600'%20height='400'%3E%3Crect%20width='100%25'%20height='100%25'%20fill='%23f2f2f2'/%3E%3Ctext%20x='50%25'%20y='50%25'%20dominant-baseline='middle'%20text-anchor='middle'%20fill='%23999'%20font-size='20'%20font-family='Arial'%3EG%C3%B6rsel%20yok%3C/text%3E%3C/svg%3E';" />
          </div>`;
      }
    } else if (mediaItems.length > 1) {
      const slides = mediaItems.map((m) => {
        if (m.type === "video") {
          return `<div class="media-slide"><video src="${m.url}" controls preload="metadata"></video></div>`;
        }
        if (m.type === "pdf") {
          return `<div class="media-slide pdf-slide"><a class="pdf-open" href="${m.url}" target="_blank" rel="noopener">PDF'yi Aç</a></div>`;
        }
        return `<div class="media-slide"><img src="${m.url}" alt="${product.name}" loading="lazy" referrerpolicy="no-referrer" onerror="this.onerror=null;this.src='data:image/svg+xml;charset=UTF-8,%3Csvg%20xmlns='http://www.w3.org/2000/svg'%20width='600'%20height='400'%3E%3Crect%20width='100%25'%20height='100%25'%20fill='%23f2f2f2'/%3E%3Ctext%20x='50%25'%20y='50%25'%20dominant-baseline='middle'%20text-anchor='middle'%20fill='%23999'%20font-size='20'%20font-family='Arial'%3EG%C3%B6rsel%20yok%3C/text%3E%3C/svg%3E';" /></div>`;
      }).join("");

      mediaHtml = `
        <div class="card-img">
          <div class="media-slider" aria-label="Ürün medyası">
            ${slides}
          </div>
        </div>`;
    }

    const card = document.createElement("div");
    card.className = "card";
    card.innerHTML = `
      ${mediaHtml}
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
      const id = btn.getAttribute("data-add-to-cart");
      handleAddToCart(id, btn);
    });
  });
}

// ---------------- VİTRİN ----------------

function renderFeatured() {
  const container = document.getElementById("featured-products");
  if (!container) return;

  container.innerHTML = "";

  let featured = PRODUCTS.filter((p) => p.featured);
  if (!featured.length) {
    // hiç vitrin işaretli yoksa, son eklenenlerden 3 tane göster
    featured = PRODUCTS.slice(-3);
  }

  if (!featured.length) {
    container.innerHTML = "<p>Şu anda vitrin ürünü bulunmuyor.</p>";
    return;
  }

  featured.forEach((product) => {
    // Featured/Vitrin kartlarında da Drive linklerini görüntülenebilir URL'lere normalize et
    const mediaItems = Array.isArray(product.media) && product.media.length
      ? normalizeMediaArray(product.media)
      : (product.imageUrl
          ? [{
              type: (String(product.imageUrl).toLowerCase().includes('.pdf') ? 'pdf' : 'image'),
              url: normalizeMediaUrl(
                product.imageUrl,
                (String(product.imageUrl).toLowerCase().includes('.pdf') ? 'pdf' : 'image')
              )
            }]
          : []);

    let mediaHtml = `<div class="card-img placeholder">Ürün Görseli</div>`;
    if (mediaItems.length === 1) {
      const m = mediaItems[0];
      if (m.type === 'video') {
        mediaHtml = `<div class="card-img"><video src="${m.url}" controls preload="metadata"></video></div>`;
      } else if (m.type === 'pdf') {
        mediaHtml = `<div class="card-img pdf-icon"><a class="pdf-open" href="${m.url}" target="_blank" rel="noopener">PDF'yi Aç</a></div>`;
      } else {
        mediaHtml = `<div class="card-img"><img src="${m.url}" alt="${product.name}" loading="lazy" referrerpolicy="no-referrer" onerror="this.onerror=null;this.src='data:image/svg+xml;charset=UTF-8,%3Csvg%20xmlns='http://www.w3.org/2000/svg'%20width='600'%20height='400'%3E%3Crect%20width='100%25'%20height='100%25'%20fill='%23f2f2f2'/%3E%3Ctext%20x='50%25'%20y='50%25'%20dominant-baseline='middle'%20text-anchor='middle'%20fill='%23999'%20font-size='20'%20font-family='Arial'%3EG%C3%B6rsel%20yok%3C/text%3E%3C/svg%3E';" /></div>`;
      }
    } else if (mediaItems.length > 1) {
      const slides = mediaItems.map((m) => {
        if (m.type === 'video') return `<div class="media-slide"><video src="${m.url}" controls preload="metadata"></video></div>`;
        if (m.type === 'pdf') return `<div class="media-slide pdf-slide"><a class="pdf-open" href="${m.url}" target="_blank" rel="noopener">PDF'yi Aç</a></div>`;
        return `<div class="media-slide"><img src="${m.url}" alt="${product.name}" loading="lazy" referrerpolicy="no-referrer" onerror="this.onerror=null;this.src='data:image/svg+xml;charset=UTF-8,%3Csvg%20xmlns='http://www.w3.org/2000/svg'%20width='600'%20height='400'%3E%3Crect%20width='100%25'%20height='100%25'%20fill='%23f2f2f2'/%3E%3Ctext%20x='50%25'%20y='50%25'%20dominant-baseline='middle'%20text-anchor='middle'%20fill='%23999'%20font-size='20'%20font-family='Arial'%3EG%C3%B6rsel%20yok%3C/text%3E%3C/svg%3E';" /></div>`;
      }).join('');
      mediaHtml = `<div class="card-img"><div class="media-slider" aria-label="Ürün medyası">${slides}</div></div>`;
    }

    const card = document.createElement("div");
    card.className = "card";
    card.innerHTML = `
      ${mediaHtml}
      <div class="card-body">
        <h3>${product.name}</h3>
        <p>${product.description}</p>
        <div class="price">${product.price} TL</div>
        <button class="btn-primary" data-add-to-cart="${product.id}">
          Sepete Ekle
        </button>
      </div>
    `;
    container.appendChild(card);
  });

  container.querySelectorAll("[data-add-to-cart]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const id = btn.getAttribute("data-add-to-cart");
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

  // Bind once (event delegation) so +/- never breaks after rerender
  if (!container.dataset.bound) {
    container.dataset.bound = "1";
    container.addEventListener("click", (e) => {
      const incBtn = e.target.closest("[data-qty-inc]");
      const decBtn = e.target.closest("[data-qty-dec]");
      const rmBtn = e.target.closest("[data-remove-from-cart]");

      if (incBtn) {
        const id = incBtn.getAttribute("data-qty-inc");
        adjustCartItem(id, +1);
        return;
      }
      if (decBtn) {
        const id = decBtn.getAttribute("data-qty-dec");
        adjustCartItem(id, -1);
        return;
      }
      if (rmBtn) {
        const id = rmBtn.getAttribute("data-remove-from-cart");
        setCartItemQty(id, 0);
        return;
      }
    });
  }

  if (!cart.length) {
    container.innerHTML = `<p class="empty-cart">Sepetiniz boş.</p>`;
    if (subEl) subEl.textContent = "0 TL";
    if (totalEl) totalEl.textContent = "0 TL";
    if (warningEl) warningEl.textContent = "";
    updateCartProgress(0);
    updateCartCount();
    return;
  }

  container.innerHTML = "";
  let subtotal = 0;

  cart.forEach((item) => {
    const product = PRODUCTS.find((p) => p.id === item.id) || null;

    const name = (product?.name ?? item.name ?? "").toString() || "Ürün";
    const price = Number(product?.price ?? item.price ?? 0);
    const qty = Number(item.qty || 0);

    const imgUrlRaw = product?.imageUrl ?? item.imageUrl ?? "";
    const imgUrl = normalizeMediaUrl(imgUrlRaw, "image");

    const lineTotal = price * qty;
    subtotal += lineTotal;

    const row = document.createElement("div");
    row.className = "cart-item";
    row.innerHTML = `
      <div class="cart-item-left">
        <div class="cart-item-thumb">
          <img src="${imgUrl}" alt="${name}" loading="lazy" referrerpolicy="no-referrer"
               onerror="this.onerror=null;this.src='data:image/svg+xml;charset=UTF-8,%3Csvg%20xmlns='http://www.w3.org/2000/svg'%20width='600'%20height='400'%3E%3Crect%20width='100%25'%20height='100%25'%20fill='%23f2f2f2'/%3E%3Ctext%20x='50%25'%20y='50%25'%20dominant-baseline='middle'%20text-anchor='middle'%20fill='%23999'%20font-size='20'%20font-family='Arial'%3EG%C3%B6rsel%20yok%3C/text%3E%3C/svg%3E';" />
        </div>
        <div class="cart-item-info">
          <h4>${name}</h4>
          <p>${price} TL</p>
        </div>
      </div>

      <div class="cart-item-actions">
        <div class="cart-qty">
          <button class="qty-btn" data-qty-dec="${item.id}" aria-label="Azalt">−</button>
          <span class="qty-val">${qty}</span>
          <button class="qty-btn" data-qty-inc="${item.id}" aria-label="Arttır">+</button>
        </div>
        <span class="cart-item-total">${lineTotal.toFixed(2)} TL</span>
        <button class="btn-link" data-remove-from-cart="${item.id}">Kaldır</button>
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
      warningEl.textContent = "Sepet tutarınız minimum limiti geçti, sipariş verebilirsiniz.";
    } else {
      warningEl.textContent = "";
    }
  }

  updateCartProgress(subtotal);
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

  // Profil dropdown (her zaman aç/kapa, tek sefer bağla)
  const userBtn = document.querySelector(".nav-user-button");
  const dropdown = document.querySelector(".nav-auth-user .nav-user-dropdown");
  if (userBtn && dropdown && !userBtn.dataset.bound) {
    userBtn.dataset.bound = "1";

    userBtn.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();
      dropdown.classList.toggle("open");
    });

    dropdown.addEventListener("click", (e) => e.stopPropagation());

    document.addEventListener("click", (e) => {
      if (!dropdown.contains(e.target) && !userBtn.contains(e.target)) {
        dropdown.classList.remove("open");
      }
    });
  }

  // Logout
  document.querySelectorAll("#logout-btn, .nav-user-logout").forEach((logoutBtn) => {
    logoutBtn.addEventListener("click", async () => {
      try {
        await signOut(auth);
      } catch (err) {
        console.error(err);
      }
    });
  });

  updateCartCount();
  updateNavbarForAuth(currentUser);
}

function updateNavbarForAuth(user) {
  const guests = document.querySelectorAll(".nav-auth-guest");
  const userBoxes = document.querySelectorAll(".nav-auth-user");

  const mobileLogin = document.querySelectorAll(".nav-mobile-login");
  const mobileSignup = document.querySelectorAll(".nav-signup-mobile");

  const adminLinks = document.querySelectorAll(".nav-admin-link");
  const adminLinksMobile = document.querySelectorAll(".nav-admin-link-mobile");
  const sellerPanelLinks = document.querySelectorAll(".nav-seller-panel, .nav-seller-panel-dd, .nav-seller-panel-link");
  const sellerPanelMobile = document.querySelectorAll(".nav-seller-panel-mobile");
  const sellerCta = document.querySelectorAll(".nav-seller, .nav-seller-mobile");

  if (!guests.length || !userBoxes.length) return;

  const setTextAll = (selector, value) => {
    document.querySelectorAll(selector).forEach((el) => {
      if (el) el.textContent = value;
    });
  };

  if (user) {
    const displayName = user.displayName || (user.email ? user.email.split("@")[0] : "Kullanıcı");
    const firstLetter = (displayName || "K").charAt(0).toUpperCase();

    setTextAll("#nav-user-name", displayName);
    setTextAll("#nav-user-name-big", displayName);
    setTextAll("#nav-user-avatar", firstLetter);
    setTextAll("#nav-user-avatar-big", firstLetter);
    if (user.email) setTextAll("#nav-user-email", user.email);

    guests.forEach((g) => (g.style.display = "none"));
    userBoxes.forEach((u) => (u.style.display = "flex"));

    mobileLogin.forEach((a) => (a.style.display = "none"));
    mobileSignup.forEach((a) => (a.style.display = "none"));

    // Girişliyken Satıcı Ol CTA gizlensin
    sellerCta.forEach((a) => (a.style.display = "none"));

    const isAdmin = currentUserRole === "admin";
    const isSeller = currentUserRole === "seller" || isAdmin;

    adminLinks.forEach((a) => (a.style.display = isAdmin ? "" : "none"));
    adminLinksMobile.forEach((a) => (a.style.display = isAdmin ? "" : "none"));

    sellerPanelLinks.forEach((a) => (a.style.display = isSeller ? "" : "none"));
    sellerPanelMobile.forEach((a) => (a.style.display = isSeller ? "" : "none"));
  } else {
    guests.forEach((g) => (g.style.display = "flex"));
    userBoxes.forEach((u) => (u.style.display = "none"));

    mobileLogin.forEach((a) => (a.style.display = ""));
    mobileSignup.forEach((a) => (a.style.display = ""));

    // Misafirken Satıcı Ol CTA görünsün
    sellerCta.forEach((a) => (a.style.display = ""));

    adminLinks.forEach((a) => (a.style.display = "none"));
    adminLinksMobile.forEach((a) => (a.style.display = "none"));
    sellerPanelLinks.forEach((a) => (a.style.display = "none"));
    sellerPanelMobile.forEach((a) => (a.style.display = "none"));
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

// ---------------- SATICI PANELİ ----------------

async function setupSellerPanel() {
  if (sellerPanelInitialized) return;
  const panel = document.getElementById("seller-panel");
  if (!panel) return;
  sellerPanelInitialized = true;

  // Sadece seller veya admin girebilsin
  const ok = await requireRole(["seller", "admin"]);
  if (!ok) return;

  const form = document.getElementById("seller-product-form");
  const msg = document.getElementById("seller-form-message");
  const list = document.getElementById("seller-product-list");

  // === ÜRÜN BAŞVURU FORMU ===
  if (form && msg) {
    form.addEventListener("submit", async (e) => {
      e.preventDefault();

      const title = document.getElementById("sp-title").value.trim();
      const price = Number(document.getElementById("sp-price").value);
      const cat = (document.getElementById("sp-category").value || "").trim();
      
      const desc = document.getElementById("sp-description").value.trim();

      // Drive link inputs (ana medya zorunlu, diğerleri opsiyonel)
      const driveImgInput = document.getElementById("driveImageLink");
      const driveImgTypeEl = document.getElementById("driveImageType");
      const driveImg2Input = document.getElementById("driveSecondImageLink");
      const driveVidInput = document.getElementById("driveVideoLink");

      const imgRaw = driveImgInput ? String(driveImgInput.value || "").trim() : "";
      const imgTypeSel = driveImgTypeEl ? driveImgTypeEl.value : "image"; // image | pdf
      const img2Raw = driveImg2Input ? String(driveImg2Input.value || "").trim() : "";
      const vidRaw = driveVidInput ? String(driveVidInput.value || "").trim() : "";

      // Basit URL uzantı kontrolü (Drive linkleri uzantı taşımaz: Drive ise uzantı aramayız)
      const hasAllowedExt = (url, allowedExts) => {
        const s = String(url || "").trim().toLowerCase();
        if (!s) return false;
        const clean = s.split("?")[0].split("#")[0];
        return allowedExts.some((ext) => clean.endsWith("." + ext));
      };

      const isDrive = (raw) => !!extractDriveId(raw);

      // Zorunlu alanlar
      if (!title || !desc || !cat || isNaN(price) || price <= 0 || !imgRaw) {
        msg.textContent = "Lütfen tüm alanları doldurun ve Drive Görsel/PDF Linki (Zorunlu) alanına bir Drive paylaşım linki veya fileId girin.";
        msg.style.color = "red";
        return;
      }

      if (!ALLOWED_CATEGORIES.includes(cat)) {
        msg.textContent = "Lütfen geçerli bir kategori seçiniz: " + ALLOWED_CATEGORIES.map(c=>CATEGORY_LABELS[c]||c).join(", ");
        msg.style.color = "red";
        return;
      }

      // Ana medya doğrulama: Drive ise kabul; Drive değilse seçilen türe göre uzantı zorunlu
      if (isDrive(imgRaw)) {
        // ok
      } else if (imgTypeSel === "pdf") {
        if (!hasAllowedExt(imgRaw, ["pdf"])) {
          msg.textContent = "Ana medya PDF seçildi. Drive linki/fileId girin veya .pdf uzantılı bir bağlantı girin.";
          msg.style.color = "red";
          return;
        }
      } else {
        if (!hasAllowedExt(imgRaw, ["jpg", "jpeg", "png"])) {
          msg.textContent = "Ana medya görsel seçildi. Drive linki/fileId girin veya .jpg/.jpeg/.png uzantılı bir bağlantı girin.";
          msg.style.color = "red";
          return;
        }
      }

      // Opsiyonel 2. görsel: Drive veya .jpg/.jpeg/.png
      if (img2Raw) {
        if (isDrive(img2Raw)) {
          // ok
        } else if (!hasAllowedExt(img2Raw, ["jpg", "jpeg", "png"])) {
          msg.textContent = "İkinci görsel için Drive linki/fileId girin veya .jpg/.jpeg/.png uzantılı bir bağlantı girin.";
          msg.style.color = "red";
          return;
        }
      }

      // Opsiyonel video: Drive veya mp4/webm/mov/m4v
      if (vidRaw) {
        if (isDrive(vidRaw)) {
          // ok
        } else if (!hasAllowedExt(vidRaw, ["mp4", "webm", "mov", "m4v"])) {
          msg.textContent = "Video için Drive linki/fileId girin veya .mp4/.webm/.mov/.m4v uzantılı bir bağlantı girin.";
          msg.style.color = "red";
          return;
        }
      }

      msg.style.color = "black";
      msg.textContent = "Ürün başvurunuz kaydediliyor...";
msg.style.color = "black";
      msg.textContent = "Ürün başvurunuz kaydediliyor...";

      try {
        // 1) Dosyaları Drive'a SEN yüklüyorsun: burada sadece link/fileId alıyoruz

        const imgRaw = driveImgInput ? driveImgInput.value : "";
        const imgTypeSel = driveImgTypeEl ? driveImgTypeEl.value : "image";
        const imgId = extractDriveId(imgRaw);

        if (!imgId) {
          msg.textContent = "Drive görsel/PDF linki geçersiz. Lütfen Drive paylaşım linki veya fileId girin.";
          msg.style.color = "red";
          return;
        }

        // Zorunlu ana medya
        const imageUrl = driveDirectUrl(imgId, imgTypeSel);

        // Opsiyonel 2. görsel
        const img2Raw = driveImg2Input ? driveImg2Input.value : "";
        const img2Id = extractDriveId(img2Raw);
        const imageUrl2 = img2Id ? driveDirectUrl(img2Id, "image") : "";

        // Opsiyonel video
        const vidRaw = driveVidInput ? driveVidInput.value : "";
        const vidId = extractDriveId(vidRaw);
        const videoUrl = vidId ? driveDirectUrl(vidId, "video") : "";

        msg.style.color = "black";
        msg.textContent = "Ürün başvurunuz kaydediliyor...";

        const media = [];

        media.push({ type: (imgTypeSel==="pdf" ? "pdf" : "image"), url: imageUrl, name: imgId });
        if (imageUrl2) media.push({ type: "image", url: imageUrl2, name: img2Id });
        if (videoUrl) media.push({ type: "video", url: videoUrl, name: vidId });

// 🔥 Artık db.collection değil, addDoc + collection(db, "productRequests")
        await addDoc(collection(db, "productRequests"), {
          sellerId: currentUser.uid,
          title,
          price,
          category: cat,
          imageUrl, // geriye dönük uyumluluk
          media,
          description: desc,
          status: "pending",
          createdAt: serverTimestamp()
        });

        msg.style.color = "green";
        msg.textContent =
          "Ürün başvurunuz alındı. Yönetici onayı sonrası yayına alınacaktır.";
        form.reset();
      } catch (e2) {
        console.error(e2);
        msg.style.color = "red";
        msg.textContent =
          "Ürün başvurusu kaydedilirken bir hata oluştu: " +
          (e2.message || e2);
      }
    });
  }

  // === SATICININ KENDİ BAŞVURULARI LİSTESİ ===
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



// ---------------- BAKIM MODU (MAINTENANCE) ----------------
const MAINT_REF = doc(db, "siteSettings", "maintenance");
let maintenanceState = { enabled: false, startAt: null };
let maintenanceTick = null;

// ---------------- PAKETLEMEMİZ VİDEOLARI ----------------
// Public sayfa: packaging.html
// Admin ekleme: admin.html
const PACKAGING_COL = collection(db, "packagingVideos");

function driveVideoEmbedUrl(raw) {
  const id = extractDriveId(raw);
  if (id) return `https://drive.google.com/file/d/${id}/preview`;
  return String(raw || "").trim();
}

function renderPackagingVideos(container, items) {
  if (!container) return;
  if (!items.length) {
    container.innerHTML = "<p>Henüz video eklenmemiş.</p>";
    return;
  }

  container.innerHTML = items
    .map((v) => {
      const title = v.title ? String(v.title) : "Video";
      const embed = driveVideoEmbedUrl(v.url || v.link || v.driveLink || "");
      const created = v.createdAt ? "" : "";
      return `
        <div class="card packaging-card">
          <div class="card-img packaging-video">
            <iframe src="${embed}" allow="autoplay" loading="lazy" referrerpolicy="no-referrer"></iframe>
          </div>
          <div class="card-body">
            <h3>${title}</h3>
          </div>
        </div>
      `;
    })
    .join("");
}

function setupPackagingPage() {
  const container = document.getElementById("packaging-videos");
  if (!container) return;

  // Herkese açık liste
  onSnapshot(
    PACKAGING_COL,
    (snap) => {
      const items = [];
      snap.forEach((d) => items.push({ id: d.id, ...d.data() }));
      // En yeni üstte
      items.sort((a, b) => {
        const ta = a.createdAt?.toMillis?.() ?? a.createdAt ?? 0;
        const tb = b.createdAt?.toMillis?.() ?? b.createdAt ?? 0;
        return tb - ta;
      });
      renderPackagingVideos(container, items);
    },
    () => {
      container.innerHTML = "<p>Videolar yüklenirken bir hata oluştu.</p>";
    }
  );
}

function ensureMaintenanceBanner() {
  let banner = document.getElementById("maintenance-banner");
  if (!banner) {
    banner = document.createElement("div");
    banner.id = "maintenance-banner";
    banner.className = "maintenance-banner";
    banner.style.display = "none";
    const header = document.querySelector(".site-header");
    if (header && header.parentNode) {
      header.parentNode.insertBefore(banner, header.nextSibling);
    } else {
      document.body.insertBefore(banner, document.body.firstChild);
    }
  }
  return banner;
}

function pad2(n) { return String(n).padStart(2, "0"); }
function formatCountdown(ms) {
  const totalSec = Math.max(0, Math.floor(ms / 1000));
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  return `${m}:${pad2(s)}`;
}

async function isCurrentUserAdmin() {
  if (!currentUser) return false;
  await refreshUserRole();
  return currentUserRole === "admin";
}

function isAllowedDuringMaintenance() {
  const page = (location.pathname.split("/").pop() || "").toLowerCase();
  return page === "login.html" || page === "login-shop.html";
}

async function enforceMaintenance() {
  const banner = ensureMaintenanceBanner();

  if (!maintenanceState.enabled || !maintenanceState.startAt) {
    banner.style.display = "none";
    return;
  }

  const now = Date.now();
  const startAt = Number(maintenanceState.startAt) || 0;
  const before = now < startAt;

  if (before) {
    banner.innerHTML = `⚠️ Planlı bakım başlıyor <span class="muted">(Kalan: ${formatCountdown(startAt - now)})</span>`;
    banner.style.display = "block";
    return;
  }

  banner.innerHTML = `🛠️ Site bakımda. Admin harici erişim kapalı.`;
  banner.style.display = "block";

  if (isAllowedDuringMaintenance()) return;

  if (!currentUser) {
    window.location.href = "login.html?maintenance=1";
    return;
  }

  const admin = await isCurrentUserAdmin();
  if (!admin) {
    try { await signOut(auth); } catch (e) {}
    window.location.href = "login.html?maintenance=1";
  }
}

function startMaintenanceTicker() {
  if (maintenanceTick) return;
  maintenanceTick = setInterval(() => {
    enforceMaintenance().catch(() => {});
  }, 1000);
}

function stopMaintenanceTicker() {
  if (maintenanceTick) {
    clearInterval(maintenanceTick);
    maintenanceTick = null;
  }
}

function setupMaintenanceMode() {
  ensureMaintenanceBanner();

  onSnapshot(
    MAINT_REF,
    (snap) => {
      const d = snap.exists() ? snap.data() : {};
      maintenanceState.enabled = !!d.enabled;
      maintenanceState.startAt = d.startAt ? (typeof d.startAt === "number" ? d.startAt : (d.startAt.toMillis?.() ?? null)) : null;

      if (maintenanceState.enabled && maintenanceState.startAt) startMaintenanceTicker();
      else stopMaintenanceTicker();

      enforceMaintenance().catch(() => {});
    },
    () => {
      stopMaintenanceTicker();
      const banner = ensureMaintenanceBanner();
      banner.style.display = "none";
    }
  );
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
  
  // --- Bakım Modu kontrolleri ---
  const maintStatus = document.getElementById("maintenance-status");
  const maintScheduleBtn = document.getElementById("maintenance-schedule");
  const maintEndBtn = document.getElementById("maintenance-end");

  // --- Paketlememiz video yönetimi ---
  const packTitle = document.getElementById("packaging-title");
  const packLink = document.getElementById("packaging-drive-link");
  const packAddBtn = document.getElementById("packaging-add");
  const packList = document.getElementById("packaging-admin-list");

  function renderMaintStatus(d) {
    if (!maintStatus) return;
    if (!d || !d.enabled || !d.startAt) {
      maintStatus.textContent = "Bakım modu kapalı.";
      return;
    }
    const startAt = typeof d.startAt === "number" ? d.startAt : (d.startAt.toMillis?.() ?? 0);
    const now = Date.now();
    if (now < startAt) {
      maintStatus.textContent = `Planlandı: ${new Date(startAt).toLocaleString("tr-TR")} (kalan ${formatCountdown(startAt - now)})`;
    } else {
      maintStatus.textContent = "Bakım AKTİF (admin harici erişim kapalı).";
    }
  }

  onSnapshot(MAINT_REF, (snap) => {
    renderMaintStatus(snap.exists() ? snap.data() : null);
  });

  if (maintScheduleBtn) {
    maintScheduleBtn.addEventListener("click", async () => {
      const startAt = Date.now() + 15 * 60 * 1000;
      await setDoc(MAINT_REF, { enabled: true, startAt, updatedAt: serverTimestamp(), scheduledBy: currentUser.uid }, { merge: true });
      alert("Bakım planlandı: 15 dakika sonra başlayacak.");
    });
  }

  if (maintEndBtn) {
    maintEndBtn.addEventListener("click", async () => {
      await setDoc(MAINT_REF, { enabled: false, startAt: null, updatedAt: serverTimestamp(), endedBy: currentUser.uid }, { merge: true });
      alert("Bakım modu kapatıldı.");
    });
  }

  // Paketlememiz: video ekle/sil
  if (packAddBtn && packLink) {
    packAddBtn.addEventListener("click", async () => {
      const title = (packTitle?.value || "").trim();
      const link = (packLink.value || "").trim();
      const id = extractDriveId(link);
      if (!id) {
        alert("Lütfen geçerli bir Google Drive video linki veya fileId girin.");
        return;
      }
      const embedUrl = `https://drive.google.com/file/d/${id}/preview`;
      try {
        await addDoc(PACKAGING_COL, {
          title: title || "Paketleme Videosu",
          driveLink: link,
          url: embedUrl,
          createdAt: serverTimestamp(),
          createdBy: currentUser.uid
        });
        packTitle && (packTitle.value = "");
        packLink.value = "";
        alert("Video eklendi.");
      } catch (e) {
        console.error(e);
        alert("Video eklenirken hata oluştu. Firebase rules kontrol edin.");
      }
    });
  }

  if (packList) {
    onSnapshot(
      PACKAGING_COL,
      (snap) => {
        if (snap.empty) {
          packList.innerHTML = "<p>Henüz video yok.</p>";
          return;
        }
        let html = '<table class="simple-table"><thead><tr><th>Başlık</th><th>Link</th><th>İşlem</th></tr></thead><tbody>';
        snap.forEach((d) => {
          const data = d.data();
          html += `<tr data-id="${d.id}">
            <td>${data.title || "-"}</td>
            <td style="font-size:0.85rem;max-width:320px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${data.driveLink || data.url || ""}</td>
            <td><button class="btn-secondary" data-action="pack-delete">Sil</button></td>
          </tr>`;
        });
        html += "</tbody></table>";
        packList.innerHTML = html;

        packList.querySelectorAll("button[data-action='pack-delete']").forEach((btn) => {
          btn.addEventListener("click", async () => {
            const tr = btn.closest("tr");
            const id = tr?.getAttribute("data-id");
            if (!id) return;
            if (!confirm("Bu videoyu silmek istiyor musunuz?")) return;
            try {
              await deleteDoc(doc(db, "packagingVideos", id));
            } catch (e) {
              console.error(e);
              alert("Silme sırasında hata oluştu. Rules kontrol edin.");
            }
          });
        });
      },
      () => {
        packList.innerHTML = "<p>Videolar yüklenirken hata oluştu.</p>";
      }
    );
  }

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
                imageUrl: d.imageUrl || (Array.isArray(d.media) && d.media[0] ? d.media[0].url : ""),
                media: Array.isArray(d.media) ? d.media : (d.imageUrl ? [{ type: (String(d.imageUrl).toLowerCase().includes('.pdf') ? 'pdf' : 'image'), url: d.imageUrl }] : []),
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
    const prodCol = collection(db, "products");
    onSnapshot(prodCol, (snap) => {
      if (snap.empty) {
        productsManageBox.innerHTML = "<p>Henüz onaylanmış ürün bulunmuyor.</p>";
        return;
      }
      let html =
        '<table class="simple-table"><thead><tr><th>Ürün</th><th>Fiyat (TL)</th><th>Kategori</th><th>Vitrin</th><th>İşlem</th></tr></thead><tbody>';
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
            <input type="checkbox" class="admin-prod-featured" ${d.featured ? "checked" : ""}>
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

            if (isNaN(price) || price < 0) {
              alert("Geçerli bir fiyat giriniz.");
              return;
            }
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
  try { setupMaintenanceMode(); } catch(e) {}

  initTheme();

    // Navbar/Footer artık sayfalara gömülü: sadece etkileşimleri bağla
  setupNavbar();
  applyTheme(localStorage.getItem(THEME_KEY) || "light");


  // Ürünleri Firestore'dan dinamik yükle
  loadProductsFromFirestore();

  // Paketlememiz sayfası
  setupPackagingPage();

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
          "Siparişi tamamlamak için e-posta adresinizi doğrulamanız gerekiyor. Profil > Güvenlik bölümünden doğrulama maili gönderebilirsiniz."
        );
        window.location.href = "profile.html#security";
        return;
      }

      const phone = "905425029440";
      const message = encodeURIComponent(buildWhatsAppOrderMessage(subtotal));
      window.location.href = `https://wa.me/${phone}?text=${message}`;
    });
  }

  setupProfilePage();
  setupSellerRequest();
});



