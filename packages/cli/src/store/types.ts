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

// The file calls an import makes, passed in so a test can stop it between any two.
export interface ImportFiles {
  readonly exists: (path: string) => boolean;

  // the names in a folder
  readonly list: (path: string) => string[];

  // removes a folder and all it holds, or nothing when it is gone
  readonly removeFolder: (path: string) => void;
  readonly makeFolder: (path: string) => void;

  // copies the bytes of a file into a new file and syncs it
  readonly copyFile: (from: string, to: string) => void;

  // makes a new file with the whole text and syncs it
  readonly writeFile: (path: string, text: string) => void;
  readonly rename: (from: string, to: string) => void;
}
