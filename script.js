// Örnek Veri (Normalde burası Firebase'den gelecek)
const products = [
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

const productList = document.getElementById('product-list');

function renderProducts() {
    productList.innerHTML = "";
    products.forEach(product => {
        const card = document.createElement('div');
        card.className = 'card';
        
        card.innerHTML = `
            <div class="card-img">Ürün Resmi</div>
            <div class="card-body">
                <h3>${product.name}</h3>
                <p>${product.description}</p>
                <div class="price">${product.price} TL</div>
                <button class="btn-primary" style="width:100%; margin-top:10px;">Satın Al</button>
                <button onclick="comparePrice('${product.name}')" class="btn-compare">🔍 Fiyat Araştırması Yap</button>
            </div>
        `;
        productList.appendChild(card);
    });
}

// Akakçe/Google Shopping Fiyat Karşılaştırma Mantığı
function comparePrice(productName) {
    // Kullanıcıyı yeni sekmede Akakçe veya Google Alışveriş aramasına yönlendirir
    const searchQuery = encodeURIComponent(productName);
    const url = `https://www.akakce.com/arama/?q=${searchQuery}`;
    // Alternatif olarak Google: `https://www.google.com/search?tbm=shop&q=${searchQuery}`
    
    window.open(url, '_blank');
}

// Sayfa yüklendiğinde çalıştır
document.addEventListener('DOMContentLoaded', renderProducts);