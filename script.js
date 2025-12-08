// script.js
// - navbar.html ve footer.html'i yükler
// - ürün listesini doldurur
// - sepeti localStorage'da tutar

// -------- Ortak yardımcılar --------

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

function updateCartCount() {
  const count = getCartCount();
  const badgeEls = document.querySelectorAll("#cart-count, .cart-count");
  badgeEls.forEach((el) => {
    el.textContent = count;
  });
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
  alert("Ürün sepete eklendi.");
}

function removeFromCart(productId) {
  let cart = getCart();
  cart = cart.filter((item) => item.id !== productId);
  saveCart(cart);
  updateCartCount();
}

// -------- Ürünler --------

// Örnek ürün verisi – sonra Firestore'dan doldurulabilir
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
      addToCart(id);
    });
  });
}

// -------- Sepet görüntüleme --------

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

  // Örnek limit uyarısı
  if (warningEl) {
    warningEl.textContent =
      subtotal > 0 && subtotal < 100
        ? "100 TL altı siparişlerde bazı satıcılar ek kargo ücreti talep edebilir."
        : "";
  }

  container.querySelectorAll("[data-remove-from-cart]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const id = Number(btn.getAttribute("data-remove-from-cart"));
      removeFromCart(id);
      renderCart();
    });
  });

  updateCartCount();
}

// -------- Navbar etkileşimleri --------

function setupNavbar() {
  const toggle = document.querySelector(".nav-toggle");
  const mobileMenu = document.querySelector(".nav-mobile-menu");

  if (toggle && mobileMenu) {
    toggle.addEventListener("click", () => {
      mobileMenu.classList.toggle("open");
    });
  }

  updateCartCount();
}

// -------- Sayfa yüklenince --------

document.addEventListener("DOMContentLoaded", () => {
  loadPartial("navbar-placeholder", "navbar.html", setupNavbar);
  loadPartial("footer-placeholder", "footer.html");

  // Ürün listesi (index + products)
  const searchBox = document.getElementById("searchBox");
  if (searchBox) {
    searchBox.addEventListener("input", () => renderProducts());
  }
  renderProducts();

  // Sepet sayfası
  renderCart();

  // Sepeti onayla butonu
  const checkoutBtn = document.getElementById("checkout-btn");
  if (checkoutBtn) {
    checkoutBtn.addEventListener("click", () => {
      alert("Ödeme altyapısı eklendiğinde bu adım tamamlanacak.");
    });
  }
});
