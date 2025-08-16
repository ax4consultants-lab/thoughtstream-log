import React, { useState, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Card } from '@/components/ui/card';
import { Save, BookOpen } from 'lucide-react';
import { AudioRecorder } from './AudioRecorder';
import { TagInput } from './TagInput';
import { useToast } from '@/hooks/use-toast';
import { journalDB } from '@/lib/journalDB';
import { JournalEntry as JournalEntryType } from '@/types/journal';

interface JournalEntryProps {
  onEntrySaved?: (entry: JournalEntryType) => void;
}

export function JournalEntry({ onEntrySaved }: JournalEntryProps) {
  const [content, setContent] = useState('');
  const [tags, setTags] = useState<string[]>([]);
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  
  const { toast } = useToast();

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
      const entry: JournalEntryType = {
        id: crypto.randomUUID(),
        content: content.trim(),
        tags,
        timestamp: now,
        audioBlob: audioBlob || undefined,
        audioUrl: audioBlob ? URL.createObjectURL(audioBlob) : undefined,
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
      
      onEntrySaved?.(entry);
    } catch (error) {
      console.error('Error saving entry:', error);
      toast({
        title: "Save failed",
        description: "There was an error saving your entry. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsSaving(false);
    }
  }, [content, tags, audioBlob, toast, onEntrySaved]);

  const handleAudioRecorded = useCallback((blob: Blob) => {
    setAudioBlob(blob);
  }, []);

  return (
    <div className="max-w-md mx-auto space-y-6 p-4">
      <div className="text-center mb-8">
        <div className="flex items-center justify-center gap-3 mb-2">
          <BookOpen className="h-8 w-8 text-primary" />
          <h1 className="text-2xl font-bold bg-gradient-primary bg-clip-text text-transparent">
            Journal
          </h1>
        </div>
        <p className="text-muted-foreground text-sm">
          Capture your thoughts and moments
        </p>
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
          <label className="text-sm font-medium text-foreground">
            Voice note (optional)
          </label>
          <AudioRecorder
            onAudioRecorded={handleAudioRecorded}
            disabled={isSaving}
          />
        </div>

        <Button
          onClick={handleSave}
          disabled={isSaving || (!content.trim() && !audioBlob)}
          size="lg"
          className="w-full bg-gradient-primary hover:shadow-strong transition-all duration-300 hover:scale-[1.02]"
        >
          <Save className="h-4 w-4 mr-2" />
          {isSaving ? 'Saving...' : 'Save Entry'}
        </Button>
      </Card>
    </div>
  );
}