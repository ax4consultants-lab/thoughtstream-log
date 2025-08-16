import React, { useState, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
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
import { Download, Copy, FileText } from 'lucide-react';
import { JournalEntry } from '@/types/journal';
import { ExportOptions, ExportData } from '@/types/journal';
import { journalDB } from '@/lib/journalDB';
import { useToast } from '@/hooks/use-toast';

interface ExportModalProps {
  children: React.ReactNode;
}

export function ExportModal({ children }: ExportModalProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [entries, setEntries] = useState<JournalEntry[]>([]);
  const [exportOptions, setExportOptions] = useState<ExportOptions>({
    format: 'json',
    includeAudio: false,
    includeTags: true,
  });
  const [preview, setPreview] = useState('');
  const [loading, setLoading] = useState(false);
  
  const { toast } = useToast();

  const loadEntries = useCallback(async () => {
    try {
      setLoading(true);
      const allEntries = await journalDB.getAll();
      setEntries(allEntries);
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
  }, [exportOptions, toast]);

  const generatePreview = useCallback((entries: JournalEntry[], options: ExportOptions) => {
    if (entries.length === 0) {
      setPreview('No entries to export');
      return;
    }

    const exportData: ExportData[] = entries.slice(0, 3).map(entry => ({
      date: entry.timestamp.toISOString().split('T')[0],
      highlights: entry.content.split('.').slice(0, 3).filter(h => h.trim()),
      tags: options.includeTags ? entry.tags : [],
      entry: entry.content,
      timestamp: entry.timestamp.toISOString(),
      ...(options.includeAudio && entry.audioBlob ? { audio: '[Audio data]' } : {})
    }));

    let previewText = '';
    
    switch (options.format) {
      case 'json':
        previewText = JSON.stringify(exportData, null, 2);
        break;
      case 'markdown':
        previewText = exportData.map(data => 
          `# ${data.date}\n\n${data.tags.length > 0 ? `**Tags:** ${data.tags.join(', ')}\n\n` : ''}${data.entry}\n\n---\n`
        ).join('\n');
        break;
      case 'text':
        previewText = exportData.map(data => 
          `Date: ${data.date}\n${data.tags.length > 0 ? `Tags: ${data.tags.join(', ')}\n` : ''}Content: ${data.entry}\n\n`
        ).join('\n');
        break;
    }

    if (entries.length > 3) {
      previewText += `\n... and ${entries.length - 3} more entries`;
    }

    setPreview(previewText);
  }, []);

  const handleExport = useCallback(async (action: 'copy' | 'download') => {
    try {
      setLoading(true);
      const allEntries = await journalDB.getAll();
      
      const exportData: ExportData[] = allEntries.map(entry => ({
        date: entry.timestamp.toISOString().split('T')[0],
        highlights: entry.content.split('.').slice(0, 5).filter(h => h.trim()),
        tags: exportOptions.includeTags ? entry.tags : [],
        entry: entry.content,
        timestamp: entry.timestamp.toISOString(),
        ...(exportOptions.includeAudio && entry.audioBlob ? { 
          audio: '[Audio data - ' + Math.round(entry.audioBlob.size / 1024) + 'KB]' 
        } : {})
      }));

      let content = '';
      let filename = '';
      
      switch (exportOptions.format) {
        case 'json':
          content = JSON.stringify(exportData, null, 2);
          filename = `journal-export-${new Date().toISOString().split('T')[0]}.json`;
          break;
        case 'markdown':
          content = exportData.map(data => 
            `# ${data.date}\n\n${data.tags.length > 0 ? `**Tags:** ${data.tags.join(', ')}\n\n` : ''}${data.entry}\n\n---\n`
          ).join('\n');
          filename = `journal-export-${new Date().toISOString().split('T')[0]}.md`;
          break;
        case 'text':
          content = exportData.map(data => 
            `Date: ${data.date}\n${data.tags.length > 0 ? `Tags: ${data.tags.join(', ')}\n` : ''}Content: ${data.entry}\n\n`
          ).join('\n');
          filename = `journal-export-${new Date().toISOString().split('T')[0]}.txt`;
          break;
      }

      if (action === 'copy') {
        await navigator.clipboard.writeText(content);
        toast({
          title: "Copied to clipboard",
          description: `${allEntries.length} entries copied in ${exportOptions.format.toUpperCase()} format`,
        });
      } else {
        const blob = new Blob([content], { type: 'text/plain' });
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
  }, [exportOptions, toast]);

  const handleOpenChange = useCallback((open: boolean) => {
    setIsOpen(open);
    if (open) {
      loadEntries();
    }
  }, [loadEntries]);

  const handleOptionsChange = useCallback((newOptions: Partial<ExportOptions>) => {
    const updated = { ...exportOptions, ...newOptions };
    setExportOptions(updated);
    generatePreview(entries, updated);
  }, [exportOptions, entries, generatePreview]);

  return (
    <Dialog open={isOpen} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        {children}
      </DialogTrigger>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Export Journal
          </DialogTitle>
        </DialogHeader>
        
        <div className="space-y-6">
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium mb-2 block">Format</label>
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
              <label className="text-sm font-medium">Include</label>
              <div className="space-y-2">
                <div className="flex items-center space-x-2">
                  <Checkbox 
                    id="include-tags"
                    checked={exportOptions.includeTags}
                    onCheckedChange={(checked) => 
                      handleOptionsChange({ includeTags: !!checked })
                    }
                  />
                  <label htmlFor="include-tags" className="text-sm">Tags</label>
                </div>
                <div className="flex items-center space-x-2">
                  <Checkbox 
                    id="include-audio"
                    checked={exportOptions.includeAudio}
                    onCheckedChange={(checked) => 
                      handleOptionsChange({ includeAudio: !!checked })
                    }
                  />
                  <label htmlFor="include-audio" className="text-sm">Audio references</label>
                </div>
              </div>
            </div>
          </div>

          <div>
            <label className="text-sm font-medium mb-2 block">Preview</label>
            <Textarea
              value={preview}
              readOnly
              className="min-h-[200px] font-mono text-xs bg-muted/50"
              placeholder="Export preview will appear here..."
            />
          </div>

          <div className="flex gap-2 pt-4 border-t">
            <Button
              onClick={() => handleExport('copy')}
              disabled={loading || entries.length === 0}
              variant="outline"
              className="flex-1"
            >
              <Copy className="h-4 w-4 mr-2" />
              Copy
            </Button>
            <Button
              onClick={() => handleExport('download')}
              disabled={loading || entries.length === 0}
              className="flex-1 bg-gradient-primary"
            >
              <Download className="h-4 w-4 mr-2" />
              Download
            </Button>
          </div>

          {entries.length > 0 && (
            <div className="text-center">
              <Badge variant="secondary" className="text-xs">
                {entries.length} {entries.length === 1 ? 'entry' : 'entries'} ready for export
              </Badge>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}