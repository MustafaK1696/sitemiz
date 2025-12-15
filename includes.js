// includes.js
// Bu dosya artık sadece 'script.js' bulunmayan sayfalarda navbar/footer partial yüklemek için kullanılır.
// Çünkü script.js zaten navbar/footer yükleme ve navbar etkileşimlerini kuruyor.

(function () {
  function byId(id) { return document.getElementById(id); }

  async function loadInto(id, url) {
    const host = byId(id);
    if (!host) return;
    if (host.innerHTML && host.innerHTML.trim().length > 10) return;

    try {
      const res = await fetch(url, { cache: "no-store" });
      if (!res.ok) return;
      host.innerHTML = await res.text();
    } catch (e) {
      // sessiz geç
    }
  }

  document.addEventListener("DOMContentLoaded", async () => {
    // Eğer sayfada script.js varsa partial'ları o yönetsin (çakışmayı önler)
    const hasMain = !!document.querySelector('script[type="module"][src$="script.js"]');
    if (hasMain) return;

    await loadInto("navbar-placeholder", "navbar.html");
    await loadInto("footer-placeholder", "footer.html");
  });
})();
