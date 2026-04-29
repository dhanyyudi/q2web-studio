import JSZip from "jszip";
import type { VirtualFile } from "../types/project";

const TEXT_EXTENSIONS = new Set([".html", ".htm", ".js", ".css", ".json", ".txt", ".svg", ".xml"]);
const MAX_IMPORT_FILES = 5000;

type FileSystemFileHandleLike = {
  kind: "file";
  name: string;
  getFile: () => Promise<File>;
};

type FileSystemDirectoryHandleLike = {
  kind: "directory";
  name: string;
  values: () => AsyncIterable<FileSystemFileHandleLike | FileSystemDirectoryHandleLike>;
};

type DataTransferItemWithEntry = DataTransferItem & {
  webkitGetAsEntry?: () => FileSystemEntry | null;
};

export async function filesFromFileList(fileList: FileList): Promise<VirtualFile[]> {
  const files = Array.from(fileList);
  assertFileCount(files.length);
  const virtualFiles = await Promise.all(files.map((file) => readFile(file)));
  return virtualFiles.sort((a, b) => a.path.localeCompare(b.path));
}

export async function filesFromZipFile(file: File): Promise<VirtualFile[]> {
  const zip = await JSZip.loadAsync(file);
  const entries = Object.values(zip.files).filter((entry) => !entry.dir && !entry.name.includes("__MACOSX/"));
  assertFileCount(entries.length);
  const virtualFiles = await Promise.all(
    entries.map(async (entry) => {
      const path = normalizePath(entry.name);
      const name = path.split("/").pop() || path;
      const kind = isTextFile(path) ? "text" : "binary";
      if (kind === "text") {
        return {
          path,
          name,
          kind,
          text: await entry.async("string"),
          mime: guessMime(path)
        } satisfies VirtualFile;
      }
      return {
        path,
        name,
        kind,
        buffer: await entry.async("arraybuffer"),
        mime: guessMime(path)
      } satisfies VirtualFile;
    })
  );
  return virtualFiles.sort((a, b) => a.path.localeCompare(b.path));
}

export async function filesFromDataTransferItems(items: DataTransferItemList): Promise<VirtualFile[]> {
  const entries = Array.from(items)
    .map((item) => (item as DataTransferItemWithEntry).webkitGetAsEntry?.())
    .filter((entry): entry is FileSystemEntry => Boolean(entry));

  if (entries.length === 0) {
    return [];
  }

  const files: VirtualFile[] = [];
  for (const entry of entries) {
    await readWebkitEntry(entry, entry.name, files);
  }
  assertFileCount(files.length);
  return files.sort((a, b) => a.path.localeCompare(b.path));
}

export async function filesFromDirectoryHandle(handle: FileSystemDirectoryHandleLike): Promise<VirtualFile[]> {
  const files: VirtualFile[] = [];
  await readDirectoryHandle(handle, handle.name, files);
  assertFileCount(files.length);
  return files.sort((a, b) => a.path.localeCompare(b.path));
}

async function readDirectoryHandle(
  handle: FileSystemDirectoryHandleLike,
  basePath: string,
  files: VirtualFile[]
): Promise<void> {
  for await (const entry of handle.values()) {
    const path = `${basePath}/${entry.name}`;
    if (entry.kind === "directory") {
      await readDirectoryHandle(entry, path, files);
    } else {
      files.push(await readFile(await entry.getFile(), path));
      assertFileCount(files.length);
    }
  }
}

async function readWebkitEntry(entry: FileSystemEntry, path: string, files: VirtualFile[]): Promise<void> {
  if (entry.isFile) {
    const file = await readWebkitFile(entry as FileSystemFileEntry);
    files.push(await readFile(file, path));
    assertFileCount(files.length);
    return;
  }

  if (entry.isDirectory) {
    const children = await readAllWebkitEntries(entry as FileSystemDirectoryEntry);
    for (const child of children) {
      await readWebkitEntry(child, `${path}/${child.name}`, files);
    }
  }
}

function readWebkitFile(entry: FileSystemFileEntry): Promise<File> {
  return new Promise((resolve, reject) => {
    entry.file(resolve, reject);
  });
}

function readAllWebkitEntries(entry: FileSystemDirectoryEntry): Promise<FileSystemEntry[]> {
  const reader = entry.createReader();
  const entries: FileSystemEntry[] = [];

  return new Promise((resolve, reject) => {
    const readBatch = () => {
      reader.readEntries((batch) => {
        if (batch.length === 0) {
          resolve(entries);
          return;
        }
        entries.push(...batch);
        readBatch();
      }, reject);
    };
    readBatch();
  });
}

async function readFile(file: File, pathOverride?: string): Promise<VirtualFile> {
  const path = normalizePath(pathOverride || (file as File & { webkitRelativePath?: string }).webkitRelativePath || file.name);
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
  const normalized = path.replaceAll("\\", "/").replace(/^\/+/, "");
  const segments = normalized.split("/").filter(Boolean);
  const hasTraversal = segments.some((segment) => segment === "..");
  const hasDrivePrefix = /^[a-z]:\//i.test(normalized);
  if (!normalized || hasTraversal || hasDrivePrefix) {
    throw new Error(`Unsafe import path rejected: ${path}`);
  }
  return normalized;
}

function assertFileCount(count: number): void {
  if (count > MAX_IMPORT_FILES) {
    throw new Error(`Import contains ${count.toLocaleString()} files. Please use a smaller qgis2web export.`);
  }
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
