// Çeşitlendirilmiş Ürün Listesi
const products = [
    // GİYİM
    { id: 1, name: "El Örgüsü Atkı", price: 150, category: "giyim", description: "Kışlık yün örgü, sıcak tutar." },
    { id: 2, name: "Tasarım Bez Çanta", price: 60, category: "giyim", description: "Minimalist baskılı doğa dostu çanta." },
    { id: 3, name: "Nakışlı Tişört", price: 200, category: "giyim", description: "Elde işlenmiş özel tasarım tişört." },

    // HEDİYELİK & DEKORASYON
    { id: 4, name: "Ahşap Kalemlik", price: 85, category: "hediyelik", description: "Doğal ahşap masa düzenleyici." },
    { id: 5, name: "Makrome Duvar Süsü", price: 120, category: "dekorasyon", description: "Evinize bohem bir hava katar." },
    { id: 6, name: "Seramik Kupa", price: 95, category: "hediyelik", description: "El yapımı, eşsiz desenli kupa." },
    { id: 7, name: "Soya Mumu", price: 75, category: "dekorasyon", description: "Lavanta kokulu doğal mum." },

    // AKSESUAR & TAKI
    { id: 8, name: "Deri Cüzdan", price: 250, category: "aksesuar", description: "Hakiki deri, el dikimi kartlık." },
    { id: 9, name: "Boncuk Bileklik", price: 45, category: "aksesuar", description: "Renkli doğal taş bileklik." },
    { id: 10, name: "Gümüş Kaplama Kolye", price: 180, category: "aksesuar", description: "Özel tasarım minimalist uçlu kolye." },

    // TEKNOLOJİ & KIRTASİYE
    { id: 11, name: "Telefon Standı", price: 50, category: "teknoloji", description: "3D yazıcı ile üretilmiş pratik stand." },
    { id: 12, name: "Planlayıcı Defter", price: 110, category: "kirtasiye", description: "Yıllık hedefleriniz için özel tasarım." }
];

document.addEventListener('DOMContentLoaded', () => {
    updateCartBadge();
    
    // Hangi sayfadaysak ona göre işlem yap
    if (document.getElementById('product-list')) renderProducts();
    if (document.getElementById('showcase-grid')) renderShowcase();
    if (document.getElementById('cart-items-container')) renderCartPage();
});

// Tüm Ürünleri Listele
function renderProducts() {
    const list = document.getElementById('product-list');
    list.innerHTML = "";
    products.forEach(p => {
        list.appendChild(createProductCard(p));
    });
}

// Vitrine Rastgele 4 Ürün Getir
function renderShowcase() {
    const grid = document.getElementById('showcase-grid');
    grid.innerHTML = "";
    // İlk 4 ürünü vitrine koy
    products.slice(0, 4).forEach(p => {
        grid.appendChild(createProductCard(p));
    });
}

// Ürün Kartı Oluşturucu (Ortak Fonksiyon)
function createProductCard(product) {
    const card = document.createElement('div');
    card.className = 'card';
    card.innerHTML = `
        <div class="card-img">${product.name}</div>
        <div class="card-body">
            <div class="category-tag">${product.category}</div>
            <h3>${product.name}</h3>
            <p>${product.description}</p>
            <div class="price">${product.price} TL</div>
            <button onclick="addToCart(this, ${product.id})" class="btn-add-cart">Sepete Ekle</button>
        </div>
    `;
    return card;
}

// Sepet İşlemleri
function addToCart(btnElement, productId) {
    let cart = JSON.parse(localStorage.getItem('ogrencifyCart')) || [];
    const product = products.find(p => p.id === productId);
    
    cart.push(product);
    localStorage.setItem('ogrencifyCart', JSON.stringify(cart));
    updateCartBadge();

    // Buton Efekti
    const originalText = btnElement.innerText;
    btnElement.innerText = "Sepete Eklendi ✔";
    btnElement.classList.add('added');
    setTimeout(() => {
        btnElement.innerText = originalText;
        btnElement.classList.remove('added');
    }, 1500);
}

function updateCartBadge() {
    const cart = JSON.parse(localStorage.getItem('ogrencifyCart')) || [];
    const badge = document.getElementById('cart-count');
    if(badge) badge.innerText = cart.length;
}

// Sepet Sayfası
function renderCartPage() {
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
                <div class="item-info">
                    <h4>${item.name}</h4>
                    <span class="remove-btn" onclick="removeFromCart(${index})">Sil</span>
                </div>
                <div class="item-price">${item.price} TL</div>
            `;
            container.appendChild(div);
        });
    }

    subTotalEl.innerText = total + " TL";
    totalPriceEl.innerText = total + " TL";

    if (total < 400) {
        if(checkoutBtn) {
            checkoutBtn.disabled = true;
            checkoutBtn.innerText = "Limit Altında";
        }
        if(warningMsg) {
            warningMsg.style.display = "block";
            warningMsg.innerText = "Üzgünüz, şu an yola çıkmaya hazır değiliz. Minimum 400 TL'lik sepet tutarı karşılanmalı.";
        }
    } else {
        if(checkoutBtn) {
            checkoutBtn.disabled = false;
            checkoutBtn.innerText = "Sepeti Onayla";
        }
        if(warningMsg) warningMsg.style.display = "none";
    }
}

function removeFromCart(index) {
    let cart = JSON.parse(localStorage.getItem('ogrencifyCart')) || [];
    cart.splice(index, 1);
    localStorage.setItem('ogrencifyCart', JSON.stringify(cart));
    renderCartPage();
    updateCartBadge();
}
