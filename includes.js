// includes.js - Navbar/Footer yükleyici (Firebase'den bağımsız)
(function () {
  function byId(id) { return document.getElementById(id); }

  const NAV_FALLBACK = '<header class="site-header"><nav class="navbar"><a href="index.html" class="logo"><img src="logo.png" alt="ÖğrenciFy"></a><div class="nav-actions"><a class="nav-cart" href="cart.html"><span class="nav-cart-text">Sepetim</span><span class="nav-cart-count" id="cart-count">0</span></a><a href="login.html" class="btn-nav btn-nav-outline">Giriş Yap</a><a href="signup.html" class="btn-nav btn-nav-primary">Kayıt Ol</a></div></nav></header>';
  const FOOT_FALLBACK = '<footer class="mega-footer"><div class="footer-bottom"><p>© 2025 ÖğrenciFy. Tüm hakları saklıdır.</p></div></footer>';

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
