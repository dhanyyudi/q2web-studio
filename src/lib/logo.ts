import DOMPurify from "dompurify";

const MAX_LOGO_BYTES = 512 * 1024;
const ALLOWED_IMAGE_TYPES = new Set(["image/png", "image/jpeg", "image/webp", "image/svg+xml"]);
const ALLOWED_EXTENSIONS = [".png", ".jpg", ".jpeg", ".webp", ".svg"];

export async function logoFileToDataUrl(file: File): Promise<string> {
  if (file.size > MAX_LOGO_BYTES) {
    throw new Error("Logo file is too large. Use an image under 512 KB.");
  }
  const mime = file.type || mimeFromName(file.name);
  if (!ALLOWED_IMAGE_TYPES.has(mime)) {
    throw new Error("Logo must be PNG, JPG, WebP, or SVG.");
  }
  if (mime === "image/svg+xml") {
    return sanitizedSvgToDataUrl(await file.text());
  }
  return fileToDataUrl(file);
}

function mimeFromName(name: string): string {
  const lower = name.toLowerCase();
  if (!ALLOWED_EXTENSIONS.some((extension) => lower.endsWith(extension))) {
    return "";
  }
  if (lower.endsWith(".svg")) return "image/svg+xml";
  if (lower.endsWith(".webp")) return "image/webp";
  if (lower.endsWith(".png")) return "image/png";
  return "image/jpeg";
}

function sanitizedSvgToDataUrl(svg: string): string {
  const sanitized = DOMPurify.sanitize(svg, {
    USE_PROFILES: { svg: true, svgFilters: true },
    FORBID_TAGS: ["script", "foreignObject"],
    FORBID_ATTR: ["onerror", "onload", "onclick", "onmouseover", "href", "xlink:href"]
  });
  return `data:image/svg+xml;base64,${utf8ToBase64(sanitized)}`;
}

function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ""));
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

function utf8ToBase64(value: string): string {
  const bytes = new TextEncoder().encode(value);
  let binary = "";
  bytes.forEach((byte) => {
    binary += String.fromCharCode(byte);
  });
  return btoa(binary);
}
