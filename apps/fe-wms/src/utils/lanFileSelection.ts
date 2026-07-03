export interface SelectedLanFile {
  id: string;
  file: File;
  path: string;
}

type FileSystemEntryLike = {
  isFile: boolean;
  isDirectory: boolean;
  name: string;
};

type FileSystemFileEntryLike = FileSystemEntryLike & {
  file: (success: (file: File) => void, error?: (error: unknown) => void) => void;
};

type FileSystemDirectoryEntryLike = FileSystemEntryLike & {
  createReader: () => {
    readEntries: (
      success: (entries: FileSystemEntryLike[]) => void,
      error?: (error: unknown) => void,
    ) => void;
  };
};

type DataTransferItemWithEntry = {
  webkitGetAsEntry?: () => unknown;
};

function selectedFileId(file: File, index: number, path: string) {
  const suffix =
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  return `${file.name}-${file.size}-${file.lastModified}-${index}-${path}-${suffix}`;
}

function filePath(file: File) {
  return (file as File & { webkitRelativePath?: string }).webkitRelativePath || file.name;
}

export function fileListToSelectedFiles(fileList: FileList | null) {
  if (!fileList) return [];
  return Array.from(fileList).map((file, index) => {
    const path = filePath(file);
    return { id: selectedFileId(file, index, path), file, path };
  });
}

function readFileEntry(entry: FileSystemFileEntryLike, path: string) {
  return new Promise<SelectedLanFile[]>((resolve, reject) => {
    entry.file(
      (file) => {
        resolve([
          {
            id: selectedFileId(file, 0, path),
            file,
            path,
          },
        ]);
      },
      reject,
    );
  });
}

function readDirectoryEntries(
  entry: FileSystemDirectoryEntryLike,
  path: string,
): Promise<SelectedLanFile[]> {
  const reader = entry.createReader();
  const allEntries: FileSystemEntryLike[] = [];

  return new Promise<FileSystemEntryLike[]>((resolve, reject) => {
    const readBatch = () => {
      reader.readEntries((entries) => {
        if (entries.length === 0) {
          resolve(allEntries);
          return;
        }
        allEntries.push(...entries);
        readBatch();
      }, reject);
    };
    readBatch();
  }).then((entries) =>
    Promise.all(entries.map((child) => readEntry(child, `${path}/${child.name}`))),
  ).then((groups) => groups.flat());
}

function readEntry(entry: FileSystemEntryLike, path: string): Promise<SelectedLanFile[]> {
  if (entry.isFile) return readFileEntry(entry as FileSystemFileEntryLike, path);
  if (entry.isDirectory) {
    return readDirectoryEntries(entry as FileSystemDirectoryEntryLike, path);
  }
  return Promise.resolve([]);
}

export async function dataTransferToSelectedFiles(dataTransfer: DataTransfer) {
  const items = Array.from(dataTransfer.items || []);
  const entries = items
    .map(
      (item) =>
        (item as unknown as DataTransferItemWithEntry).webkitGetAsEntry?.() || null,
    )
    .filter((entry): entry is FileSystemEntryLike => Boolean(entry));

  if (entries.length === 0) return fileListToSelectedFiles(dataTransfer.files);

  const groups = await Promise.all(
    entries.map((entry) => readEntry(entry, entry.name)),
  );
  return groups.flat();
}

export function selectedToFiles(items: SelectedLanFile[]) {
  return items.map((item) => item.file);
}
