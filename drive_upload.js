// drive_upload.js
// Google Apps Script Web App endpoint
export const DRIVE_WEBAPP_URL = "https://script.google.com/macros/s/AKfycbzQFoCx-yv7rpTAxeUiC-F4mVk7JyxJyHS_zXgvwSzNwLatewyZ1wPbu4EMswkhcl_g/exec";

function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => {
      const res = String(r.result || "");
      const idx = res.indexOf("base64,");
      if (idx === -1) return reject(new Error("Base64 parse failed"));
      resolve(res.slice(idx + "base64,".length));
    };
    r.onerror = () => reject(new Error("FileReader error"));
    r.readAsDataURL(file);
  });
}

export async function uploadToDrive(file, { timeoutMs = 120000 } = {}) {
  const base64 = await fileToBase64(file);

  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeoutMs);

  const payload = {
    name: file.name,
    mimeType: file.type || "application/octet-stream",
    dataBase64: base64
  };

  try {
    const res = await fetch(DRIVE_WEBAPP_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      signal: ctrl.signal
    });

    const data = await res.json().catch(() => ({}));
    if (!res.ok || !data.ok) {
      throw new Error(data.error || `Upload failed: ${res.status}`);
    }
    return data; // {ok, fileId, name, mimeType, viewUrl}
  } finally {
    clearTimeout(t);
  }
}

export function drivePlayableUrl(fileId, mimeType) {
  const mt = (mimeType || "").toLowerCase();
  const isPdf = mt.includes("pdf");
  if (isPdf) return `https://drive.google.com/file/d/${fileId}/preview`;
  return `https://drive.google.com/uc?export=download&id=${fileId}`;
}
