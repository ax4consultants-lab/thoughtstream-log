export interface JournalEntry {
  id: string;
  content: string;
  tags: string[];
  timestamp: Date;
  audioBlob?: Blob;
  audioUrl?: string;
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
  dateRange?: {
    start: Date;
    end: Date;
  };
}

export interface ExportData {
  date: string;
  highlights: string[];
  tags: string[];
  entry: string;
  audio?: string; // Base64 encoded audio
  timestamp: string;
}