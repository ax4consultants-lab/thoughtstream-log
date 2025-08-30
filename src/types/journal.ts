export interface JournalEntry {
  id: string;
  content: string;
  tags: string[];
  timestamp: Date;
  audioBlob?: Blob;
  audioUrl?: string;
  transcript?: string;
  summary?: {
    highlights: string[];
    decisions: string[];
    actions: string[];
    risks: string[];
    mood: string;
  };
  createdAt: Date;
  updatedAt: Date;
}

export interface JournalStats {
  totalEntries: number;
  totalStorageSize: number;
  oldestEntry?: Date;
  newestEntry?: Date;
}

export interface ExportOptions {
  format: 'json' | 'markdown' | 'text';
  includeAudio: boolean;
  includeTags: boolean;
  selectedEntries?: string[]; // Entry IDs to export
  encrypt?: boolean;
  passphrase?: string;
  dateRange?: {
    start: Date;
    end: Date;
  };
}

export interface EncryptedExport {
  alg: 'AES-GCM';
  kdf: 'PBKDF2-SHA256';
  iterations: number;
  salt: string; // base64
  iv: string; // base64
  ciphertext: string; // base64
  format: 'json' | 'markdown' | 'text';
}

export interface ExportData {
  date: string;
  highlights: string[];
  tags: string[];
  entry: string;
  audio?: string; // Base64 encoded audio
  transcript?: string;
  summary?: {
    highlights: string[];
    decisions: string[];
    actions: string[];
    risks: string[];
    mood: string;
  };
  timestamp: string;
}