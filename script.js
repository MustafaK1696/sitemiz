// Ürün Verileri
const products = [
    { id: 1, name: "El Örgüsü Atkı", price: 150, description: "Kış ayları için ideal, yün örgü." },
    { id: 2, name: "Ahşap Kalemlik", price: 85, description: "Masanıza şıklık katacak doğal tasarım." },
    { id: 3, name: "Deri Cüzdan", price: 250, description: "Uzun ömürlü, %100 gerçek deri." },
    { id: 4, name: "Makrome Duvar Süsü", price: 120, description: "Bohem tarz sevenler için." },
    { id: 5, name: "Seramik Kupa", price: 95, description: "Elde boyanmış özel tasarım." },
    { id: 6, name: "Bez Çanta", price: 40, description: "Doğa dostu, baskılı bez çanta." }
];

// Sayfa Yüklendiğinde Çalışacak Kodlar
document.addEventListener('DOMContentLoaded', () => {
    // Eğer ürünler sayfasındaysak ürünleri listele
    if (document.getElementById('product-list')) {
        renderProducts();
    }
    
    // Sepet sayısını güncelle (Sayfa yenilense bile hatırlar)
    updateCartDisplay();
});

// Ürünleri Ekrana Basma Fonksiyonu
function renderProducts() {
    const productList = document.getElementById('product-list');
    productList.innerHTML = "";

    products.forEach(product => {
        const card = document.createElement('div');
        card.className = 'card';
        card.innerHTML = `
            <div class="card-img">${product.name} Görseli</div>
            <div class="card-body">
                <h3>${product.name}</h3>
                <p>${product.description}</p>
                <div class="price">${product.price} TL</div>
                <button onclick="addToCart(${product.id})" class="btn-add-cart">Sepete Ekle</button>
            </div>
        `;
        productList.appendChild(card);
    });
}

// Sepete Ekleme Fonksiyonu
function addToCart(productId) {
    // Mevcut sepeti hafızadan al, yoksa boş dizi oluştur
    let cart = JSON.parse(localStorage.getItem('ogrencifyCart')) || [];
    
    // Ürünü sepete ekle
    const product = products.find(p => p.id === productId);
    cart.push(product);
    
    // Güncel sepeti hafızaya kaydet
    localStorage.setItem('ogrencifyCart', JSON.stringify(cart));
    
    // Sepet sayısını güncelle
    updateCartDisplay();
    alert(`${product.name} sepete eklendi!`);
}

// Sepet Sayacını Güncelleme
function updateCartDisplay() {
    const cart = JSON.parse(localStorage.getItem('ogrencifyCart')) || [];
    const badge = document.getElementById('cart-count');
    if (badge) {
        badge.innerText = cart.length;
    }
}
