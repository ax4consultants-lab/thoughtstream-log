import React, { useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { 
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { 
  Settings as SettingsIcon, 
  Trash2, 
  Database, 
  Download, 
  Shield,
  Cloud,
  HardDrive,
  Key,
  Brain,
  Copy,
  Calendar
} from 'lucide-react';
import { journalDB } from '@/lib/journalDB';
import { JournalStats, JournalEntry } from '@/types/journal';
import { useToast } from '@/hooks/use-toast';
import { ExportModal } from '@/components/ExportModal';
import { compileWeeklyDigest } from '@/lib/summarise';

export function Settings() {
  const [stats, setStats] = useState<JournalStats>({
    totalEntries: 0,
    totalStorageSize: 0
  });
  const [loading, setLoading] = useState(true);
  const [clearing, setClearing] = useState(false);
  const [apiKey, setApiKey] = useState('');
  const [showApiKey, setShowApiKey] = useState(false);
  const [weeklyDigest, setWeeklyDigest] = useState('');
  const [digestLoading, setDigestLoading] = useState(false);
  const [gptDigest, setGptDigest] = useState('');
  const [gptDigestLoading, setGptDigestLoading] = useState(false);
  
  const { toast } = useToast();

  const loadStats = useCallback(async () => {
    try {
      setLoading(true);
      const journalStats = await journalDB.getStats();
      setStats(journalStats);
    } catch (error) {
      console.error('Error loading stats:', error);
      toast({
        title: "Stats loading failed",
        description: "Could not load journal statistics",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    loadStats();
    // Load API key from localStorage
    const storedKey = localStorage.getItem('OPENAI_API_KEY');
    if (storedKey) {
      setApiKey(storedKey);
    }
  }, [loadStats]);

  const handleClearAll = useCallback(async () => {
    try {
      setClearing(true);
      await journalDB.clear();
      
      // Refresh stats after clearing
      await loadStats();
      
      toast({
        title: "Data cleared",
        description: "All journal entries have been permanently deleted",
      });
    } catch (error) {
      console.error('Error clearing data:', error);
      toast({
        title: "Clear failed",
        description: "Could not clear journal data. Please try again.",
        variant: "destructive",
      });
    } finally {
      setClearing(false);
    }
  }, [toast, loadStats]);

  const formatStorageSize = (bytes: number) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  };

  const handleBackupPlaceholder = () => {
    toast({
      title: "Coming soon",
      description: "Cloud backup will be available in a future update",
    });
  };

  const handleSaveApiKey = () => {
    if (apiKey.trim()) {
      localStorage.setItem('OPENAI_API_KEY', apiKey.trim());
      toast({
        title: "API Key saved",
        description: "OpenAI API key has been saved securely",
      });
    } else {
      localStorage.removeItem('OPENAI_API_KEY');
      toast({
        title: "API Key cleared",
        description: "OpenAI API key has been removed",
      });
    }
  };

  const maskApiKey = (key: string) => {
    if (!key) return '';
    if (key.length < 8) return '*'.repeat(key.length);
    return key.substring(0, 3) + '*'.repeat(key.length - 7) + key.substring(key.length - 4);
  };

  const generateWeeklyDigest = async () => {
    try {
      setDigestLoading(true);
      const entries = await journalDB.getAll();
      
      // Get entries from last 7 days
      const weekAgo = new Date();
      weekAgo.setDate(weekAgo.getDate() - 7);
      
      const weeklyEntries = entries.filter(entry => 
        new Date(entry.createdAt) >= weekAgo
      );

      if (weeklyEntries.length === 0) {
        toast({
          title: "No entries found",
          description: "No journal entries from the last 7 days",
        });
        return;
      }

      // Generate digest
      const allTags = [...new Set(weeklyEntries.flatMap(e => e.tags))];
      const highlights = weeklyEntries
        .map(e => e.content.split('\n')[0])
        .filter(h => h.length > 10)
        .slice(0, 5);

      const digestMarkdown = `# Weekly Journal Digest
## ${weekAgo.toDateString()} - ${new Date().toDateString()}

### Summary
- **Total Entries**: ${weeklyEntries.length}
- **Active Tags**: ${allTags.join(', ')}
- **Average Entry Length**: ${Math.round(weeklyEntries.reduce((acc, e) => acc + e.content.length, 0) / weeklyEntries.length)} chars

### Highlights
${highlights.map(h => `- ${h}`).join('\n')}

### All Entries
${weeklyEntries.map(e => `**${e.createdAt.toLocaleDateString()}**: ${e.content.substring(0, 100)}...`).join('\n\n')}

### JSON Export for AI Analysis
\`\`\`json
${JSON.stringify({
  period: { start: weekAgo.toISOString(), end: new Date().toISOString() },
  entries: weeklyEntries.map(e => ({
    date: e.createdAt.toISOString(),
    content: e.content,
    tags: e.tags,
    transcript: e.transcript
  }))
}, null, 2)}
\`\`\``;

      setWeeklyDigest(digestMarkdown);
    } catch (error) {
      console.error('Error generating digest:', error);
      toast({
        title: "Digest failed",
        description: "Could not generate weekly digest",
        variant: "destructive",
      });
    } finally {
      setDigestLoading(false);
    }
  };

  const copyWeeklyDigest = () => {
    navigator.clipboard.writeText(weeklyDigest);
    toast({
      title: "Copied to clipboard",
      description: "Weekly digest copied successfully",
    });
  };

  const generateGptDigest = async () => {
    try {
      setGptDigestLoading(true);
      const entries = await journalDB.getAll();
      
      // Get entries from last 7 days
      const weekAgo = new Date();
      weekAgo.setDate(weekAgo.getDate() - 7);
      
      const weeklyEntries = entries.filter(entry => 
        new Date(entry.createdAt) >= weekAgo
      );

      if (weeklyEntries.length === 0) {
        toast({
          title: "No entries found",
          description: "No journal entries from the last 7 days",
        });
        return;
      }

      const digest = await compileWeeklyDigest(weeklyEntries);
      setGptDigest(digest);
    } catch (error) {
      console.error('GPT digest generation failed:', error);
      toast({
        title: "GPT Digest failed", 
        description: error instanceof Error ? error.message : "Could not generate GPT digest",
        variant: "destructive",
      });
    } finally {
      setGptDigestLoading(false);
    }
  };

  const copyGptDigest = () => {
    navigator.clipboard.writeText(gptDigest);
    toast({
      title: "Copied to clipboard",
      description: "GPT digest copied successfully",
    });
  };

  return (
    <div className="max-w-md mx-auto p-4 pb-20 space-y-6">
      <div className="text-center mb-6">
        <div className="flex items-center justify-center gap-3 mb-2">
          <SettingsIcon className="h-8 w-8 text-primary" />
          <h1 className="text-2xl font-bold bg-gradient-primary bg-clip-text text-transparent">
            Settings
          </h1>
        </div>
        <p className="text-muted-foreground text-sm">
          Manage your journal data and preferences
        </p>
      </div>

      {/* Storage Stats */}
      <Card className="p-4 space-y-4 shadow-soft">
        <div className="flex items-center gap-2 mb-3">
          <Database className="h-5 w-5 text-primary" />
          <h2 className="font-semibold">Storage Statistics</h2>
        </div>
        
        {loading ? (
          <div className="space-y-2">
            <div className="h-4 bg-muted rounded animate-pulse"></div>
            <div className="h-4 bg-muted rounded w-2/3 animate-pulse"></div>
          </div>
        ) : (
          <div className="space-y-3">
            <div className="flex justify-between items-center">
              <span className="text-sm text-muted-foreground">Total Entries</span>
              <Badge variant="secondary">{stats.totalEntries}</Badge>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm text-muted-foreground">Storage Used</span>
              <Badge variant="secondary">{formatStorageSize(stats.totalStorageSize)}</Badge>
            </div>
            {stats.oldestEntry && (
              <>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-muted-foreground">First Entry</span>
                  <span className="text-sm">{stats.oldestEntry.toLocaleDateString()}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-muted-foreground">Latest Entry</span>
                  <span className="text-sm">{stats.newestEntry?.toLocaleDateString()}</span>
                </div>
              </>
            )}
          </div>
        )}
      </Card>

      {/* API Key Management */}
      <Card className="p-4 space-y-4 shadow-soft">
        <div className="flex items-center gap-2 mb-3">
          <Key className="h-5 w-5 text-primary" />
          <h2 className="font-semibold">OpenAI Integration</h2>
        </div>
        
        <div className="space-y-3">
          <div>
            <Label htmlFor="apiKey">API Key</Label>
            <div className="flex gap-2">
              <Input
                id="apiKey"
                type={showApiKey ? "text" : "password"}
                placeholder="sk-..."
                value={showApiKey ? apiKey : maskApiKey(apiKey)}
                onChange={(e) => setApiKey(e.target.value)}
                className="flex-1"
              />
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowApiKey(!showApiKey)}
              >
                {showApiKey ? "Hide" : "Show"}
              </Button>
            </div>
          </div>
          
          <div className="flex gap-2">
            <Button onClick={handleSaveApiKey} className="flex-1">
              Save Key
            </Button>
            <Button 
              variant="outline" 
              onClick={() => { setApiKey(''); handleSaveApiKey(); }}
            >
              Clear
            </Button>
          </div>
          
          <p className="text-xs text-muted-foreground">
            API key enables automatic audio transcription via Whisper
          </p>
        </div>
      </Card>

      {/* Weekly Digest */}
      <Card className="p-4 space-y-4 shadow-soft">
        <div className="flex items-center gap-2 mb-3">
          <Calendar className="h-5 w-5 text-primary" />
          <h2 className="font-semibold">Weekly Insights</h2>
        </div>
        
        <div className="space-y-2">
          <Dialog>
            <DialogTrigger asChild>
              <Button 
                variant="outline" 
                className="w-full justify-start gap-3"
                onClick={generateWeeklyDigest}
                disabled={digestLoading}
              >
                <Calendar className="h-4 w-4" />
                {digestLoading ? 'Generating...' : 'Generate Weekly Digest'}
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>Weekly Journal Digest</DialogTitle>
                <DialogDescription>
                  Summary of your journal entries from the last 7 days
                </DialogDescription>
              </DialogHeader>
              
              {weeklyDigest && (
                <div className="space-y-4">
                  <div className="flex justify-end">
                    <Button onClick={copyWeeklyDigest} size="sm" variant="outline">
                      <Copy className="h-4 w-4 mr-2" />
                      Copy Digest
                    </Button>
                  </div>
                  <pre className="whitespace-pre-wrap text-sm bg-muted p-4 rounded-md overflow-x-auto">
                    {weeklyDigest}
                  </pre>
                </div>
              )}
            </DialogContent>
          </Dialog>

          <Dialog>
            <DialogTrigger asChild>
              <Button 
                variant="outline" 
                className="w-full justify-start gap-3"
                onClick={generateGptDigest}
                disabled={gptDigestLoading}
              >
                <Brain className="h-4 w-4" />
                {gptDigestLoading ? 'Generating...' : 'Generate GPT Digest'}
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>AI-Powered Weekly Digest</DialogTitle>
                <DialogDescription>
                  Intelligent analysis of your journal entries from the last 7 days
                </DialogDescription>
              </DialogHeader>
              
              {gptDigest && (
                <div className="space-y-4">
                  <div className="flex justify-end">
                    <Button onClick={copyGptDigest} size="sm" variant="outline">
                      <Copy className="h-4 w-4 mr-2" />
                      Copy GPT Digest
                    </Button>
                  </div>
                  <div className="prose prose-sm max-w-none bg-muted p-4 rounded-md overflow-x-auto">
                    <pre className="whitespace-pre-wrap font-sans text-sm">
                      {gptDigest}
                    </pre>
                  </div>
                </div>
              )}
            </DialogContent>
          </Dialog>
        </div>
      </Card>

      {/* Data Management */}
      <Card className="p-4 space-y-4 shadow-soft">
        <div className="flex items-center gap-2 mb-3">
          <HardDrive className="h-5 w-5 text-primary" />
          <h2 className="font-semibold">Data Management</h2>
        </div>
        
        <div className="space-y-3">
          <ExportModal>
            <Button 
              variant="outline" 
              className="w-full justify-start gap-3"
            >
              <Download className="h-4 w-4" />
              Export Journal Data
            </Button>
          </ExportModal>

          <Button 
            variant="outline" 
            className="w-full justify-start gap-3"
            onClick={handleBackupPlaceholder}
          >
            <Cloud className="h-4 w-4" />
            Backup to Cloud
            <Badge variant="secondary" className="ml-auto text-xs">Soon</Badge>
          </Button>
        </div>
      </Card>

      {/* Danger Zone */}
      <Card className="p-4 space-y-4 shadow-soft border-destructive/20">
        <div className="flex items-center gap-2 mb-3">
          <Trash2 className="h-5 w-5 text-destructive" />
          <h2 className="font-semibold text-destructive">Danger Zone</h2>
        </div>
        
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button 
              variant="outline" 
              className="w-full justify-start gap-3 border-destructive/50 text-destructive hover:bg-destructive/10"
              disabled={clearing || stats.totalEntries === 0}
            >
              <Trash2 className="h-4 w-4" />
              {clearing ? 'Clearing...' : 'Clear All Data'}
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
              <AlertDialogDescription>
                This action cannot be undone. This will permanently delete all {stats.totalEntries} journal entries 
                and remove all data from your device.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction 
                onClick={handleClearAll}
                className="bg-destructive hover:bg-destructive/90"
              >
                Delete Everything
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </Card>

      <div className="text-center pt-4">
        <p className="text-xs text-muted-foreground">
          All data is stored locally on your device
        </p>
      </div>
    </div>
  );
}