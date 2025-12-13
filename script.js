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
let adminInitialized = false;
let sellerInitialized = false;

// --- 1. YARDIMCI FONKSİYONLAR ---

// HTML Parçalarını Yükle (Navbar/Footer)
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

// URL Parametresi Al
function getQueryParam(param) {
  const urlParams = new URLSearchParams(window.location.search);
  return urlParams.get(param);
}

// --- 2. MENÜ VE AUTH YÖNETİMİ ---

function setupNavbar() {
  const hamburger = document.querySelector(".hamburger");
  const mobileMenu = document.querySelector(".mobile-menu-container");

  if (hamburger && mobileMenu) {
    hamburger.addEventListener("click", () => {
      mobileMenu.classList.toggle("active");
    });
    document.addEventListener("click", (e) => {
      if (!mobileMenu.contains(e.target) && !hamburger.contains(e.target)) {
        mobileMenu.classList.remove("active");
      }
    });
  }
  
  // Arama Kutusu (Enter tuşu desteği)
  const searchInput = document.getElementById("global-search");
  if(searchInput) {
      searchInput.addEventListener("keypress", (e) => {
          if (e.key === "Enter") {
             window.location.href = `products.html?search=${encodeURIComponent(searchInput.value)}`;
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
    if (desktopAuth) desktopAuth.style.display = "none";
    if (mobileAuth) mobileAuth.style.display = "none";
    if (userArea) userArea.style.display = "flex";
    if (mobLogout) mobLogout.style.display = "block";

    if (nameSpan) {
      nameSpan.textContent = user.displayName || user.email.split("@")[0];
    }

    const isSeller = currentUserRole === "seller" || currentUserRole === "admin";
    const isAdmin = currentUserRole === "admin";

    if(dropSeller) dropSeller.style.display = isSeller ? "block" : "none";
    if(mobSeller) mobSeller.style.display = isSeller ? "block" : "none";
    
    if(dropAdmin) dropAdmin.style.display = isAdmin ? "block" : "none";
    if(mobAdmin) mobAdmin.style.display = isAdmin ? "block" : "none";

  } else {
    if (desktopAuth) desktopAuth.style.display = "flex";
    if (mobileAuth) mobileAuth.style.display = "flex";
    if (userArea) userArea.style.display = "none";
    
    if(mobSeller) mobSeller.style.display = "none";
    if(mobAdmin) mobAdmin.style.display = "none";
    if(mobLogout) mobLogout.style.display = "none";
  }
}

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

// --- 3. SEPET (CART) MANTIĞI ---

function getCart() {
  return JSON.parse(localStorage.getItem("ogrencify_cart")) || [];
}

function saveCart(cart) {
  localStorage.setItem("ogrencify_cart", JSON.stringify(cart));
  updateCartCount();
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
  saveCart(cart);
  alert("Ürün sepete eklendi!");
}

// Sepet Sayfasını Render Et (cart.html için)
function renderCartPage() {
  const container = document.getElementById("cart-items-container");
  if (!container) return; // Sepet sayfasında değilsek çık

  const cart = getCart();
  const totalEl = document.getElementById("total-price");
  const warningEl = document.getElementById("limit-warning");
  
  if (cart.length === 0) {
    container.innerHTML = "<p>Sepetiniz boş.</p>";
    if(totalEl) totalEl.textContent = "0 TL";
    if(warningEl) warningEl.textContent = "";
    return;
  }

  // Ürün detaylarını Firestore verisinden (PRODUCTS) alacağız.
  // Eğer ürünler henüz yüklenmediyse, yüklenince tekrar çağrılır.
  if(PRODUCTS.length === 0) {
      container.innerHTML = "<p>Yükleniyor...</p>";
      return; 
  }

  container.innerHTML = "";
  let totalPrice = 0;

  cart.forEach((item, index) => {
    const product = PRODUCTS.find(p => p.id === item.id);
    if (!product) return;
    
    const lineTotal = product.price * item.qty;
    totalPrice += lineTotal;

    const row = document.createElement("div");
    row.className = "cart-item";
    row.innerHTML = `
      <div>
        <h4 style="margin:0;">${product.title}</h4>
        <p style="margin:0; font-size:0.9rem; color:#666;">${product.price} TL x ${item.qty}</p>
      </div>
      <div class="cart-item-actions">
         <span style="font-weight:bold;">${lineTotal.toFixed(2)} TL</span>
         <button class="btn-link" onclick="removeFromCart('${item.id}')">Kaldır</button>
      </div>
    `;
    container.appendChild(row);
  });

  if(totalEl) totalEl.textContent = totalPrice.toFixed(2) + " TL";
  
  if(warningEl) {
      if(totalPrice < 400) {
          warningEl.textContent = "Sepet tutarınız 400 TL altında. Minimum sipariş tutarı 400 TL'dir.";
          const btn = document.getElementById("checkout-btn");
          if(btn) { btn.disabled = true; btn.style.opacity = "0.5"; }
      } else {
          warningEl.textContent = "";
          const btn = document.getElementById("checkout-btn");
          if(btn) { btn.disabled = false; btn.style.opacity = "1"; }
      }
  }
}

window.removeFromCart = function(productId) {
    let cart = getCart();
    cart = cart.filter(item => item.id !== productId);
    saveCart(cart);
    renderCartPage(); // Sayfayı yenile
}

// Sepeti Onayla Butonu
function setupCheckout() {
    const btn = document.getElementById("checkout-btn");
    if(!btn) return;
    
    btn.addEventListener("click", () => {
        if(!currentUser) {
            window.location.href = "login-shop.html";
            return;
        }
        // WhatsApp Yönlendirmesi
        const cart = getCart();
        let msg = "Merhaba, sipariş vermek istiyorum.%0A";
        let total = 0;
        cart.forEach(item => {
             const p = PRODUCTS.find(prod => prod.id === item.id);
             if(p) {
                 msg += `- ${p.title} (${item.qty} adet) - ${p.price * item.qty} TL%0A`;
                 total += p.price * item.qty;
             }
        });
        msg += `%0AToplam: ${total} TL`;
        
        window.open(`https://wa.me/905425029440?text=${msg}`, '_blank');
    });
}


// --- 4. ÜRÜN YÖNETİMİ ---

function loadProducts() {
  onSnapshot(collection(db, "products"), (snap) => {
    PRODUCTS = [];
    snap.forEach(d => PRODUCTS.push({id: d.id, ...d.data()}));
    
    // Veri gelince sayfaları güncelle
    if(document.getElementById("featured-products")) renderFeatured();
    if(document.getElementById("product-list")) renderAllProducts();
    if(document.getElementById("cart-items-container")) renderCartPage();
  });
}

function renderFeatured() {
  const container = document.getElementById("featured-products");
  if(!container) return;
  container.innerHTML = "";
  // Sadece featured olanlar
  const list = PRODUCTS.filter(p => p.featured).slice(0,4);
  if(list.length === 0) container.innerHTML = "<p>Henüz vitrin ürünü yok.</p>";
  
  list.forEach(p => container.appendChild(createProductCard(p)));
}

function renderAllProducts() {
  const container = document.getElementById("product-list");
  if(!container) return;
  container.innerHTML = "";
  
  // URL Filtreleri
  const catFilter = getQueryParam('cat');
  const searchFilter = getQueryParam('search');
  
  let list = PRODUCTS;
  
  if(catFilter) {
    list = list.filter(p => p.category && p.category.toLowerCase().includes(catFilter.toLowerCase()));
  }
  
  if(searchFilter) {
      list = list.filter(p => p.title.toLowerCase().includes(searchFilter.toLowerCase()));
  }

  if(list.length === 0) container.innerHTML = "<p>Ürün bulunamadı.</p>";

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


// --- 5. ADMİN & SATICI & PROFİL PANELLERİ (Eksik olan kısımlar) ---

// Satıcı Başvurusu (seller.html)
function setupSellerRequest() {
    const btn = document.getElementById("request-seller-btn");
    const msg = document.getElementById("request-seller-message");
    if(!btn) return;
    
    btn.addEventListener("click", async () => {
        if(!currentUser) {
            msg.textContent = "Lütfen önce giriş yapın."; return;
        }
        try {
            await addDoc(collection(db, "sellerRequests"), {
                uid: currentUser.uid,
                email: currentUser.email,
                status: "pending",
                createdAt: serverTimestamp()
            });
            msg.textContent = "Başvurunuz alındı! Onay bekleniyor.";
            msg.style.color = "green";
        } catch(e) {
            console.error(e);
            msg.textContent = "Bir hata oluştu.";
        }
    });
}

// Profil Sayfası (profile.html)
function setupProfilePage() {
    const emailEl = document.getElementById("profile-email");
    if(!emailEl) return;
    
    if(currentUser) emailEl.textContent = currentUser.email;
    
    const resetBtn = document.getElementById("password-reset-btn");
    const msgBox = document.getElementById("profile-message");
    
    resetBtn.addEventListener("click", async () => {
        if(!currentUser) return;
        try {
            await sendPasswordResetEmail(auth, currentUser.email);
            msgBox.style.display = "block";
            msgBox.textContent = "Sıfırlama e-postası gönderildi.";
            msgBox.className = "message-box success";
        } catch(e) {
            msgBox.style.display = "block";
            msgBox.textContent = "Hata: " + e.message;
            msgBox.className = "message-box error";
        }
    });
}

// Satıcı Paneli (seller-dashboard.html)
async function setupSellerPanel() {
    const panel = document.getElementById("seller-panel");
    if(!panel || sellerInitialized) return;
    sellerInitialized = true;
    
    // Rol Kontrolü
    if(currentUserRole !== "seller" && currentUserRole !== "admin") {
        panel.innerHTML = "<p>Bu sayfayı görüntüleme yetkiniz yok.</p>";
        return;
    }
    
    // Ürün Ekleme Formu
    const form = document.getElementById("seller-product-form");
    const msg = document.getElementById("seller-form-message");
    
    if(form) {
        form.addEventListener("submit", async (e) => {
            e.preventDefault();
            const title = document.getElementById("sp-title").value;
            const price = Number(document.getElementById("sp-price").value);
            const cat = document.getElementById("sp-category").value;
            const desc = document.getElementById("sp-description").value;
            const img = document.getElementById("sp-image").value;
            
            try {
                await addDoc(collection(db, "productRequests"), {
                    sellerId: currentUser.uid,
                    title, price, category: cat, description: desc, imageUrl: img,
                    status: "pending", createdAt: serverTimestamp()
                });
                msg.textContent = "Ürün onaya gönderildi!";
                msg.style.color = "green";
                form.reset();
            } catch(err) {
                msg.textContent = "Hata oluştu.";
                msg.style.color = "red";
            }
        });
    }
    
    // Başvuruları Listele
    const list = document.getElementById("seller-product-list");
    if(list) {
        const q = query(collection(db, "productRequests"), where("sellerId", "==", currentUser.uid));
        onSnapshot(q, (snap) => {
            if(snap.empty) { list.innerHTML = "<p>Başvurunuz yok.</p>"; return; }
            let html = '<table class="simple-table"><thead><tr><th>Ürün</th><th>Durum</th></tr></thead><tbody>';
            snap.forEach(d => {
                const data = d.data();
                html += `<tr><td>${data.title}</td><td>${data.status}</td></tr>`;
            });
            html += '</tbody></table>';
            list.innerHTML = html;
        });
    }
}

// Admin Paneli (admin.html)
async function setupAdminPanel() {
    const panel = document.getElementById("admin-panel");
    if(!panel || adminInitialized) return;
    adminInitialized = true;

    if(currentUserRole !== "admin") {
        panel.innerHTML = "<p>Yetkiniz yok.</p>"; return;
    }

    // 1. Kullanıcılar
    const userList = document.getElementById("admin-users-list");
    if(userList) {
        onSnapshot(collection(db, "users"), (snap) => {
            let html = '<table class="simple-table"><thead><tr><th>Email</th><th>Rol</th><th>İşlem</th></tr></thead><tbody>';
            snap.forEach(docSnap => {
                const u = docSnap.data();
                html += `<tr>
                    <td>${u.email}</td>
                    <td>${u.role}</td>
                    <td><button onclick="changeRole('${docSnap.id}', 'seller')">Satıcı Yap</button></td>
                </tr>`;
            });
            html += "</tbody></table>";
            userList.innerHTML = html;
        });
    }

    // 2. Ürün Başvuruları (Onaylama)
    const prodReqList = document.getElementById("admin-product-requests");
    if(prodReqList) {
        const q = query(collection(db, "productRequests"), where("status", "==", "pending"));
        onSnapshot(q, (snap) => {
            if(snap.empty) { prodReqList.innerHTML = "<p>Bekleyen ürün yok.</p>"; return; }
            let html = '<table class="simple-table"><thead><tr><th>Ürün</th><th>Fiyat</th><th>İşlem</th></tr></thead><tbody>';
            snap.forEach(docSnap => {
                const p = docSnap.data();
                html += `<tr>
                    <td>${p.title}</td>
                    <td>${p.price}</td>
                    <td>
                        <button class="btn-secondary" onclick="approveProduct('${docSnap.id}')">Onayla</button>
                        <button class="btn-link" onclick="rejectProduct('${docSnap.id}')">Reddet</button>
                    </td>
                </tr>`;
            });
            html += "</tbody></table>";
            prodReqList.innerHTML = html;
        });
    }
}

// Admin Helper Fonksiyonları (Window'a atıyoruz ki HTML'den erişilsin)
window.approveProduct = async (reqId) => {
    const ref = doc(db, "productRequests", reqId);
    const snap = await getDoc(ref);
    if(snap.exists()) {
        const d = snap.data();
        // Gerçek ürünlere ekle
        await addDoc(collection(db, "products"), {
            ...d, featured: false, createdAt: serverTimestamp()
        });
        // İsteği güncelle
        await updateDoc(ref, { status: "approved" });
        alert("Ürün onaylandı ve yayına alındı.");
    }
}

window.rejectProduct = async (reqId) => {
    await updateDoc(doc(db, "productRequests", reqId), { status: "rejected" });
    alert("Ürün reddedildi.");
}

window.changeRole = async (uid, newRole) => {
    await updateDoc(doc(db, "users", uid), { role: newRole });
    alert("Kullanıcı rolü güncellendi.");
}


// --- 6. BAŞLATMA ---

onAuthStateChanged(auth, async (user) => {
  currentUser = user;
  await ensureUserDoc(user);
  
  // Auth durumu değişince panelleri tekrar kontrol et
  if(user) {
      setupProfilePage();
      setupSellerPanel();
      setupAdminPanel();
  }
});

document.addEventListener("DOMContentLoaded", () => {
  loadPartial("navbar-placeholder", "navbar.html", setupNavbar);
  loadPartial("footer-placeholder", "footer.html");
  
  loadProducts(); // Ürünleri çek
  setupSellerRequest(); // Satıcı ol butonu
  setupCheckout(); // Sepet onayı
});

// Çıkış
window.logoutUser = async () => {
  await signOut(auth);
  window.location.href = "index.html";
};
