// script.js
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.13.1/firebase-app.js";
import { getAuth, onAuthStateChanged, signOut, sendPasswordResetEmail, sendEmailVerification } from "https://www.gstatic.com/firebasejs/10.13.1/firebase-auth.js";
import { getFirestore, doc, getDoc, collection, onSnapshot, query, where, addDoc, updateDoc, serverTimestamp, deleteDoc, setDoc } from "https://www.gstatic.com/firebasejs/10.13.1/firebase-firestore.js";

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
let PRODUCTS = [];

// --- BİLEŞEN YÜKLEME ---
function loadPartial(placeholderId, url, callback) {
  const container = document.getElementById(placeholderId);
  if (!container) return;
  fetch(url)
    .then((res) => res.text())
    .then((html) => {
      container.innerHTML = html;
      if (callback) callback();
    })
    .catch((err) => console.error(err));
}

// --- MENÜ KURULUMU ---
function setupNavbar() {
  const hamburger = document.querySelector(".hamburger");
  const mobileMenu = document.querySelector(".mobile-menu-container");

  if (hamburger && mobileMenu) {
    hamburger.addEventListener("click", () => {
      mobileMenu.classList.toggle("active");
      // Menü açıkken sayfanın kaymasını engellemek istersen:
      // document.body.style.overflow = mobileMenu.classList.contains("active") ? "hidden" : "auto";
    });

    // Menü dışına tıklanınca kapat
    document.addEventListener("click", (e) => {
      if (!mobileMenu.contains(e.target) && !hamburger.contains(e.target)) {
        mobileMenu.classList.remove("active");
      }
    });
  }
  
  updateNavbarForAuth(currentUser);
  updateCartCount();
}

function updateNavbarForAuth(user) {
  const desktopAuth = document.getElementById("desktop-auth");
  const mobileAuth = document.getElementById("mobile-auth");
  const userArea = document.getElementById("user-area");
  const nameSpan = document.getElementById("user-name-display");

  // Mobil Linkler
  const mobSeller = document.getElementById("mobile-seller-link");
  const mobAdmin = document.getElementById("mobile-admin-link");
  const mobLogout = document.getElementById("mobile-logout");
  
  // Dropdown Linkler
  const dropSeller = document.getElementById("menu-seller-link");
  const dropAdmin = document.getElementById("menu-admin-link");

  if (user) {
    // Giriş yapılmış
    if (desktopAuth) desktopAuth.style.display = "none";
    if (mobileAuth) mobileAuth.style.display = "none";
    if (userArea) userArea.style.display = "flex";
    if (mobLogout) mobLogout.style.display = "block";

    if (nameSpan) {
      nameSpan.textContent = user.displayName || user.email.split("@")[0];
    }

    // Rol Kontrolü
    const isSeller = currentUserRole === "seller" || currentUserRole === "admin";
    const isAdmin = currentUserRole === "admin";

    if(dropSeller) dropSeller.style.display = isSeller ? "block" : "none";
    if(mobSeller) mobSeller.style.display = isSeller ? "block" : "none";
    
    if(dropAdmin) dropAdmin.style.display = isAdmin ? "block" : "none";
    if(mobAdmin) mobAdmin.style.display = isAdmin ? "block" : "none";

  } else {
    // Giriş yapılmamış
    if (desktopAuth) desktopAuth.style.display = "flex";
    if (mobileAuth) mobileAuth.style.display = "flex"; // Mobilde dikey
    if (userArea) userArea.style.display = "none";
    
    if(mobSeller) mobSeller.style.display = "none";
    if(mobAdmin) mobAdmin.style.display = "none";
    if(mobLogout) mobLogout.style.display = "none";
  }
}

// --- ROL YÖNETİMİ ---
async function ensureUserDoc(user) {
  if (!user) return;
  const ref = doc(db, "users", user.uid);
  const snap = await getDoc(ref);
  if (snap.exists()) {
    currentUserRole = snap.data().role || "customer";
  } else {
    await setDoc(ref, { email: user.email, role: "customer", createdAt: serverTimestamp() });
    currentUserRole = "customer";
  }
  updateNavbarForAuth(user);
}

// --- SEPET MANTIĞI (Basitleştirilmiş) ---
function getCart() {
  return JSON.parse(localStorage.getItem("ogrencify_cart")) || [];
}
function updateCartCount() {
  const count = getCart().reduce((sum, item) => sum + item.qty, 0);
  const badge = document.getElementById("cart-count");
  if (badge) badge.textContent = count;
}
window.addToCart = function(productId) {
  const cart = getCart();
  const existing = cart.find(i => i.id === productId);
  if(existing) existing.qty++; else cart.push({id: productId, qty: 1});
  localStorage.setItem("ogrencify_cart", JSON.stringify(cart));
  updateCartCount();
  alert("Ürün sepete eklendi!");
}

// --- ÜRÜNLERİ ÇEK ---
function loadProducts() {
  onSnapshot(collection(db, "products"), (snap) => {
    PRODUCTS = [];
    snap.forEach(d => PRODUCTS.push({id: d.id, ...d.data()}));
    
    // Sayfaya göre render
    if(document.getElementById("featured-products")) renderFeatured();
    if(document.getElementById("product-list")) renderAllProducts();
  });
}

function renderFeatured() {
  const container = document.getElementById("featured-products");
  if(!container) return;
  container.innerHTML = "";
  // Sadece featured olanlar veya son 4 ürün
  const list = PRODUCTS.filter(p => p.featured).slice(0,4);
  
  list.forEach(p => container.appendChild(createProductCard(p)));
}

function renderAllProducts() {
  const container = document.getElementById("product-list");
  if(!container) return;
  container.innerHTML = "";
  
  // URL parametresine göre filtreleme (örn: products.html?cat=ev)
  const urlParams = new URLSearchParams(window.location.search);
  const catFilter = urlParams.get('cat');
  
  let list = PRODUCTS;
  if(catFilter) {
    list = list.filter(p => p.category && p.category.toLowerCase().includes(catFilter));
  }

  list.forEach(p => container.appendChild(createProductCard(p)));
}

function createProductCard(p) {
  const card = document.createElement("div");
  card.className = "card";
  const imgHtml = p.imageUrl ? `<img src="${p.imageUrl}" alt="${p.title}">` : "Görsel Yok";
  card.innerHTML = `
    <div class="card-img">${imgHtml}</div>
    <div class="card-body">
      <h3>${p.title}</h3>
      <div class="price">${p.price} TL</div>
      <button class="btn-primary" onclick="addToCart('${p.id}')" style="width:100%; margin-top:10px;">Sepete Ekle</button>
    </div>
  `;
  return card;
}

// --- AUTH STATE ---
onAuthStateChanged(auth, async (user) => {
  currentUser = user;
  await ensureUserDoc(user);
});

// --- INIT ---
document.addEventListener("DOMContentLoaded", () => {
  loadPartial("navbar-placeholder", "navbar.html", setupNavbar);
  loadPartial("footer-placeholder", "footer.html");
  loadProducts();
});

// Çıkış Fonksiyonu (Global)
window.logoutUser = async () => {
  await signOut(auth);
  window.location.href = "index.html";
};
