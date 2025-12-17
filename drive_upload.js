// drive_upload.js (proxy sürümü)
// Browser -> /api/drive-upload (same origin) -> Apps Script (server-to-server)

export const DRIVE_PROXY_ENDPOINT = "/api/drive-upload";

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

export async function uploadToDrive(file, { timeoutMs = 180000 } = {}) {
  const base64 = await fileToBase64(file);

  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeoutMs);

  try {
    const res = await fetch(DRIVE_PROXY_ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: file.name,
        mimeType: file.type || "application/octet-stream",
        dataBase64: base64
      }),
      signal: ctrl.signal
    });

    const data = await res.json().catch(() => ({}));
    if (!res.ok || !data.ok) {
      throw new Error(data.error || "Upload failed");
    }
    return data;
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
