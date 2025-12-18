// api/drive-upload.js
// Vercel Serverless Function: same-origin proxy to Apps Script Web App

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.status(405).json({ ok: false, error: "Method not allowed" });
    return;
  }

  try {
    const body = typeof req.body === "string" ? JSON.parse(req.body) : req.body;

    const name = body?.name;
    const mimeType = body?.mimeType;
    const dataBase64 = body?.dataBase64;

    if (!name || !mimeType || !dataBase64) {
      res.status(400).json({ ok: false, error: "Missing name/mimeType/dataBase64" });
      return;
    }

    const params = new URLSearchParams();
    params.set("name", name);
    params.set("mimeType", mimeType);
    params.set("dataBase64", dataBase64);

    const upstream = await fetch("https://script.google.com/macros/s/AKfycbzQFoCx-yv7rpTAxeUiC-F4mVk7JyxJyHS_zXgvwSzNwLatewyZ1wPbu4EMswkhcl_g/exec", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded;charset=UTF-8" },
      body: params.toString()
    });

    const text = await upstream.text();

    let data;
    try {
      data = JSON.parse(text);
    } catch (e) {
      res.status(502).json({ ok: false, error: "Apps Script JSON dönmedi", raw: text.slice(0, 200) });
      return;
    }

    res.status(upstream.ok ? 200 : 502).json(data);
  } catch (err) {
    res.status(500).json({ ok: false, error: String(err?.message || err) });
  }
}
