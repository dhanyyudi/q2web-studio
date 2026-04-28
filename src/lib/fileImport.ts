import type { VirtualFile } from "../types/project";

const TEXT_EXTENSIONS = new Set([".html", ".htm", ".js", ".css", ".json", ".txt", ".svg", ".xml"]);

export async function filesFromFileList(fileList: FileList): Promise<VirtualFile[]> {
  const files = Array.from(fileList);
  const virtualFiles = await Promise.all(files.map(readFile));
  return virtualFiles.sort((a, b) => a.path.localeCompare(b.path));
}

async function readFile(file: File): Promise<VirtualFile> {
  const path = normalizePath((file as File & { webkitRelativePath?: string }).webkitRelativePath || file.name);
  const kind = isTextFile(path) ? "text" : "binary";
  if (kind === "text") {
    return {
      path,
      name: file.name,
      kind,
      text: await file.text(),
      mime: file.type || guessMime(path)
    };
  }
  return {
    path,
    name: file.name,
    kind,
    buffer: await file.arrayBuffer(),
    mime: file.type || guessMime(path)
  };
}

function isTextFile(path: string): boolean {
  const lower = path.toLowerCase();
  return Array.from(TEXT_EXTENSIONS).some((extension) => lower.endsWith(extension));
}

function normalizePath(path: string): string {
  return path.replaceAll("\\", "/").replace(/^\/+/, "");
}

function guessMime(path: string): string {
  if (path.endsWith(".png")) return "image/png";
  if (path.endsWith(".jpg") || path.endsWith(".jpeg")) return "image/jpeg";
  if (path.endsWith(".svg")) return "image/svg+xml";
  if (path.endsWith(".css")) return "text/css";
  if (path.endsWith(".js")) return "application/javascript";
  if (path.endsWith(".html")) return "text/html";
  return "application/octet-stream";
}
