import JSZip from "jszip";
import { exportProjectZip } from "./exportProject";
import type { Qgis2webProject } from "../types/project";

export type RuntimePreviewBundle = {
  srcdoc: string;
  url: string;
  urls: string[];
};

export async function buildRuntimePreview(project: Qgis2webProject): Promise<RuntimePreviewBundle> {
  const zipBlob = await exportProjectZip(project);
  const zip = await JSZip.loadAsync(zipBlob);
  const urls: string[] = [];
  const entries = Object.values(zip.files).filter((entry) => !entry.dir);
  const root = project.name;
  const urlByRelativePath = new Map<string, string>();
  const textByRelativePath = new Map<string, string>();

  for (const entry of entries) {
    const relativePath = stripRoot(entry.name, root);
    if (!relativePath) continue;
    const isText = /\.(html|js|css|json|txt|svg)$/i.test(relativePath);
    if (isText) {
      const text = await entry.async("string");
      textByRelativePath.set(relativePath, text);
    } else {
      const blob = await entry.async("blob");
      const url = URL.createObjectURL(blob);
      urls.push(url);
      urlByRelativePath.set(relativePath, url);
    }
  }

  const configText = textByRelativePath.get("q2ws-config.json") || "{}";
  const configUrl = createTextUrl(configText, "application/json", urls);
  const runtimeText = (textByRelativePath.get("q2ws-runtime.js") || "").replace('fetch("q2ws-config.json")', `fetch("${configUrl}")`);
  urlByRelativePath.set("q2ws-runtime.js", createTextUrl(runtimeText, "application/javascript", urls));

  for (const [relativePath, text] of textByRelativePath) {
    if (relativePath === "index.html" || relativePath === "q2ws-runtime.js" || relativePath === "q2ws-config.json") continue;
    const mime = relativePath.endsWith(".css") ? "text/css" : relativePath.endsWith(".js") ? "application/javascript" : "text/plain";
    const nextText = relativePath.endsWith(".css") ? rewriteCssUrls(text, urlByRelativePath) : text;
    urlByRelativePath.set(relativePath, createTextUrl(nextText, mime, urls));
  }

  const indexHtml = textByRelativePath.get("index.html");
  if (!indexHtml) {
    throw new Error("Runtime preview could not find index.html in export ZIP.");
  }

  const srcdoc = rewriteIndexHtml(indexHtml, urlByRelativePath);
  const url = URL.createObjectURL(new Blob([srcdoc], { type: "text/html" }));
  urls.push(url);
  return {
    srcdoc,
    url,
    urls
  };
}

function stripRoot(path: string, root: string): string {
  return path.startsWith(`${root}/`) ? path.slice(root.length + 1) : path;
}

function createTextUrl(text: string, mime: string, urls: string[]): string {
  const url = URL.createObjectURL(new Blob([text], { type: mime }));
  urls.push(url);
  return url;
}

function rewriteIndexHtml(indexHtml: string, urlByRelativePath: Map<string, string>): string {
  let html = indexHtml;
  const paths = Array.from(urlByRelativePath.keys()).sort((a, b) => b.length - a.length);
  for (const path of paths) {
    const url = urlByRelativePath.get(path);
    if (!url) continue;
    html = rewriteAssetAttribute(html, "src", path, url);
    html = rewriteAssetAttribute(html, "href", path, url);
  }
  return html;
}

function rewriteAssetAttribute(html: string, attribute: "src" | "href", path: string, url: string): string {
  const escaped = escapeRegExp(path);
  const filename = escapeRegExp(path.split("/").pop() || path);
  const pattern = new RegExp(`(${attribute}=["'])(?:\\./)?(?:${escaped}|${filename})(["'])`, "g");
  return html.replace(pattern, `$1${url}$2`);
}

function rewriteCssUrls(css: string, urlByRelativePath: Map<string, string>): string {
  return css.replace(/url\((['"]?)([^)'"]+)\1\)/g, (match, quote: string, assetPath: string) => {
    if (/^(data:|blob:|https?:)/i.test(assetPath)) return match;
    const normalized = assetPath.replace(/^\.\//, "");
    const directUrl = urlByRelativePath.get(normalized);
    const suffixUrl = Array.from(urlByRelativePath.entries()).find(([path]) => path.endsWith(`/${normalized}`) || path.endsWith(normalized))?.[1];
    const url = directUrl || suffixUrl;
    return url ? `url(${quote}${url}${quote})` : match;
  });
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
