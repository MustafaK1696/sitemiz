// includes.js - Navbar/Footer yükleyici (Firebase'den bağımsız)
(function () {
  function byId(id) { return document.getElementById(id); }

  const NAV_FALLBACK = '<header class="site-header">\n  <nav class="navbar">\n    <!-- Logo -->\n    <a href="index.html" class="logo">\n  <img src="logo.png" alt="ÖğrenciFy">\n</a>\n    <!-- Masaüstü menü -->\n    <div class="nav-main">\n      <ul class="nav-links">\n  <li><a href="index.html">Ana Sayfa</a></li>\n\n  <!-- ÜRÜNLER DROPDOWN -->\n  <li class="nav-dropdown">\n    <a href="products.html">Ürünler</a>\n    <ul class="dropdown-menu">\n      <li><a href="products.html?cat=ev">Ev</a></li>\n      <li><a href="products.html?cat=dekorasyon">Dekorasyon</a></li>\n      <li><a href="products.html?cat=aksesuar">Aksesuar</a></li>\n      <li><a href="products.html?cat=elektronik">Elektronik</a></li>\n      <li><a href="products.html?cat=hediyelik">Hediyelik</a></li>\n    </ul>\n  </li>\n\n  <li><a href="seller.html" class="nav-seller">Satıcı Ol</a></li>\n  <li><a href="about.html">Hakkımızda</a></li>\n  <!-- İletişim kaldırıldı -->\n  <li><a href="help.html">Yardım</a></li>\n\n  <!-- SADECE ADMİN İÇİN: Yönetici Paneli -->\n  <li>\n    <a href="admin.html"\n       class="nav-admin-link"\n       style="display:none; font-weight:600; color:#7b3fe4;">\n      Yönetici Paneli\n    </a>\n  </li>\n</ul>\n    </div>\n\n    <!-- Giriş / Kayıt / Sepet / Profil -->\n    <div class="nav-auth">\n      <!-- Misafir görünümü -->\n      <div class="nav-auth-guest">\n        <a href="login.html" class="nav-btn nav-login">Giriş Yap</a>\n        <a href="signup.html" class="nav-btn nav-signup">Kayıt Ol</a>\n      </div>\n\n      <!-- Girişli kullanıcı görünümü -->\n      <div class="nav-auth-user">\n        <!-- Sepet butonu -->\n        <a href="cart.html" class="nav-btn nav-cart">\n          <span>Sepetim</span>\n          <span class="badge" id="cart-count">0</span>\n          <span class="cart-progress">\n            <span id="cart-progress-fill" class="cart-progress-fill"></span>\n          </span>\n        </a>\n\n        <!-- Kullanıcı menüsü -->\n        <button id="nav-user-button" class="nav-user-button" type="button">\n          <div id="nav-user-avatar" class="nav-user-avatar">U</div>\n          <span class="nav-user-name" id="nav-user-name">Kullanıcı</span>\n        </button>\n\n        <div id="nav-user-dropdown" class="nav-user-dropdown">\n          <div class="nav-user-dropdown-header">\n            <div id="nav-user-avatar-big" class="nav-user-avatar">U</div>\n            <div>\n              <div id="nav-user-name-big" class="nav-user-name">Kullanıcı</div>\n              <div id="nav-user-email" class="nav-user-email">-</div>\n            </div>\n          </div>\n          <button class="nav-user-link" onclick="window.location.href=\'profile.html\'">\n            Profil & Güvenlik\n          </button>\n\n          <!-- SADECE seller/admin için: Satıcı Panelim -->\n          <button class="nav-user-link nav-seller-panel-link"\n                  style="display:none;"\n                  onclick="window.location.href=\'seller-dashboard.html\'">\n            Satıcı Panelim\n          </button>\n\n          <button class="nav-user-link nav-user-logout" id="logout-btn">\n            Çıkış Yap\n          </button>\n        </div>\n      </div>\n    </div>\n\n    <!-- Mobil menü butonu -->\n    <button class="nav-toggle" type="button" aria-label="Menü">\n      ☰\n    </button>\n  </nav>\n\n  <!-- Mobil menü içeriği -->\n<div class="nav-mobile-menu">\n  <a href="index.html">Ana Sayfa</a>\n  <a href="products.html">Ürünler</a>\n  <a href="products.html?cat=ev">• Ev</a>\n  <a href="products.html?cat=dekorasyon">• Dekorasyon</a>\n  <a href="products.html?cat=aksesuar">• Aksesuar</a>\n  <a href="products.html?cat=elektronik">• Elektronik</a>\n  <a href="products.html?cat=hediyelik">• Hediyelik</a>\n\n  <a href="seller.html" class="nav-seller-mobile">Satıcı Ol</a>\n  <a href="about.html">Hakkımızda</a>\n  <!-- İletişim kaldırıldı -->\n  <a href="help.html">Yardım</a>\n\n  <!-- ADMİN ve Satıcı paneli linklerin, mevcut halleri kalsın -->\n  <a href="admin.html"\n     class="nav-admin-link-mobile"\n     style="display:none; font-weight:600; color:#7b3fe4;">\n    Yönetici Paneli\n  </a>\n\n  <a href="seller-dashboard.html"\n     class="nav-seller-panel-mobile"\n     style="display:none;">\n    Satıcı Panelim\n  </a>\n\n  <!-- Mobil login/signup -->\n  <a href="login.html" class="nav-mobile-login">Giriş Yap</a>\n  <a href="signup.html" class="nav-signup-mobile">Kayıt Ol</a>\n  <a href="cart.html">Sepetim</a>\n</div>\n\n</header>\n\n\n';
  const FOOT_FALLBACK = '<footer class="mega-footer">\n  <div class="footer-container">\n    <div class="footer-col">\n      <a href="index.html" class="footer-logo">\n        <img src="logo.png" alt="ÖğrenciFy logosu">\n      </a>\n      <p class="footer-tagline">Geleceğin emeği, bugünün değeri.</p>\n      <div class="social-icons">\n        <a href="#">📷</a>\n        <a href="#">🐦</a>\n        <a href="#">▶️</a>\n      </div>\n    </div>\n\n    <div class="footer-col">\n      <h3>Kurumsal</h3>\n      <ul class="footer-links">\n        <li><a href="about.html">Hakkımızda</a></li>\n        <li><a href="seller.html">Satıcı Ol</a></li>\n        <li><a href="contact.html">İletişim</a></li>\n      </ul>\n    </div>\n\n    <div class="footer-col">\n      <h3>Keşfet</h3>\n      <ul class="footer-links">\n        <li><a href="products.html">Tüm Ürünler</a></li>\n        <li><a href="help.html">Yardım Merkezi</a></li>\n        <li><a href="cart.html">Sepetim</a></li>\n      </ul>\n    </div>\n  </div>\n\n  <div class="footer-bottom">\n    <p>&copy; 2025 ÖğrenciFy. Tüm hakları saklıdır.</p>\n  </div>\n</footer>\n';

  async function loadInto(id, url, fallback) {
    const host = byId(id);
    if (!host) return;
    if (host.innerHTML && host.innerHTML.trim().length > 10) return;

    try {
      const res = await fetch(url, { cache: "no-store" });
      if (!res.ok) throw new Error("HTTP " + res.status);
      host.innerHTML = await res.text();
    } catch (e) {
      console.warn("Include yüklenemedi:", url, e);
      host.innerHTML = fallback || "";
    }
  }

  function wireNavInteractions() {
    const toggle = document.querySelector(".nav-toggle");
    const mobileMenu = document.querySelector(".nav-mobile-menu");
    if (toggle && mobileMenu) {
      toggle.addEventListener("click", () => {
        mobileMenu.classList.toggle("open");
      });
    }

    const userBtn = document.getElementById("nav-user-button");
    const userDrop = document.getElementById("nav-user-dropdown");
    if (userBtn && userDrop) {
      userBtn.addEventListener("click", (e) => {
        e.stopPropagation();
        userDrop.classList.toggle("open");
      });
      document.addEventListener("click", () => userDrop.classList.remove("open"));
      userDrop.addEventListener("click", (e) => e.stopPropagation());
    }
  }

  document.addEventListener("DOMContentLoaded", async () => {
    await loadInto("navbar-placeholder", "navbar.html", NAV_FALLBACK);
    await loadInto("footer-placeholder", "footer.html", FOOT_FALLBACK);
    wireNavInteractions();
  });
})();
