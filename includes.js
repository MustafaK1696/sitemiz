// includes.js - Navbar/Footer yükleyici (Firebase'den bağımsız)
(function () {
  function byId(id) { return document.getElementById(id); }

  async function loadInto(id, url) {
    const host = byId(id);
    if (!host) return;
    if (host.innerHTML && host.innerHTML.trim().length > 20) return;
    const res = await fetch(url, { cache: "no-store" });
    if (!res.ok) throw new Error("HTTP " + res.status);
    host.innerHTML = await res.text();
  }

  function wireNavInteractions() {
    // Profile dropdown toggle (tüm sayfalarda)
    const btn = byId("nav-user-button");
    const menu = byId("nav-user-dropdown");
    if (btn && menu) {
      const close = () => {
        menu.classList.remove("open");
        btn.setAttribute("aria-expanded", "false");
      };
      btn.addEventListener("click", (e) => {
        e.stopPropagation();
        const open = menu.classList.toggle("open");
        btn.setAttribute("aria-expanded", open ? "true" : "false");
      });
      document.addEventListener("click", close);
      menu.addEventListener("click", (e) => e.stopPropagation());
      document.addEventListener("keydown", (e) => { if (e.key === "Escape") close(); });
    }
  }

  document.addEventListener("DOMContentLoaded", async () => {
    try { await loadInto("navbar-placeholder", "navbar.html"); } catch (e) {}
    try { await loadInto("footer-placeholder", "footer.html"); } catch (e) {}
    wireNavInteractions();
  });
})();
