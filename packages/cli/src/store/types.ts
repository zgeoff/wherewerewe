// One lock or claim file as read at one moment: its inode and its content name that one file, and
// no later file at the same path has both.
export interface LockFileState {
  readonly ino: number;
  readonly content: string;
  readonly mtimeMs: number;
}

// What the system shows of a pid. `start` is the process start time, null when the system cannot
// give it, such as with no /proc or an unreadable one.
export type ProcessState =
  | { readonly kind: 'gone' }
  | { readonly kind: 'running'; readonly start: string | null };

// The file and process calls the store lock makes, passed in so a test can run another writer
// between any two, or show the lock a system with no /proc.
export interface LockFiles {
  // Makes the file with its whole content in one exclusive step; null when the path exists.
  readonly create: (path: string, content: string) => LockFileState | null;
  readonly read: (path: string) => LockFileState | null;

  // Does nothing when the file is gone.
  readonly remove: (path: string) => void;
  readonly readProcess: (pid: number) => ProcessState;
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

// The three file calls writeOwnerFiles makes, in order, passed in so a test can stop it between
// any two.
export interface OwnerFiles {
  readonly append: (path: string, text: string) => void;

  // Writes and syncs the text to a new temporary file beside the path, and returns its path.
  readonly writeTemporary: (path: string, text: string) => string;
  readonly rename: (from: string, to: string) => void;
}
