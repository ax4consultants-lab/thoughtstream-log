import React, { useState, useRef, useCallback, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Mic, Square, Play, Pause } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface AudioRecorderProps {
  onAudioRecorded: (audioBlob: Blob) => void;
  disabled?: boolean;
  existingAudioBlob?: Blob | null;
}

export function AudioRecorder({ onAudioRecorded, disabled, existingAudioBlob }: AudioRecorderProps) {
  const [isRecording, setIsRecording] = useState(false);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const audioRef = useRef<HTMLAudioElement>(null);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  
  const { toast } = useToast();

  // Set up existing audio if provided
  useEffect(() => {
    if (existingAudioBlob) {
      const url = URL.createObjectURL(existingAudioBlob);
      setAudioUrl(url);
      return () => URL.revokeObjectURL(url);
    }
  }, [existingAudioBlob]);

  const startTimer = useCallback(() => {
    setRecordingTime(0);
    timerRef.current = setInterval(() => {
      setRecordingTime(prev => prev + 1);
    }, 1000);
  }, []);

  const stopTimer = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const startRecording = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        const url = URL.createObjectURL(audioBlob);
        setAudioUrl(url);
        onAudioRecorded(audioBlob);
        
        // Stop all tracks
        stream.getTracks().forEach(track => track.stop());
      };

      mediaRecorder.start();
      setIsRecording(true);
      startTimer();
      
      toast({
        title: "Recording started",
        description: "Tap the stop button when you're done",
      });
    } catch (error) {
      console.error('Error starting recording:', error);
      toast({
        title: "Recording failed",
        description: "Please check microphone permissions",
        variant: "destructive",
      });
    }
  }, [onAudioRecorded, toast, startTimer]);

  const stopRecording = useCallback(() => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      stopTimer();
      
      toast({
        title: "Recording saved",
        description: `Recorded ${Math.floor(recordingTime / 60)}:${(recordingTime % 60).toString().padStart(2, '0')}`,
      });
    }
  }, [isRecording, recordingTime, toast, stopTimer]);

  const togglePlayback = useCallback(() => {
    if (!audioRef.current || !audioUrl) return;

    if (isPlaying) {
      audioRef.current.pause();
      setIsPlaying(false);
    } else {
      audioRef.current.play();
      setIsPlaying(true);
    }
  }, [audioUrl, isPlaying]);

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div className="flex items-center gap-3 p-4 bg-card rounded-xl border shadow-soft">
      {!isRecording && !audioUrl && (
        <Button
          onClick={startRecording}
          disabled={disabled}
          size="lg"
          className="bg-primary hover:bg-primary-glow text-primary-foreground rounded-full p-4 shadow-medium transition-all duration-300 hover:scale-105"
        >
          <Mic className="h-5 w-5" />
        </Button>
      )}

      {isRecording && (
        <div className="flex items-center gap-3">
          <Button
            onClick={stopRecording}
            size="lg"
            variant="destructive"
            className="rounded-full p-4 shadow-medium transition-all duration-300 hover:scale-105"
          >
            <Square className="h-4 w-4" />
          </Button>
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 bg-destructive rounded-full animate-pulse" />
            <span className="text-sm font-medium text-muted-foreground">
              {formatTime(recordingTime)}
            </span>
          </div>
        </div>
      )}

      {audioUrl && !isRecording && (
        <div className="flex items-center gap-3">
          <Button
            onClick={togglePlayback}
            size="lg"
            variant="secondary"
            className="rounded-full p-4 shadow-medium transition-all duration-300 hover:scale-105"
          >
            {isPlaying ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
          </Button>
          <div className="text-sm text-muted-foreground">
            Audio recorded ({formatTime(recordingTime)})
          </div>
          <audio
            ref={audioRef}
            src={audioUrl}
            onEnded={() => setIsPlaying(false)}
            className="hidden"
          />
        </div>
      )}
    </div>
  );
}