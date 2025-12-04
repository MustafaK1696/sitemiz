// --- FIREBASE AYARLARI (Kendi proje bilgilerini buraya gir) ---
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getAuth, createUserWithEmailAndPassword, signInWithEmailAndPassword, onAuthStateChanged, signOut, sendEmailVerification, updateProfile } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { getFirestore, doc, setDoc, getDoc } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

// BURAYA FIREBASE PANELİNDEN ALDIĞIN CONFIG GELECEK
const firebaseConfig = {
    const firebaseConfig = {
    apiKey: "AIzaSyD2hTcFgZQXwBERXpOduwPnxOC8FcjsCR4",
    authDomain: "ogrencify.firebaseapp.com",
    projectId: "ogrencify",
    storageBucket: "ogrencify.firebasestorage.app",
    messagingSenderId: "467595249158",
    appId: "1:467595249158:web:55373baf2ee993bee3a587",
    measurementId: "G-VS0KGRBLN0"
};

// Firebase Başlat
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const analytics = getAnalytics(app);

// --- ÜRÜN VERİLERİ ---
const products = [
    { id: 1, name: "El Örgüsü Atkı", price: 150, category: "giyim", description: "Kışlık yün örgü." },
    { id: 2, name: "Tasarım Çanta", price: 60, category: "giyim", description: "Minimalist baskılı." },
    { id: 3, name: "Ahşap Kalemlik", price: 85, category: "hediyelik", description: "Doğal ahşap." },
    { id: 4, name: "Makrome Süs", price: 120, category: "dekorasyon", description: "Bohem duvar süsü." },
    { id: 5, name: "Seramik Kupa", price: 95, category: "hediyelik", description: "El yapımı kupa." },
    { id: 6, name: "Deri Cüzdan", price: 250, category: "aksesuar", description: "Hakiki deri." }
];

// --- SAYFA YÜKLENDİĞİNDE ---
document.addEventListener('DOMContentLoaded', () => {
    checkAuthState(); // Kullanıcı giriş yapmış mı kontrol et
    updateCartBadge(); // Sepet sayısını güncelle
    
    // Sayfaya göre fonksiyonları çalıştır
    if (document.getElementById('product-list')) renderProducts();
    if (document.getElementById('showcase-grid')) renderShowcase();
    if (document.getElementById('cart-items-container')) renderCartPage();
    
    // Auth Form Dinleyicileri
    if (document.getElementById('signup-form')) setupSignup();
    if (document.getElementById('login-form')) setupLogin();
});

// --- KULLANICI GİRİŞ KONTROLÜ ---
function checkAuthState() {
    onAuthStateChanged(auth, (user) => {
        const authLinks = document.getElementById('auth-links');
        const userArea = document.getElementById('user-area');
        const userNameSpan = document.getElementById('user-name-display');

        if (user) {
            // Kullanıcı Giriş Yapmışsa
            if(authLinks) authLinks.style.display = 'none'; // Giriş butonlarını gizle
            if(userArea) {
                userArea.style.display = 'flex'; // Profil alanını göster
                userNameSpan.innerText = user.displayName || "Kullanıcı";
            }
        } else {
            // Kullanıcı Çıkış Yapmışsa
            if(authLinks) authLinks.style.display = 'flex';
            if(userArea) userArea.style.display = 'none';
        }
    });
}

// Çıkış Yap Fonksiyonu (Global erişim için window'a atadık)
window.logoutUser = () => {
    signOut(auth).then(() => {
        window.location.href = "index.html";
    });
};

// --- KAYIT OL (SIGN UP) ---
function setupSignup() {
    const form = document.getElementById('signup-form');
    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        const username = document.getElementById('signup-username').value;
        const phone = document.getElementById('signup-phone').value;
        const email = document.getElementById('signup-email').value;
        const password = document.getElementById('signup-password').value;
        const msgBox = document.getElementById('auth-message');

        try {
            // 1. Firebase Auth ile kullanıcı oluştur
            const userCredential = await createUserWithEmailAndPassword(auth, email, password);
            const user = userCredential.user;

            // 2. Kullanıcı Profilini Güncelle (İsim Ekle)
            await updateProfile(user, { displayName: username });

            // 3. Firestore Veritabanına Ek Bilgileri Kaydet (Telefon, Rol vb.)
            await setDoc(doc(db, "users", user.uid), {
                username: username,
                phone: phone,
                email: email,
                role: "buyer", // Varsayılan: Alıcı
                createdAt: new Date()
            });

            // 4. Doğrulama E-postası Gönder
            await sendEmailVerification(user);

            msgBox.className = "message-box success";
            msgBox.style.display = "block";
            msgBox.innerText = "Kayıt başarılı! Lütfen e-postanızı doğrulayın. Yönlendiriliyorsunuz...";
            
            setTimeout(() => window.location.href = "index.html", 3000);

        } catch (error) {
            msgBox.className = "message-box error";
            msgBox.style.display = "block";
            msgBox.innerText = "Hata: " + error.message;
        }
    });
}

// --- GİRİŞ YAP (LOGIN) ---
function setupLogin() {
    const form = document.getElementById('login-form');
    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        const email = document.getElementById('login-email').value;
        const password = document.getElementById('login-password').value;
        const msgBox = document.getElementById('auth-message');

        try {
            const userCredential = await signInWithEmailAndPassword(auth, email, password);
            const user = userCredential.user;

            if (!user.emailVerified) {
                msgBox.className = "message-box error";
                msgBox.style.display = "block";
                msgBox.innerText = "Lütfen önce e-posta adresinizi doğrulayın!";
                // signOut(auth); // İstersen doğrulamayanı içeri alma
                return;
            }

            window.location.href = "index.html";

        } catch (error) {
            msgBox.className = "message-box error";
            msgBox.style.display = "block";
            msgBox.innerText = "Giriş başarısız. Bilgilerinizi kontrol edin.";
        }
    });
}

// --- SEPET VE DİĞER FONKSİYONLAR (Eskisiyle Aynı) ---
// Global erişim için window'a ekliyoruz
window.addToCart = function(btnElement, productId) {
    // Sepete ekleme kodları...
    let cart = JSON.parse(localStorage.getItem('ogrencifyCart')) || [];
    const product = products.find(p => p.id === productId);
    cart.push(product);
    localStorage.setItem('ogrencifyCart', JSON.stringify(cart));
    updateCartBadge();
    
    const originalText = btnElement.innerText;
    btnElement.innerText = "Sepete Eklendi ✔";
    btnElement.classList.add('added');
    setTimeout(() => { btnElement.innerText = originalText; btnElement.classList.remove('added'); }, 1500);
};

window.removeFromCart = function(index) {
    let cart = JSON.parse(localStorage.getItem('ogrencifyCart')) || [];
    cart.splice(index, 1);
    localStorage.setItem('ogrencifyCart', JSON.stringify(cart));
    renderCartPage();
    updateCartBadge();
};

function updateCartBadge() {
    const cart = JSON.parse(localStorage.getItem('ogrencifyCart')) || [];
    const badge = document.getElementById('cart-count');
    if(badge) badge.innerText = cart.length;
}

function renderProducts() {
    const list = document.getElementById('product-list');
    list.innerHTML = "";
    products.forEach(p => {
        const card = document.createElement('div');
        card.className = 'card';
        card.innerHTML = `
            <div class="card-img">${p.name}</div>
            <div class="card-body">
                <h3>${p.name}</h3>
                <div class="price">${p.price} TL</div>
                <button onclick="addToCart(this, ${p.id})" class="btn-add-cart">Sepete Ekle</button>
            </div>
        `;
        list.appendChild(card);
    });
}

function renderShowcase() {
    const grid = document.getElementById('showcase-grid');
    grid.innerHTML = "";
    products.slice(0, 4).forEach(p => {
        const card = document.createElement('div');
        card.className = 'card';
        card.innerHTML = `
            <div class="card-img">${p.name}</div>
            <div class="card-body">
                <h3>${p.name}</h3>
                <div class="price">${p.price} TL</div>
                <button onclick="addToCart(this, ${p.id})" class="btn-add-cart">Sepete Ekle</button>
            </div>
        `;
        grid.appendChild(card);
    });
}

function renderCartPage() {
    // Sepet sayfası render kodları (Eskisiyle aynı)
    const cart = JSON.parse(localStorage.getItem('ogrencifyCart')) || [];
    const container = document.getElementById('cart-items-container');
    const totalPriceEl = document.getElementById('total-price');
    const subTotalEl = document.getElementById('sub-total');
    const warningMsg = document.getElementById('limit-warning');
    const checkoutBtn = document.getElementById('checkout-btn');

    container.innerHTML = "";
    let total = 0;

    if (cart.length === 0) {
        container.innerHTML = "<p>Sepetiniz boş.</p>";
    } else {
        cart.forEach((item, index) => {
            total += item.price;
            const div = document.createElement('div');
            div.className = 'cart-item';
            div.innerHTML = `
                <div class="item-info"><h4>${item.name}</h4><span class="remove-btn" onclick="removeFromCart(${index})">Sil</span></div>
                <div class="item-price">${item.price} TL</div>
            `;
            container.appendChild(div);
        });
    }

    if(subTotalEl) subTotalEl.innerText = total + " TL";
    if(totalPriceEl) totalPriceEl.innerText = total + " TL";

    if (total < 400) {
        if(checkoutBtn) { checkoutBtn.disabled = true; checkoutBtn.innerText = "Limit Altında"; }
        if(warningMsg) { warningMsg.style.display = "block"; warningMsg.innerText = "Üzgünüz, şu an yola çıkmaya hazır değiliz. Minimum 400 TL'lik sepet tutarı karşılanmalı."; }
    } else {
        if(checkoutBtn) { checkoutBtn.disabled = false; checkoutBtn.innerText = "Sepeti Onayla"; }
        if(warningMsg) warningMsg.style.display = "none";
    }
}
