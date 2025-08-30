import React, { useState, useCallback, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ScrollArea } from '@/components/ui/scroll-area';
import { 
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { 
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Download, Copy, FileText, Lock, AlertTriangle, CheckSquare, Square } from 'lucide-react';
import { JournalEntry } from '@/types/journal';
import { ExportOptions, ExportData, EncryptedExport } from '@/types/journal';
import { journalDB } from '@/lib/journalDB';
import { useToast } from '@/hooks/use-toast';

interface ExportModalProps {
  children: React.ReactNode;
}

// Crypto utilities
const blobToBase64 = (blob: Blob): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      resolve(result.split(',')[1]); // Remove data:... prefix
    };
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
};

const deriveKey = async (passphrase: string, salt: Uint8Array): Promise<CryptoKey> => {
  const encoder = new TextEncoder();
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    encoder.encode(passphrase),
    'PBKDF2',
    false,
    ['deriveBits', 'deriveKey']
  );

  return crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt,
      iterations: 100000,
      hash: 'SHA-256'
    },
    keyMaterial,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt']
  );
};

const encryptData = async (data: string, passphrase: string): Promise<EncryptedExport> => {
  const encoder = new TextEncoder();
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const iv = crypto.getRandomValues(new Uint8Array(12));
  
  const key = await deriveKey(passphrase, salt);
  const encrypted = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    key,
    encoder.encode(data)
  );

  return {
    alg: 'AES-GCM',
    kdf: 'PBKDF2-SHA256',
    iterations: 100000,
    salt: btoa(String.fromCharCode(...salt)),
    iv: btoa(String.fromCharCode(...iv)),
    ciphertext: btoa(String.fromCharCode(...new Uint8Array(encrypted))),
    format: 'json' // Will be updated based on actual format
  };
};

export function ExportModal({ children }: ExportModalProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [entries, setEntries] = useState<JournalEntry[]>([]);
  const [selectedEntries, setSelectedEntries] = useState<string[]>([]);
  const [exportOptions, setExportOptions] = useState<ExportOptions>({
    format: 'json',
    includeAudio: false,
    includeTags: true,
    encrypt: false,
  });
  const [passphrase, setPassphrase] = useState('');
  const [confirmPassphrase, setConfirmPassphrase] = useState('');
  const [preview, setPreview] = useState('');
  const [loading, setLoading] = useState(false);
  
  const { toast } = useToast();

  const selectedEntriesData = useMemo(() => {
    return entries.filter(entry => selectedEntries.includes(entry.id));
  }, [entries, selectedEntries]);

  const audioEntriesCount = useMemo(() => {
    return selectedEntriesData.filter(entry => entry.audioBlob).length;
  }, [selectedEntriesData]);

  const loadEntries = useCallback(async () => {
    try {
      setLoading(true);
      const allEntries = await journalDB.getAll();
      setEntries(allEntries);
      setSelectedEntries(allEntries.map(e => e.id)); // Select all by default
      generatePreview(allEntries, exportOptions);
    } catch (error) {
      console.error('Error loading entries:', error);
      toast({
        title: "Loading failed",
        description: "Could not load entries for export",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  const generatePreview = useCallback(async (selectedEntries: JournalEntry[], options: ExportOptions) => {
    if (selectedEntries.length === 0) {
      setPreview('No entries selected for export');
      return;
    }

    const previewEntries = selectedEntries.slice(0, 3);
    const exportData: ExportData[] = await Promise.all(
      previewEntries.map(async (entry) => {
        const data: ExportData = {
          date: entry.timestamp.toISOString().split('T')[0],
          highlights: entry.content.split('.').slice(0, 3).filter(h => h.trim()),
          tags: options.includeTags ? entry.tags : [],
          entry: entry.content,
          timestamp: entry.timestamp.toISOString(),
        };

          if (entry.transcript) {
            data.transcript = entry.transcript;
          }

          if (entry.summary) {
            data.summary = entry.summary;
          }

          if (options.includeAudio && entry.audioBlob) {
            try {
              data.audio = await blobToBase64(entry.audioBlob);
            } catch (error) {
              data.audio = '[Audio conversion failed]';
            }
          }

          return data;
      })
    );

    let previewText = '';
    
    switch (options.format) {
      case 'json':
        previewText = JSON.stringify(exportData, null, 2);
        break;
      case 'markdown':
        previewText = exportData.map(data => {
          let content = `# ${data.date}\n\n${data.tags.length > 0 ? `**Tags:** ${data.tags.join(', ')}\n\n` : ''}${data.entry}`;
          if (data.transcript) content += `\n\n**Transcript:** "${data.transcript}"`;
          if (data.summary) {
            content += `\n\n**AI Summary:**\n- **Highlights:** ${data.summary.highlights.join(', ')}\n- **Mood:** ${data.summary.mood}`;
            if (data.summary.actions.length > 0) content += `\n- **Actions:** ${data.summary.actions.join(', ')}`;
          }
          if (data.audio) content += '\n\n[Audio data included]';
          return content + '\n\n---\n';
        }).join('\n');
        break;
      case 'text':
        previewText = exportData.map(data => {
          let content = `Date: ${data.date}\n${data.tags.length > 0 ? `Tags: ${data.tags.join(', ')}\n` : ''}Content: ${data.entry}`;
          if (data.transcript) content += `\nTranscript: "${data.transcript}"`;
          if (data.summary) content += `\nSummary: ${JSON.stringify(data.summary, null, 2)}`;
          if (data.audio) content += '\nAudio: [Base64 data included]';
          return content + '\n\n';
        }).join('\n');
        break;
    }

    if (selectedEntries.length > 3) {
      previewText += `\n... and ${selectedEntries.length - 3} more entries`;
    }

    if (options.encrypt && passphrase) {
      previewText = '[Encrypted export - preview not available]';
    }

    setPreview(previewText);
  }, [passphrase]);

  const handleExport = useCallback(async (action: 'copy' | 'download') => {
    try {
      setLoading(true);
      
      // Validation
      if (selectedEntries.length === 0) {
        toast({
          title: "No entries selected",
          description: "Please select at least one entry to export",
          variant: "destructive",
        });
        return;
      }

      if (exportOptions.encrypt && (!passphrase || passphrase !== confirmPassphrase)) {
        toast({
          title: "Passphrase error",
          description: "Please enter and confirm your passphrase",
          variant: "destructive",
        });
        return;
      }

      const entriesToExport = selectedEntriesData;
      
      const exportData: ExportData[] = await Promise.all(
        entriesToExport.map(async (entry) => {
          const data: ExportData = {
            date: entry.timestamp.toISOString().split('T')[0],
            highlights: entry.content.split('.').slice(0, 5).filter(h => h.trim()),
            tags: exportOptions.includeTags ? entry.tags : [],
            entry: entry.content,
            timestamp: entry.timestamp.toISOString(),
          };

          if (entry.transcript) {
            data.transcript = entry.transcript;
          }

          if (entry.summary) {
            data.summary = entry.summary;
          }

          if (exportOptions.includeAudio && entry.audioBlob) {
            try {
              data.audio = await blobToBase64(entry.audioBlob);
            } catch (error) {
              console.error('Audio conversion failed:', error);
              data.audio = '[Audio conversion failed]';
            }
          }

          return data;
        })
      );

      let content = '';
      let filename = '';
      let mimeType = 'text/plain';
      
      switch (exportOptions.format) {
        case 'json':
          content = JSON.stringify(exportData, null, 2);
          filename = `journal-export-${new Date().toISOString().split('T')[0]}.json`;
          mimeType = 'application/json';
          break;
        case 'markdown':
          content = exportData.map(data => {
            let content = `# ${data.date}\n\n${data.tags.length > 0 ? `**Tags:** ${data.tags.join(', ')}\n\n` : ''}${data.entry}`;
            if (data.transcript) content += `\n\n**Transcript:** "${data.transcript}"`;
            if (data.summary) {
              content += `\n\n**AI Summary:**\n- **Highlights:** ${data.summary.highlights.join(', ')}\n- **Mood:** ${data.summary.mood}`;
              if (data.summary.actions.length > 0) content += `\n- **Actions:** ${data.summary.actions.join(', ')}`;
            }
            if (data.audio) content += '\n\n[Audio data included]';
            return content + '\n\n---\n';
          }).join('\n');
          filename = `journal-export-${new Date().toISOString().split('T')[0]}.md`;
          mimeType = 'text/markdown';
          break;
        case 'text':
          content = exportData.map(data => {
            let content = `Date: ${data.date}\n${data.tags.length > 0 ? `Tags: ${data.tags.join(', ')}\n` : ''}Content: ${data.entry}`;
            if (data.transcript) content += `\nTranscript: "${data.transcript}"`;
            if (data.summary) content += `\nSummary: ${JSON.stringify(data.summary, null, 2)}`;
            if (data.audio) content += '\nAudio: [Base64 data included]';
            return content + '\n\n';
          }).join('\n');
          filename = `journal-export-${new Date().toISOString().split('T')[0]}.txt`;
          break;
      }

      // Handle encryption
      if (exportOptions.encrypt && passphrase) {
        const encrypted = await encryptData(content, passphrase);
        encrypted.format = exportOptions.format;
        content = JSON.stringify(encrypted, null, 2);
        filename = filename.replace(/\.(json|md|txt)$/, '.encrypted.json');
        mimeType = 'application/json';
      }

      if (action === 'copy') {
        await navigator.clipboard.writeText(content);
        toast({
          title: "Copied to clipboard",
          description: `${selectedEntries.length} entries copied${exportOptions.encrypt ? ' (encrypted)' : ''}`,
        });
      } else {
        const blob = new Blob([content], { type: mimeType });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        
        toast({
          title: "Download started",
          description: `Downloading ${filename}`,
        });
      }
    } catch (error) {
      console.error('Export failed:', error);
      toast({
        title: "Export failed",
        description: "Could not export your entries. Please try again.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  }, [selectedEntries, selectedEntriesData, exportOptions, passphrase, confirmPassphrase, toast]);

  const handleOpenChange = useCallback((open: boolean) => {
    setIsOpen(open);
    if (open) {
      loadEntries();
    } else {
      // Reset form when closing
      setPassphrase('');
      setConfirmPassphrase('');
      setSelectedEntries([]);
    }
  }, [loadEntries]);

  const handleOptionsChange = useCallback((newOptions: Partial<ExportOptions>) => {
    const updated = { ...exportOptions, ...newOptions };
    setExportOptions(updated);
    generatePreview(selectedEntriesData, updated);
  }, [exportOptions, selectedEntriesData, generatePreview]);

  const handleSelectAll = useCallback(() => {
    if (selectedEntries.length === entries.length) {
      setSelectedEntries([]);
    } else {
      setSelectedEntries(entries.map(e => e.id));
    }
  }, [selectedEntries.length, entries]);

  const handleEntrySelect = useCallback((entryId: string, checked: boolean) => {
    if (checked) {
      setSelectedEntries(prev => [...prev, entryId]);
    } else {
      setSelectedEntries(prev => prev.filter(id => id !== entryId));
    }
  }, []);

  // Update preview when selections change
  React.useEffect(() => {
    if (selectedEntriesData.length > 0) {
      generatePreview(selectedEntriesData, exportOptions);
    }
  }, [selectedEntriesData, exportOptions, generatePreview]);

  return (
    <Dialog open={isOpen} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        {children}
      </DialogTrigger>
      <DialogContent className="max-w-2xl max-h-[95vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Export Journal
          </DialogTitle>
        </DialogHeader>
        
        <ScrollArea className="flex-1 pr-4">
          <div className="space-y-6">
            {/* Entry Selection */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label className="text-sm font-medium">Select Entries</Label>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleSelectAll}
                  className="h-auto p-1 text-xs"
                >
                  {selectedEntries.length === entries.length ? (
                    <>
                      <CheckSquare className="h-3 w-3 mr-1" />
                      Deselect All
                    </>
                  ) : (
                    <>
                      <Square className="h-3 w-3 mr-1" />
                      Select All
                    </>
                  )}
                </Button>
              </div>
              
              <Card className="p-3 max-h-32 overflow-y-auto">
                {loading ? (
                  <div className="text-sm text-muted-foreground">Loading entries...</div>
                ) : entries.length === 0 ? (
                  <div className="text-sm text-muted-foreground">No entries found</div>
                ) : (
                  <div className="space-y-2">
                    {entries.map((entry) => (
                      <div key={entry.id} className="flex items-center space-x-2">
                        <Checkbox
                          id={`entry-${entry.id}`}
                          checked={selectedEntries.includes(entry.id)}
                          onCheckedChange={(checked) =>
                            handleEntrySelect(entry.id, !!checked)
                          }
                        />
                        <Label
                          htmlFor={`entry-${entry.id}`}
                          className="text-xs flex-1 cursor-pointer"
                        >
                          {entry.timestamp.toLocaleDateString()} - {entry.content.slice(0, 50)}...
                          {entry.audioBlob && <Badge variant="outline" className="ml-2 text-xs">Audio</Badge>}
                        </Label>
                      </div>
                    ))}
                  </div>
                )}
              </Card>
              
              <div className="flex items-center gap-4 text-xs text-muted-foreground">
                <span>{selectedEntries.length} entries selected</span>
                {exportOptions.includeAudio && audioEntriesCount > 0 && (
                  <span>{audioEntriesCount} with audio</span>
                )}
              </div>
              
              {exportOptions.includeAudio && audioEntriesCount > 10 && (
                <div className="flex items-center gap-2 p-2 bg-amber-50 dark:bg-amber-950/20 rounded-md border border-amber-200 dark:border-amber-800">
                  <AlertTriangle className="h-4 w-4 text-amber-600" />
                  <span className="text-xs text-amber-800 dark:text-amber-200">
                    Warning: {audioEntriesCount} entries with audio may create a large file
                  </span>
                </div>
              )}
            </div>

            {/* Export Options */}
            <div className="space-y-4">
              <div>
                <Label className="text-sm font-medium mb-2 block">Format</Label>
                <Select 
                  value={exportOptions.format} 
                  onValueChange={(format: 'json' | 'markdown' | 'text') => 
                    handleOptionsChange({ format })
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="json">JSON (for GPT analysis)</SelectItem>
                    <SelectItem value="markdown">Markdown (.md)</SelectItem>
                    <SelectItem value="text">Plain Text (.txt)</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-3">
                <Label className="text-sm font-medium">Include</Label>
                <div className="space-y-2">
                  <div className="flex items-center space-x-2">
                    <Checkbox 
                      id="include-tags"
                      checked={exportOptions.includeTags}
                      onCheckedChange={(checked) => 
                        handleOptionsChange({ includeTags: !!checked })
                      }
                    />
                    <Label htmlFor="include-tags" className="text-sm">Tags</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Checkbox 
                      id="include-audio"
                      checked={exportOptions.includeAudio}
                      onCheckedChange={(checked) => 
                        handleOptionsChange({ includeAudio: !!checked })
                      }
                    />
                    <Label htmlFor="include-audio" className="text-sm">Audio (Base64 encoded)</Label>
                  </div>
                </div>
              </div>
            </div>

            {/* Encryption Options */}
            <div className="space-y-4 p-4 border rounded-lg bg-muted/30">
              <div className="flex items-center space-x-2">
                <Checkbox 
                  id="encrypt-export"
                  checked={exportOptions.encrypt}
                  onCheckedChange={(checked) => 
                    handleOptionsChange({ encrypt: !!checked })
                  }
                />
                <Label htmlFor="encrypt-export" className="text-sm flex items-center gap-2">
                  <Lock className="h-4 w-4" />
                  Encrypt export with passphrase
                </Label>
              </div>
              
              {exportOptions.encrypt && (
                <div className="space-y-3 pl-6">
                  <div>
                    <Label htmlFor="passphrase" className="text-sm">Passphrase</Label>
                    <Input
                      id="passphrase"
                      type="password"
                      value={passphrase}
                      onChange={(e) => setPassphrase(e.target.value)}
                      placeholder="Enter encryption passphrase"
                      className="mt-1"
                    />
                  </div>
                  <div>
                    <Label htmlFor="confirm-passphrase" className="text-sm">Confirm Passphrase</Label>
                    <Input
                      id="confirm-passphrase"
                      type="password"
                      value={confirmPassphrase}
                      onChange={(e) => setConfirmPassphrase(e.target.value)}
                      placeholder="Confirm passphrase"
                      className="mt-1"
                    />
                    {passphrase && confirmPassphrase && passphrase !== confirmPassphrase && (
                      <span className="text-xs text-red-600 mt-1 block">Passphrases don't match</span>
                    )}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    Uses AES-GCM encryption with PBKDF2-SHA256 key derivation (100k iterations)
                  </div>
                </div>
              )}
            </div>

            {/* Preview */}
            <div>
              <Label className="text-sm font-medium mb-2 block">Preview</Label>
              <Textarea
                value={preview}
                readOnly
                className="min-h-[150px] font-mono text-xs bg-muted/50"
                placeholder="Export preview will appear here..."
              />
            </div>
          </div>
        </ScrollArea>

        {/* Actions */}
        <div className="pt-4 border-t">
          <div className="flex gap-2">
            <Button
              onClick={() => handleExport('copy')}
              disabled={loading || selectedEntries.length === 0}
              variant="outline"
              className="flex-1"
            >
              <Copy className="h-4 w-4 mr-2" />
              Copy
            </Button>
            <Button
              onClick={() => handleExport('download')}
              disabled={loading || selectedEntries.length === 0}
              className="flex-1 bg-gradient-primary"
            >
              <Download className="h-4 w-4 mr-2" />
              Download
            </Button>
          </div>
          
          {selectedEntries.length > 0 && (
            <div className="text-center mt-3">
              <Badge variant="secondary" className="text-xs">
                {selectedEntries.length} {selectedEntries.length === 1 ? 'entry' : 'entries'} selected
                {exportOptions.encrypt && ' • Encrypted'}
              </Badge>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}