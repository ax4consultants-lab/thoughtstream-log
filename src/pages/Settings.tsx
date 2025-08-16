import React, { useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
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
  HardDrive
} from 'lucide-react';
import { journalDB } from '@/lib/journalDB';
import { JournalStats } from '@/types/journal';
import { useToast } from '@/hooks/use-toast';
import { ExportModal } from '@/components/ExportModal';

export function Settings() {
  const [stats, setStats] = useState<JournalStats>({
    totalEntries: 0,
    totalStorageSize: 0
  });
  const [loading, setLoading] = useState(true);
  const [clearing, setClearing] = useState(false);
  
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
  }, [loadStats]);

  const handleClearAll = useCallback(async () => {
    try {
      setClearing(true);
      await journalDB.clear();
      setStats({
        totalEntries: 0,
        totalStorageSize: 0
      });
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
  }, [toast]);

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

  const handleEncryptionPlaceholder = () => {
    toast({
      title: "Coming soon",
      description: "Local encryption will be available in a future update",
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

          <Button 
            variant="outline" 
            className="w-full justify-start gap-3"
            onClick={handleEncryptionPlaceholder}
          >
            <Shield className="h-4 w-4" />
            Enable Encryption
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