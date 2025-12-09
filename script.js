// script.js  (ES module)

// Firebase
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.13.1/firebase-app.js";
import {
  getAuth,
  onAuthStateChanged,
  signOut,
  sendPasswordResetEmail
} from "https://www.gstatic.com/firebasejs/10.13.1/firebase-auth.js";

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

let currentUser = null;

// Örnek ürün verisi (ileride Firestore'a taşınabilir)
const PRODUCTS = [
  {
    id: 1,
    name: "El Örgüsü Atkı",
    price: 150,
    category: "Giyim",
    description: "Tamamen yün, el yapımı sıcak atkı."
  },
  {
    id: 2,
    name: "Ahşap Kalemlik",
    price: 85,
    category: "Dekorasyon",
    description: "Doğal ahşaptan oyma masaüstü kalemlik."
  },
  {
    id: 3,
    name: "Deri Cüzdan",
    price: 250,
    category: "Aksesuar",
    description: "Gerçek deri, el dikimi minimalist cüzdan."
  }
];

// ---------------- TEMA YÖNETİMİ ----------------

const THEME_KEY = "ogrencify_theme";

function applyTheme(theme) {
  if (theme === "dark") {
    document.body.classList.add("theme-dark");
  } else {
    document.body.classList.remove("theme-dark");
  }
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

// ---------------- COMMON HELPERS ----------------

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

// Sepet verisini localStorage'da tut
const CART_KEY = "ogrencify_cart";

function getCart() {
  try {
    const raw = localStorage.getItem(CART_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch (e) {
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
    if (product) {
      subtotal += product.price * item.qty;
    }
  });
  return subtotal;
}

function updateCartProgress(subtotal) {
  const bar = document.getElementById("cart-progress-fill");
  if (!bar) return;
  const LIMIT = 400;
  const ratio = Math.max(0, Math.min(subtotal / LIMIT, 1));
  bar.style.width = `${(ratio * 100).toFixed(0)}%`;
  if (subtotal >= LIMIT) {
    bar.classList.add("full");
  } else {
    bar.classList.remove("full");
  }
}

function updateCartCount() {
  const count = getCartCount();
  const badgeEls = document.querySelectorAll("#cart-count, .cart-count");
  badgeEls.forEach((el) => {
    el.textContent = count;
  });

  const subtotal = getCartSubtotal();
  updateCartProgress(subtotal);
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
}

// ---------------- ÜRÜNLER ----------------

function handleAddToCart(productId, buttonEl) {
  // giriş yoksa özel login sayfasına
  if (!currentUser) {
    window.location.href = "login-shop.html";
    return;
  }

  addToCart(productId);

  // 10 saniyelik görsel uyarı
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
  const query = searchBox ? searchBox.value.trim().toLowerCase() : "";

  listEl.innerHTML = "";

  PRODUCTS.filter((p) => {
    if (!query) return true;
    return (
      p.name.toLowerCase().includes(query) ||
      p.description.toLowerCase().includes(query) ||
      (p.category || "").toLowerCase().includes(query)
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
  updateCartProgress(subtotal);
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
  } else {
    guest.style.display = "flex";
    userBox.style.display = "none";

    if (mobileLogin) mobileLogin.style.display = "";
    if (mobileSignup) mobileSignup.style.display = "";
  }
}

// PROFİL SAYFASI İÇİN: e-posta ve şifre reset

function updateProfilePageUser(user) {
  const emailSpan = document.getElementById("profile-email");
  if (!emailSpan) return;
  if (user && user.email) {
    emailSpan.textContent = user.email;
  } else {
    emailSpan.textContent = "- (Giriş yapılmamış)";
  }
}

function setupProfilePage() {
  // Tema butonu
  const themeToggle = document.getElementById("theme-toggle");
  if (themeToggle) {
    themeToggle.addEventListener("click", () => {
      const isDark = document.body.classList.contains("theme-dark");
      const next = isDark ? "light" : "dark";
      applyTheme(next);
    });
  }

  // Şifre sıfırlama
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
          "Şifre sıfırlama bağlantısı e-posta adresinize gönderildi. Lütfen mail kutunuzu kontrol edin.";
        msgBox.classList.add("success");
      } catch (err) {
        console.error(err);
        msgBox.textContent = "İşlem sırasında bir hata oluştu. Lütfen tekrar deneyin.";
        msgBox.classList.remove("success");
      }
    });
  }

  updateProfilePageUser(currentUser);
}

// ---------------- AUTH DURUMU ----------------

onAuthStateChanged(auth, (user) => {
  currentUser = user;
  updateNavbarForAuth(user);
  updateProfilePageUser(user);
});

// ---------------- DOM YÜKLENDİĞİNDE ----------------

document.addEventListener("DOMContentLoaded", () => {
  initTheme();

  loadPartial("navbar-placeholder", "navbar.html", () => {
    setupNavbar();
    // navbar yüklendikten sonra da tema buton yazısını güncelle
    applyTheme(localStorage.getItem(THEME_KEY) || "light");
  });
  loadPartial("footer-placeholder", "footer.html");

  const searchBox = document.getElementById("searchBox");
  if (searchBox) {
    searchBox.addEventListener("input", () => renderProducts());
  }
  renderProducts();

  renderCart();

  // Sepeti Onayla
  const checkoutBtn = document.getElementById("checkout-btn");
  if (checkoutBtn) {
    checkoutBtn.addEventListener("click", () => {
      const subtotal = getCartSubtotal();

      // Limit kontrolü
      if (subtotal < 400) {
        const warningEl = document.getElementById("limit-warning");
        if (warningEl) {
          warningEl.textContent =
            "Sepet tutarınız 400 TL altında. Siparişi tamamlamak için en az 400 TL'lik ürün eklemelisiniz.";
        }
        return;
      }

      // Giriş yoksa login sayfası
      if (!currentUser) {
        window.location.href = "login-shop.html";
        return;
      }

      // WhatsApp yönlendirme
      const phone = "905425029440"; // iletişim numarası
      const message = encodeURIComponent(
        `Merhaba, ÖğrenciFy üzerinden sipariş vermek istiyorum. Sepet tutarım: ${subtotal.toFixed(
          2
        )} TL`
      );
      window.location.href = `https://wa.me/${phone}?text=${message}`;
    });
  }

  // Profil sayfasında mıyız? (id'ler üzerinden anlarız)
  if (document.getElementById("appearance") || document.getElementById("security")) {
    setupProfilePage();
  }
});
