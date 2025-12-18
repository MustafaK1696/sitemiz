// blob_upload.js
export const BLOB_UPLOAD_ENDPOINT = "/api/blob-upload";

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

export async function uploadToBlob(file, { folder = "productRequests", access = "public", timeoutMs = 120000 } = {}) {
  const base64 = await fileToBase64(file);

  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeoutMs);

  try {
    const res = await fetch(BLOB_UPLOAD_ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        filename: file.name,
        contentType: file.type || "application/octet-stream",
        dataBase64: base64,
        folder,
        access
      }),
      signal: ctrl.signal
    });

    const data = await res.json().catch(() => ({}));
    if (!res.ok || !data.ok) {
      throw new Error(data.error || "Blob upload failed");
    }
    return data;
  } catch (e) {
    if (String(e?.name) === "AbortError") {
      throw new Error("Dosya yükleme zaman aşımına uğradı. İnternetinizi kontrol edip tekrar deneyin.");
    }
    throw e;
  } finally {
    clearTimeout(t);
  }
}

export function mediaKindFromFilename(name, mimeType) {
  const n = (name || "").toLowerCase();
  const mt = (mimeType || "").toLowerCase();
  if (n.endsWith(".pdf") || mt.includes("pdf")) return "pdf";
  if (n.endsWith(".mp4") || n.endsWith(".webm") || n.endsWith(".mov") || n.endsWith(".m4v") || mt.startsWith("video/")) return "video";
  return "image";
}
