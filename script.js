// --- FIREBASE AYARLARI (Kendi proje bilgilerini buraya gir) ---
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getAuth, createUserWithEmailAndPassword, signInWithEmailAndPassword, onAuthStateChanged, signOut, sendEmailVerification, updateProfile } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { getFirestore, doc, setDoc, getDoc } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

/* --- DİNAMİK MENÜ VE FOOTER YÜKLEYİCİ --- */
async function loadComponents() {
    try {
        // 1. Navbar'ı yükle
        const navResponse = await fetch('navbar.html');
        const navHtml = await navResponse.text();
        document.getElementById('navbar-placeholder').innerHTML = navHtml;

        // 2. Footer'ı yükle
        const footResponse = await fetch('footer.html');
        const footHtml = await footResponse.text();
        document.getElementById('footer-placeholder').innerHTML = footHtml;

        // 3. YÜKLEME BİTTİKTEN SONRA ÇALIŞACAK FONKSİYONLAR
        // Menü HTML'i artık sayfada olduğu için event listener'ları şimdi ekleyebiliriz
        initializeMenuEvents(); 
        checkAuthState(); // Giriş kontrolünü yap
        updateCartBadge(); // Sepet sayısını güncelle

    } catch (error) {
        console.error("Menü yüklenirken hata oluştu:", error);
    }
}

// Menü yüklendikten sonra çalışacak olaylar (Hamburger vb.)
function initializeMenuEvents() {
    const hamburger = document.querySelector(".hamburger");
    const mobileMenu = document.querySelector(".mobile-menu-container");

    if (hamburger && mobileMenu) {
        hamburger.addEventListener("click", () => {
            mobileMenu.classList.toggle("active");
            // Menü açılınca hamburger ikonunu değiştirebilirsin istersen
        });

        // Menü dışına tıklayınca kapat
        document.addEventListener('click', (e) => {
            if (!mobileMenu.contains(e.target) && !hamburger.contains(e.target)) {
                mobileMenu.classList.remove("active");
            }
        });
    }
}

// --- SAYFA YÜKLENDİĞİNDE ÇALIŞACAKLAR ---
document.addEventListener('DOMContentLoaded', () => {
    
    // Önce bileşenleri yükle
    loadComponents();

    // Sayfaya özel diğer fonksiyonlar (Ürün listeleme vb.)
    if (document.getElementById('product-list')) renderProducts();
    if (document.getElementById('showcase-grid')) renderShowcase();
    if (document.getElementById('cart-items-container')) renderCartPage();
    if (document.getElementById('signup-form')) setupSignup();
    if (document.getElementById('login-form')) setupLogin();
});

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

/* --- YENİ MOBİL MENÜ MANTIĞI --- */
const hamburger = document.querySelector(".hamburger");
const mobileMenu = document.querySelector(".mobile-menu-container");

if (hamburger && mobileMenu) {
    hamburger.addEventListener("click", () => {
        mobileMenu.classList.toggle("active");
        // Hamburger ikonunu değiştir (X yapma efekti eklenebilir)
    });

    // Menü dışına tıklayınca kapatma (Opsiyonel)
    document.addEventListener('click', (e) => {
        if (!mobileMenu.contains(e.target) && !hamburger.contains(e.target)) {
            mobileMenu.classList.remove("active");
        }
    });
}

/* --- AUTH GÜNCELLEMESİ (Giriş Yapınca Butonları Gizle) --- */
function checkAuthState() {
    onAuthStateChanged(auth, (user) => {
        const desktopAuth = document.getElementById('desktop-auth');
        const mobileAuth = document.getElementById('mobile-auth');
        const userArea = document.getElementById('user-area');
        const userNameSpan = document.getElementById('user-name-display');

        if (user) {
            // Giriş yapıldıysa butonları gizle, kullanıcı adını göster
            if(desktopAuth) desktopAuth.style.display = 'none';
            if(mobileAuth) mobileAuth.style.display = 'none';
            
            if(userArea) {
                userArea.style.display = 'flex';
                userNameSpan.innerText = user.displayName || "Üye";
            }
        } else {
            // Çıkış yapıldıysa butonları göster
            if(desktopAuth) desktopAuth.style.display = 'flex';
            if(mobileAuth) mobileAuth.style.display = 'flex'; // Mobilde flex-col css'te ayarlı
            
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

// --- KAYIT OL (SIGN UP) GÜNCELLENMİŞ HALİ ---
/* --- KAYIT OL (SIGN UP) --- */
function setupSignup() {
    const form = document.getElementById('signup-form');
    if (!form) return;

    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        // Form verilerini al
        const username = document.getElementById('signup-username').value;
        const phone = document.getElementById('signup-phone').value;
        const email = document.getElementById('signup-email').value;
        const password = document.getElementById('signup-password').value;
        const msgBox = document.getElementById('auth-message');

        // Şifre Güvenlik Kontrolü (İstersen burayı basitleştirebilirsin)
        const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{8,}$/;
        if (!passwordRegex.test(password)) {
            showMsg(msgBox, "Şifre en az 8 karakter, 1 büyük harf, 1 küçük harf ve 1 rakam içermelidir.", "error");
            return;
        }

        try {
            // Butonu kilitle (Çift tıklamayı önlemek için)
            const submitBtn = form.querySelector('button');
            submitBtn.disabled = true;
            submitBtn.innerText = "Kaydediliyor...";

            // 1. Firebase Auth ile Kullanıcıyı Oluştur
            const userCredential = await createUserWithEmailAndPassword(auth, email, password);
            const user = userCredential.user;

            // 2. Profil ismini güncelle
            await updateProfile(user, { displayName: username });

            // 3. Firestore Veritabanına DETAYLARI KAYDET (Kritik Adım)
            await setDoc(doc(db, "users", user.uid), {
                uid: user.uid,
                username: username,
                phone: phone,
                email: email,
                role: "buyer", // Varsayılan rol: Alıcı
                createdAt: new Date()
            });

            // 4. Başarılı Mesajı Ver ve Yönlendir
            showMsg(msgBox, "🎉 Başarıyla kayıt oldunuz! Giriş sayfasına yönlendiriliyorsunuz...", "success");
            
            // 2 Saniye sonra giriş sayfasına at
            setTimeout(() => {
                window.location.href = "login.html";
            }, 2000);

        } catch (error) {
            console.error("Kayıt Hatası:", error);
            let hataMesaji = "Bir hata oluştu: " + error.message;
            if (error.code === 'auth/email-already-in-use') hataMesaji = "Bu e-posta adresi zaten kullanılıyor.";
            
            showMsg(msgBox, hataMesaji, "error");
            
            // Butonu tekrar aç
            const submitBtn = form.querySelector('button');
            submitBtn.disabled = false;
            submitBtn.innerText = "Kayıt Ol";
        }
    });
}

/* --- GİRİŞ YAP (LOGIN) --- */
function setupLogin() {
    const form = document.getElementById('login-form');
    if (!form) return;

    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        const email = document.getElementById('login-email').value;
        const password = document.getElementById('login-password').value;
        const msgBox = document.getElementById('auth-message');

        try {
            const submitBtn = form.querySelector('button');
            submitBtn.disabled = true;
            submitBtn.innerText = "Giriş Yapılıyor...";

            // Firebase ile giriş yap
            await signInWithEmailAndPassword(auth, email, password);

            showMsg(msgBox, "Giriş başarılı! Yönlendiriliyorsunuz...", "success");
            
            // Ana sayfaya yönlendir
            setTimeout(() => {
                window.location.href = "index.html";
            }, 1000);

        } catch (error) {
            console.error("Giriş Hatası:", error);
            let hataMesaji = "Giriş başarısız. E-posta veya şifre hatalı.";
            if (error.code === 'auth/user-not-found') hataMesaji = "Böyle bir kullanıcı bulunamadı.";
            if (error.code === 'auth/wrong-password') hataMesaji = "Şifre hatalı.";

            showMsg(msgBox, hataMesaji, "error");
            
            const submitBtn = form.querySelector('button');
            submitBtn.disabled = false;
            submitBtn.innerText = "Giriş Yap";
        }
    });
}

// Yardımcı Fonksiyon: Mesaj Göster
function showMsg(element, message, type) {
    element.style.display = "block";
    element.className = "message-box " + type;
    element.innerText = message;
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

/* --- ADMIN / MODERATÖR FONKSİYONLARI --- */

// Admin sayfasındaysak çalıştır
if (window.location.pathname.includes("admin.html")) {
    // 1. Yetki Kontrolü: Giriş yapmış mı ve rolü 'admin' mi?
    onAuthStateChanged(auth, async (user) => {
        if (user) {
            const userDoc = await getDoc(doc(db, "users", user.uid));
            if (userDoc.exists() && userDoc.data().role === "moderator") {
                // Yetkili ise siparişleri getir
                loadOrders();
            } else {
                alert("Bu sayfaya erişim yetkiniz yok!");
                window.location.href = "index.html";
            }
        } else {
            window.location.href = "login.html";
        }
    });
}

// Siparişleri Listeleme Fonksiyonu
async function loadOrders() {
    const list = document.getElementById('admin-orders-list');
    list.innerHTML = "";
    
    // Firestore'dan 'orders' koleksiyonunu çek (Tarihe göre sıralı çekmek için query eklenebilir)
    import { collection, getDocs, updateDoc, addDoc } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
    
    const querySnapshot = await getDocs(collection(db, "orders"));
    
    if (querySnapshot.empty) {
        list.innerHTML = "<p>Henüz sipariş yok.</p>";
        return;
    }

    querySnapshot.forEach((docSnap) => {
        const order = docSnap.data();
        const orderId = docSnap.id;
        
        // Duruma göre renk belirle
        let badgeClass = "status-pending";
        if(order.status === "Onaylandı") badgeClass = "status-approved";
        if(order.status === "Kargoda") badgeClass = "status-shipped";
        if(order.status === "Teslim Edildi") badgeClass = "status-completed";

        const card = document.createElement('div');
        card.className = 'order-card';
        card.innerHTML = `
            <div style="display:flex; justify-content:space-between;">
                <h3>Sipariş #${orderId.slice(0,6)}...</h3>
                <span class="status-badge ${badgeClass}">${order.status || 'Bekliyor'}</span>
            </div>
            <p><strong>Müşteri:</strong> ${order.customerName || 'Bilinmiyor'}</p>
            <p><strong>Tutar:</strong> ${order.totalAmount} TL</p>
            <p><strong>Ürünler:</strong> ${order.items.map(i => i.name).join(", ")}</p>
            
            <div class="admin-actions">
                <button onclick="updateOrderStatus('${orderId}', 'Onaylandı')" class="btn-action" style="background:#3498db;">✅ Onayla</button>
                <button onclick="updateOrderStatus('${orderId}', 'Kargoda')" class="btn-action" style="background:#9b59b6;">📦 Kargola</button>
                <button onclick="updateOrderStatus('${orderId}', 'Teslim Edildi')" class="btn-action" style="background:#2ecc71;">🏁 Teslim Et</button>
                <button onclick="updateOrderStatus('${orderId}', 'İptal')" class="btn-action" style="background:#e74c3c;">❌ İptal</button>
            </div>
        `;
        list.appendChild(card);
    });
}

// Sipariş Durumunu Güncelleme (Global erişim için window'a atıyoruz)
window.updateOrderStatus = async (orderId, newStatus) => {
    import { doc, updateDoc } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
    try {
        const orderRef = doc(db, "orders", orderId);
        await updateDoc(orderRef, {
            status: newStatus
        });
        alert(`Sipariş durumu '${newStatus}' olarak güncellendi!`);
        loadOrders(); // Listeyi yenile
    } catch (error) {
        console.error("Hata:", error);
        alert("Güncelleme yapılamadı.");
    }
};

// TEST İÇİN: Rastgele Sipariş Oluşturma
window.createTestOrder = async () => {
    import { collection, addDoc } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
    try {
        await addDoc(collection(db, "orders"), {
            customerName: "Test Kullanıcı",
            totalAmount: 450,
            items: [{name: "El Örgüsü Atkı"}, {name: "Deri Cüzdan"}],
            status: "Bekliyor",
            createdAt: new Date()
        });
        loadOrders(); // Listeyi yenile
    } catch (e) {
        console.error("Hata:", e);
    }
};




