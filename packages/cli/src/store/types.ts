// One lock or claim file as read at one moment: its inode and its content name that one file, and
// no later file at the same path has both.
export interface LockFileState {
  readonly ino: number;
  readonly content: string;
  readonly mtimeMs: number;
}

// The file calls the store lock makes, passed in so a test can run another writer between any two.
export interface LockFiles {
  // Makes the file with its whole content in one exclusive step; null when the path exists.
  readonly create: (path: string, content: string) => LockFileState | null;
  readonly read: (path: string) => LockFileState | null;
  readonly remove: (path: string) => void;
}

export interface ImportFiles {
  readonly exists: (path: string) => boolean;
  readonly list: (path: string) => string[];
  readonly removeFolder: (path: string) => void;
  readonly removeFile: (path: string) => void;
  readonly makeFolder: (path: string) => void;
  readonly copyFile: (from: string, to: string) => void;
  readonly readMode: (path: string) => number;
  readonly writeFile: (path: string, text: string, mode: number) => void;
  readonly rename: (from: string, to: string) => void;
}
