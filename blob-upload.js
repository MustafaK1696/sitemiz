// api/blob-upload.js
import { put } from "@vercel/blob";

const MAX_IMAGE_MB = 5;   // jpg/png/pdf
const MAX_VIDEO_MB = 15;  // small videos only

function mbFromBase64Chars(chars) {
  const bytes = Math.floor(chars * 3 / 4);
  return bytes / (1024 * 1024);
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.status(405).json({ ok: false, error: "Method not allowed" });
    return;
  }

  try {
    const body = typeof req.body === "string" ? JSON.parse(req.body) : req.body;

    const filename = body?.filename;
    const contentType = body?.contentType || "application/octet-stream";
    const dataBase64 = body?.dataBase64;
    const folder = body?.folder || "productRequests";
    const access = body?.access || "public";

    if (!filename || !dataBase64) {
      res.status(400).json({ ok: false, error: "Missing filename/dataBase64" });
      return;
    }

    const lower = String(filename).toLowerCase();
    const isVideo = lower.endsWith(".mp4") || lower.endsWith(".webm") || lower.endsWith(".mov") || lower.endsWith(".m4v");
    const maxMb = isVideo ? MAX_VIDEO_MB : MAX_IMAGE_MB;

    const approxMb = mbFromBase64Chars(String(dataBase64).length);
    if (approxMb > maxMb) {
      res.status(413).json({ ok: false, error: `Dosya çok büyük: ~${approxMb.toFixed(1)} MB. Max ${maxMb} MB.` });
      return;
    }

    const buffer = Buffer.from(dataBase64, "base64");
    const ts = Date.now();
    const safeName = String(filename).replace(/[^a-z0-9._-]/gi, "_");
    const key = `${folder}/${ts}_${safeName}`;

    const blob = await put(key, buffer, { access, contentType });

    res.status(200).json({ ok: true, url: blob.url, pathname: blob.pathname, contentType });
  } catch (err) {
    res.status(500).json({ ok: false, error: String(err?.message || err) });
  }
}
