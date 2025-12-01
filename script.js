// Ürün Verileri
const products = [
    { id: 1, name: "El Örgüsü Atkı", price: 150, category: "giyim", description: "Kış ayları için ideal." },
    { id: 2, name: "Ahşap Kalemlik", price: 85, category: "hediyelik", description: "Masanıza şıklık katar." },
    { id: 3, name: "Deri Cüzdan", price: 250, category: "gundelik", description: "Gerçek deri, el yapımı." },
    { id: 4, name: "Makrome Süs", price: 120, category: "hediyelik", description: "Bohem duvar süsü." },
    { id: 5, name: "Seramik Kupa", price: 95, category: "gundelik", description: "Özel tasarım kupa." }
];

document.addEventListener('DOMContentLoaded', () => {
    updateCartBadge();
    
    if (document.getElementById('product-list')) renderProducts();
    if (document.getElementById('cart-items-container')) renderCartPage();
});

// Ürünleri Listele
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
                <p>${p.description}</p>
                <div class="price">${p.price} TL</div>
                <button onclick="addToCart(this, ${p.id})" class="btn-add-cart">Sepete Ekle</button>
            </div>
        `;
        list.appendChild(card);
    });
}

// Sepete Ekle (Görsel Efektli)
function addToCart(btnElement, productId) {
    let cart = JSON.parse(localStorage.getItem('ogrencifyCart')) || [];
    const product = products.find(p => p.id === productId);
    
    cart.push(product);
    localStorage.setItem('ogrencifyCart', JSON.stringify(cart));
    updateCartBadge();

    // Buton yazısını değiştir
    const originalText = btnElement.innerText;
    btnElement.innerText = "Sepete Eklendi ✔";
    btnElement.classList.add('added');

    // 1.5 saniye sonra eski haline döndür
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

// Sepet Sayfası Mantığı (400 TL Sınırı)
function renderCartPage() {
    const cart = JSON.parse(localStorage.getItem('ogrencifyCart')) || [];
    const container = document.getElementById('cart-items-container');
    const totalPriceEl = document.getElementById('total-price');
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

    totalPriceEl.innerText = total + " TL";

    // 400 TL Kontrolü
    if (total < 400) {
        checkoutBtn.disabled = true;
        checkoutBtn.innerText = "Limit Altında";
        warningMsg.style.display = "block";
        warningMsg.innerText = "Üzgünüz, şu an yola çıkmaya hazır değiliz. Minimum 400 TL'lik sepet tutarı karşılanmalı.";
    } else {
        checkoutBtn.disabled = false;
        checkoutBtn.innerText = "Sepeti Onayla";
        warningMsg.style.display = "none";
    }
}

function removeFromCart(index) {
    let cart = JSON.parse(localStorage.getItem('ogrencifyCart')) || [];
    cart.splice(index, 1);
    localStorage.setItem('ogrencifyCart', JSON.stringify(cart));
    renderCartPage();
    updateCartBadge();
}

// Sayfa yüklendiğinde çalışacak fonksiyonlara ekle
document.addEventListener('DOMContentLoaded', () => {
    // ... eski kodların ...
    
    if (document.getElementById('showcase-grid')) {
        renderShowcase();
    }
});

// Vitrine Rastgele veya İlk 4 Ürünü Getir
function renderShowcase() {
    const showcaseGrid = document.getElementById('showcase-grid');
    // Sadece ilk 4 ürünü alalım (veya products.slice(0,4) ile)
    const featuredProducts = products.slice(0, 4); 

    showcaseGrid.innerHTML = "";
    featuredProducts.forEach(product => {
        const card = document.createElement('div');
        card.className = 'card';
        card.innerHTML = `
            <div class="card-img">${product.name}</div>
            <div class="card-body">
                <h3>${product.name}</h3>
                <div class="price">${product.price} TL</div>
                <button onclick="addToCart(this, ${product.id})" class="btn-add-cart">Sepete Ekle</button>
            </div>
        `;
        showcaseGrid.appendChild(card);
    });
}
