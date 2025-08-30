import React, { useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { 
  ChevronDown, 
  ChevronUp, 
  Play, 
  Pause, 
  Edit3, 
  Trash2, 
  Clock,
  Calendar,
  Copy,
  Download,
  Bot,
  Sparkles,
  Loader2
} from 'lucide-react';
import { JournalEntry } from '@/types/journal';
import { journalDB } from '@/lib/journalDB';
import { useToast } from '@/hooks/use-toast';
import { blobToBase64 } from '@/lib/utils';
import { cn } from '@/lib/utils';
import { summariseEntry } from '@/lib/summarise';

export function Timeline() {
  const [entries, setEntries] = useState<JournalEntry[]>([]);
  const [expandedEntries, setExpandedEntries] = useState<Set<string>>(new Set());
  const [playingAudio, setPlayingAudio] = useState<string | null>(null);
  const [audioUrls, setAudioUrls] = useState<Map<string, string>>(new Map());
  const [loading, setLoading] = useState(true);
  const [summarizingEntries, setSummarizingEntries] = useState<Set<string>>(new Set());
  
  const { toast } = useToast();

  const loadEntries = useCallback(async () => {
    try {
      setLoading(true);
      const allEntries = await journalDB.getAll();
      setEntries(allEntries);
      
      // Generate audio URLs for entries with audio blobs
      const newAudioUrls = new Map<string, string>();
      allEntries.forEach(entry => {
        if (entry.audioBlob) {
          newAudioUrls.set(entry.id, URL.createObjectURL(entry.audioBlob));
        }
      });
      setAudioUrls(newAudioUrls);
    } catch (error) {
      console.error('Error loading entries:', error);
      toast({
        title: "Loading failed",
        description: "Could not load your journal entries",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    loadEntries();
    
    // Cleanup function to revoke all audio URLs
    return () => {
      audioUrls.forEach(url => URL.revokeObjectURL(url));
    };
  }, [loadEntries]);

  const toggleExpanded = useCallback((entryId: string) => {
    setExpandedEntries(prev => {
      const newSet = new Set(prev);
      if (newSet.has(entryId)) {
        newSet.delete(entryId);
      } else {
        newSet.add(entryId);
      }
      return newSet;
    });
  }, []);

  const handleDelete = useCallback(async (entryId: string) => {
    if (!confirm('Are you sure you want to delete this entry?')) return;
    
    try {
      await journalDB.delete(entryId);
      setEntries(prev => prev.filter(entry => entry.id !== entryId));
      toast({
        title: "Entry deleted",
        description: "Your journal entry has been removed",
      });
    } catch (error) {
      console.error('Error deleting entry:', error);
      toast({
        title: "Delete failed",
        description: "Could not delete the entry. Please try again.",
        variant: "destructive",
      });
    }
  }, [toast]);

  const toggleAudio = useCallback((entryId: string) => {
    const audioUrl = audioUrls.get(entryId);
    if (!audioUrl) return;
    
    if (playingAudio === entryId) {
      // Stop current audio
      const audio = document.getElementById(`audio-${entryId}`) as HTMLAudioElement;
      if (audio) {
        audio.pause();
        audio.currentTime = 0;
      }
      setPlayingAudio(null);
    } else {
      // Stop any currently playing audio
      if (playingAudio) {
        const currentAudio = document.getElementById(`audio-${playingAudio}`) as HTMLAudioElement;
        if (currentAudio) {
          currentAudio.pause();
          currentAudio.currentTime = 0;
        }
      }
      
      // Start new audio
      const audio = document.getElementById(`audio-${entryId}`) as HTMLAudioElement;
      if (audio) {
        audio.play();
        setPlayingAudio(entryId);
      }
    }
  }, [playingAudio, audioUrls]);

  const handleCopyAudioBase64 = useCallback(async (entry: JournalEntry) => {
    if (!entry.audioBlob) return;
    
    try {
      const base64 = await blobToBase64(entry.audioBlob);
      const preview = base64.slice(0, 40) + '...';
      
      await navigator.clipboard.writeText(base64);
      toast({
        title: "Audio copied to clipboard",
        description: `Base64 audio data copied — paste into GPT for transcription\nPreview: ${preview}`,
      });
    } catch (error) {
      console.error('Failed to copy audio:', error);
      toast({
        title: "Copy failed",
        description: "Could not copy audio to clipboard",
        variant: "destructive",
      });
    }
  }, [toast]);

  const handleCopyTranscript = useCallback(async (transcript: string) => {
    try {
      await navigator.clipboard.writeText(transcript);
      toast({
        title: "Transcript copied",
        description: "Transcript text copied to clipboard",
      });
    } catch (error) {
      console.error('Failed to copy transcript:', error);
      toast({
        title: "Copy failed",
        description: "Could not copy transcript to clipboard",
        variant: "destructive",
      });
    }
  }, [toast]);

  const handleCopyGPTFormat = useCallback(async (entry: JournalEntry) => {
    try {
      const gptData = {
        date: formatDate(entry.timestamp),
        content: entry.content,
        tags: entry.tags,
        transcript: entry.transcript || null,
        timestamp: entry.timestamp.toISOString(),
      };
      
      const jsonString = JSON.stringify(gptData, null, 2);
      await navigator.clipboard.writeText(jsonString);
      
      toast({
        title: "GPT format copied",
        description: "Journal entry formatted for AI analysis and copied to clipboard",
      });
    } catch (error) {
      console.error('Failed to copy GPT format:', error);
      toast({
        title: "Copy failed",
        description: "Could not copy GPT format to clipboard",
        variant: "destructive",
      });
    }
  }, [toast]);

  const handleSummarizeEntry = useCallback(async (entry: JournalEntry) => {
    try {
      setSummarizingEntries(prev => new Set([...prev, entry.id]));
      
      const summary = await summariseEntry(entry);
      
      // Update the entry with the summary
      const updatedEntry = { ...entry, summary, updatedAt: new Date() };
      await journalDB.update(updatedEntry);
      
      // Update the local state
      setEntries(prev => prev.map(e => e.id === entry.id ? updatedEntry : e));
      
      toast({
        title: "Entry summarized",
        description: "AI summary has been generated and saved",
      });
    } catch (error) {
      console.error('Summarization failed:', error);
      toast({
        title: "Summarization failed",
        description: error instanceof Error ? error.message : "Could not generate summary",
        variant: "destructive",
      });
    } finally {
      setSummarizingEntries(prev => {
        const newSet = new Set(prev);
        newSet.delete(entry.id);
        return newSet;
      });
    }
  }, [toast]);

  const formatDate = (date: Date) => {
    const now = new Date();
    const entryDate = new Date(date);
    const diffTime = Math.abs(now.getTime() - entryDate.getTime());
    const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
    
    if (diffDays === 0) {
      return `Today at ${entryDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
    } else if (diffDays === 1) {
      return `Yesterday at ${entryDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
    } else if (diffDays < 7) {
      return `${diffDays} days ago`;
    } else {
      return entryDate.toLocaleDateString();
    }
  };

  const getPreview = (content: string, limit = 100) => {
    if (content.length <= limit) return content;
    return content.slice(0, limit) + '...';
  };

  if (loading) {
    return (
      <div className="max-w-md mx-auto p-4 space-y-4">
        <div className="text-center">
          <h1 className="text-2xl font-bold mb-2">Timeline</h1>
          <p className="text-muted-foreground">Loading your entries...</p>
        </div>
        {[1, 2, 3].map(i => (
          <Card key={i} className="p-4 animate-pulse">
            <div className="h-4 bg-muted rounded w-3/4 mb-2"></div>
            <div className="h-3 bg-muted rounded w-1/2 mb-3"></div>
            <div className="h-16 bg-muted rounded"></div>
          </Card>
        ))}
      </div>
    );
  }

  if (entries.length === 0) {
    return (
      <div className="max-w-md mx-auto p-4 text-center space-y-4">
        <div className="py-12">
          <Calendar className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
          <h2 className="text-xl font-semibold mb-2">No entries yet</h2>
          <p className="text-muted-foreground mb-6">
            Start journaling to see your timeline here
          </p>
          <Button asChild className="bg-gradient-primary">
            <a href="/">Write First Entry</a>
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-md mx-auto p-4 space-y-6">
      <div className="text-center mb-6">
        <h1 className="text-2xl font-bold bg-gradient-primary bg-clip-text text-transparent mb-2">
          Timeline
        </h1>
        <p className="text-muted-foreground text-sm">
          {entries.length} {entries.length === 1 ? 'entry' : 'entries'}
        </p>
      </div>

      <div className="space-y-4">
        {entries.map((entry) => {
          const isExpanded = expandedEntries.has(entry.id);
          const isPlaying = playingAudio === entry.id;
          
          return (
            <Card 
              key={entry.id} 
              className={cn(
                "transition-all duration-300 shadow-soft hover:shadow-medium",
                isExpanded && "shadow-medium"
              )}
            >
              <div className="p-4 space-y-3">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Clock className="h-4 w-4" />
                    {formatDate(entry.timestamp)}
                  </div>
                  <div className="flex items-center gap-1">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => toggleExpanded(entry.id)}
                      className="h-8 w-8 p-0"
                    >
                      {isExpanded ? (
                        <ChevronUp className="h-4 w-4" />
                      ) : (
                        <ChevronDown className="h-4 w-4" />
                      )}
                    </Button>
                  </div>
                </div>

                {entry.tags.length > 0 && (
                  <div className="flex flex-wrap gap-1">
                    {entry.tags.map((tag) => (
                      <Badge 
                        key={tag} 
                        variant="secondary"
                        className="text-xs px-2 py-0.5 bg-primary/10 text-primary"
                      >
                        {tag}
                      </Badge>
                    ))}
                  </div>
                )}

                <div className="space-y-3">
                  {entry.content && (
                    <p className="text-sm leading-relaxed">
                      {isExpanded ? entry.content : getPreview(entry.content)}
                    </p>
                  )}

                  {audioUrls.has(entry.id) && (
                    <div className="flex items-center gap-3 p-3 bg-muted/50 rounded-lg">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => toggleAudio(entry.id)}
                        className="h-8 w-8 p-0 rounded-full"
                      >
                        {isPlaying ? (
                          <Pause className="h-4 w-4" />
                        ) : (
                          <Play className="h-4 w-4" />
                        )}
                      </Button>
                      <span className="text-xs text-muted-foreground flex-1">
                        Voice note
                      </span>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleCopyAudioBase64(entry)}
                        className="h-8 w-8 p-0"
                        title="Copy audio as base64"
                      >
                        <Copy className="h-3 w-3" />
                      </Button>
                      <audio
                        id={`audio-${entry.id}`}
                        src={audioUrls.get(entry.id)}
                        onEnded={() => setPlayingAudio(null)}
                        className="hidden"
                      />
                    </div>
                  )}

                  {entry.transcript && (
                    <div className="p-3 bg-primary/5 rounded-lg border-l-2 border-primary/20">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-xs font-medium text-primary">Transcript</span>
                        <div className="flex gap-1">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleCopyTranscript(entry.transcript!)}
                            className="h-6 w-6 p-0"
                            title="Copy transcript"
                          >
                            <Copy className="h-3 w-3" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleCopyGPTFormat(entry)}
                            className="h-6 w-6 p-0"
                            title="Copy GPT-ready format"
                          >
                            <Bot className="h-3 w-3" />
                          </Button>
                        </div>
                      </div>
                      <p className="text-sm italic text-muted-foreground leading-relaxed">
                        "{entry.transcript}"
                      </p>
                    </div>
                  )}

                  {entry.summary && (
                    <div className="p-3 bg-accent/20 rounded-lg border border-accent/30">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-xs font-medium text-accent-foreground flex items-center gap-1">
                          <Sparkles className="h-3 w-3" />
                          AI Summary
                        </span>
                      </div>
                      <div className="space-y-2 text-xs">
                        {entry.summary.highlights.length > 0 && (
                          <div>
                            <span className="font-medium text-muted-foreground">Highlights:</span>
                            <ul className="mt-1 space-y-1">
                              {entry.summary.highlights.map((highlight, idx) => (
                                <li key={idx} className="text-muted-foreground">• {highlight}</li>
                              ))}
                            </ul>
                          </div>
                        )}
                        {entry.summary.actions.length > 0 && (
                          <div>
                            <span className="font-medium text-muted-foreground">Actions:</span>
                            <ul className="mt-1 space-y-1">
                              {entry.summary.actions.map((action, idx) => (
                                <li key={idx} className="text-muted-foreground">• {action}</li>
                              ))}
                            </ul>
                          </div>
                        )}
                        {entry.summary.mood && (
                          <div>
                            <span className="font-medium text-muted-foreground">Mood:</span>
                            <span className="ml-1 text-muted-foreground">{entry.summary.mood}</span>
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>

                {isExpanded && (
                  <div className="flex justify-between items-center pt-2 border-t">
                    <div className="flex gap-2">
                      {!entry.summary && (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-8 px-3 text-xs hover:bg-accent/10 hover:text-accent-foreground"
                          onClick={() => handleSummarizeEntry(entry)}
                          disabled={summarizingEntries.has(entry.id)}
                        >
                          {summarizingEntries.has(entry.id) ? (
                            <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                          ) : (
                            <Sparkles className="h-3 w-3 mr-1" />
                          )}
                          {summarizingEntries.has(entry.id) ? 'Summarizing...' : 'Summarize'}
                        </Button>
                      )}
                    </div>
                    <div className="flex gap-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-8 px-3 text-xs hover:bg-primary/10 hover:text-primary"
                        asChild
                      >
                        <a href={`/?id=${entry.id}`}>
                          <Edit3 className="h-3 w-3 mr-1" />
                          Edit
                        </a>
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-8 px-3 text-xs hover:bg-destructive/10 hover:text-destructive"
                        onClick={() => handleDelete(entry.id)}
                      >
                        <Trash2 className="h-3 w-3 mr-1" />
                        Delete
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            </Card>
          );
        })}
      </div>

      <div className="text-center pt-4">
        <Button variant="outline" asChild>
          <a href="/">New Entry</a>
        </Button>
      </div>
    </div>
  );
}