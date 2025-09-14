import React, { useState, useCallback, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Card } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Save, X } from 'lucide-react';
import { AudioRecorder } from './AudioRecorder';
import { TagInput } from './TagInput';
import { useToast } from '@/hooks/use-toast';
import { journalDB } from '@/lib/journalDB';
import { transcribeAudio } from '@/lib/utils';
import { JournalEntry as JournalEntryType } from '@/types/journal';
import ax4LogoYellow from '@/assets/ax4-logo-yellow.png';
import ax4LogoMono from '@/assets/ax4-logo-mono.png';

interface JournalEntryProps {
  onEntrySaved?: (entry: JournalEntryType) => void;
}

export function JournalEntry({ onEntrySaved }: JournalEntryProps) {
  const [content, setContent] = useState('');
  const [tags, setTags] = useState<string[]>([]);
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [editingEntry, setEditingEntry] = useState<JournalEntryType | null>(null);
  const [audioRecorderKey, setAudioRecorderKey] = useState(0);
  const [transcribeAfterSave, setTranscribeAfterSave] = useState(false);
  const [isTranscribing, setIsTranscribing] = useState(false);
  
  const { toast } = useToast();

  // Check for edit mode from URL params
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const entryId = urlParams.get('id');
    
    if (entryId) {
      journalDB.getById(entryId).then(entry => {
        if (entry) {
          setEditingEntry(entry);
          setContent(entry.content);
          setTags(entry.tags);
          setAudioBlob(entry.audioBlob || null);
        }
      }).catch(error => {
        console.error('Error loading entry for edit:', error);
        toast({
          title: "Load failed",
          description: "Could not load entry for editing",
          variant: "destructive",
        });
      });
    }
  }, [toast]);

  const handleSave = useCallback(async () => {
    if (!content.trim() && !audioBlob) {
      toast({
        title: "Nothing to save",
        description: "Please add some text or record audio before saving",
        variant: "destructive",
      });
      return;
    }

    setIsSaving(true);
    
    try {
      const now = new Date();
      let transcript: string | undefined;

      // Handle transcription if enabled and audio exists
      if (transcribeAfterSave && audioBlob && !editingEntry) {
        setIsTranscribing(true);
        try {
          transcript = await transcribeAudio(audioBlob);
          toast({
            title: "Audio transcribed",
            description: "Voice note has been converted to text",
          });
        } catch (error) {
          console.error('Transcription failed:', error);
          toast({
            title: "Transcription failed",
            description: "Audio saved but transcription couldn't be completed",
            variant: "destructive",
          });
        } finally {
          setIsTranscribing(false);
        }
      }
      
      if (editingEntry) {
        // Update existing entry
        const updatedEntry: JournalEntryType = {
          ...editingEntry,
          content: content.trim(),
          tags,
          audioBlob: audioBlob || undefined,
          updatedAt: now,
        };
        
        await journalDB.update(updatedEntry);
        
        toast({
          title: "Entry updated",
          description: "Your journal entry has been updated successfully",
        });
        
        // Navigate back to timeline
        window.location.href = '/timeline';
      } else {
        // Create new entry
        const entry: JournalEntryType = {
          id: crypto.randomUUID(),
          content: content.trim(),
          tags,
          timestamp: now,
          audioBlob: audioBlob || undefined,
          transcript,
          createdAt: now,
          updatedAt: now,
        };

        await journalDB.save(entry);
        
        toast({
          title: "Entry saved",
          description: "Your journal entry has been saved successfully",
        });
        
        // Reset form
        setContent('');
        setTags([]);
        setAudioBlob(null);
        setTranscribeAfterSave(false);
        setAudioRecorderKey(prev => prev + 1);
        
        onEntrySaved?.(entry);
      }
    } catch (error) {
      console.error('Error saving entry:', error);
      toast({
        title: editingEntry ? "Update failed" : "Save failed",
        description: `There was an error ${editingEntry ? 'updating' : 'saving'} your entry. Please try again.`,
        variant: "destructive",
      });
    } finally {
      setIsSaving(false);
    }
  }, [content, tags, audioBlob, toast, onEntrySaved, editingEntry, transcribeAfterSave]);

  const handleAudioRecorded = useCallback((blob: Blob) => {
    setAudioBlob(blob);
  }, []);

  const handleRemoveAudio = useCallback(() => {
    setAudioBlob(null);
    setAudioRecorderKey(prev => prev + 1);
  }, []);

  return (
    <div className="max-w-md mx-auto space-y-6 p-4">
      <div className="text-center mb-8">
        <div className="flex items-center justify-center gap-3 mb-2">
          <img 
            src={ax4LogoYellow} 
            alt="AX4 Logo" 
            className="h-10 w-10 dark:hidden"
          />
          <img 
            src={ax4LogoMono} 
            alt="AX4 Logo" 
            className="h-10 w-10 hidden dark:block"
          />
          <h1 className="text-2xl font-bold bg-gradient-primary bg-clip-text text-transparent">
            {editingEntry ? 'Edit Entry' : 'Journal'}
          </h1>
        </div>
        <p className="text-muted-foreground text-sm">
          {editingEntry ? 'Update your journal entry' : 'Capture your thoughts and moments'}
        </p>
        {editingEntry && (
          <Button
            variant="ghost"
            size="sm"
            className="mt-2 text-xs"
            asChild
          >
            <a href="/">
              <X className="h-3 w-3 mr-1" />
              Cancel Edit
            </a>
          </Button>
        )}
      </div>

      <Card className="p-6 space-y-6 shadow-medium border-0 bg-gradient-subtle">
        <TagInput
          tags={tags}
          onTagsChange={setTags}
          placeholder="Add tags (Personal, Work, etc.)"
          disabled={isSaving}
        />

        <div className="space-y-3">
          <label className="text-sm font-medium text-foreground">
            Your thoughts
          </label>
          <Textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder="What's on your mind today?"
            disabled={isSaving}
            className="min-h-[120px] resize-none bg-background/50 border-border/50 focus:bg-background focus:border-primary/50 transition-all duration-300"
          />
        </div>

        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <label className="text-sm font-medium text-foreground">
              Voice note (optional)
            </label>
            {audioBlob && (
              <Button
                variant="ghost"
                size="sm"
                onClick={handleRemoveAudio}
                className="text-xs text-destructive hover:text-destructive"
                disabled={isSaving}
              >
                <X className="h-3 w-3 mr-1" />
                Remove Audio
              </Button>
            )}
          </div>
          <AudioRecorder
            key={audioRecorderKey}
            onAudioRecorded={handleAudioRecorded}
            disabled={isSaving}
            existingAudioBlob={audioBlob}
          />
          
          {audioBlob && !editingEntry && (
            <div className="flex items-center space-x-2 mt-2">
              <Checkbox 
                id="transcribe"
                checked={transcribeAfterSave}
                onCheckedChange={(checked) => setTranscribeAfterSave(checked === true)}
                disabled={isSaving}
              />
              <label 
                htmlFor="transcribe" 
                className="text-sm text-muted-foreground cursor-pointer"
              >
                Transcribe audio after save
              </label>
            </div>
          )}
        </div>

        <Button
          onClick={handleSave}
          disabled={isSaving || isTranscribing || (!content.trim() && !audioBlob)}
          size="lg"
          className="w-full bg-gradient-primary hover:shadow-strong transition-all duration-300 hover:scale-[1.02]"
        >
          <Save className="h-4 w-4 mr-2" />
          {isTranscribing ? 'Transcribing...' : (isSaving ? (editingEntry ? 'Updating...' : 'Saving...') : (editingEntry ? 'Update Entry' : 'Save Entry'))}
        </Button>
      </Card>
    </div>
  );
}