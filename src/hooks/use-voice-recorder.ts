import { useState, useCallback, useRef } from 'react';
import { toast } from '@/hooks/use-toast';

interface UseVoiceRecorderOptions {
  onTranscription: (text: string) => void;
}

export function useVoiceRecorder({ onTranscription }: UseVoiceRecorderOptions) {
  const [isRecording, setIsRecording] = useState(false);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [recordingDuration, setRecordingDuration] = useState(0);
  
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  const startRecording = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream, {
        mimeType: MediaRecorder.isTypeSupported('audio/webm') ? 'audio/webm' : 'audio/mp4',
      });
      
      mediaRecorderRef.current = mediaRecorder;
      chunksRef.current = [];
      
      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) {
          chunksRef.current.push(e.data);
        }
      };
      
      mediaRecorder.onstop = async () => {
        const blob = new Blob(chunksRef.current, { type: mediaRecorder.mimeType });
        stream.getTracks().forEach(track => track.stop());
        
        if (blob.size > 0) {
          await transcribe(blob);
        }
      };
      
      mediaRecorder.start(100);
      setIsRecording(true);
      setRecordingDuration(0);
      
      timerRef.current = setInterval(() => {
        setRecordingDuration(d => d + 1);
      }, 1000);
      
    } catch (error) {
      console.error('Failed to start recording:', error);
      toast({
        title: 'Recording failed',
        description: 'Could not access your microphone. Please check permissions.',
        variant: 'destructive',
      });
    }
  }, []);

  const stopRecording = useCallback(() => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    }
  }, [isRecording]);

  const transcribe = async (blob: Blob) => {
    setIsTranscribing(true);

    try {
      // Send audio to /api/transcribe endpoint
      const formData = new FormData();
      formData.append('audio', blob, 'recording.webm');

      const response = await fetch('/api/transcribe', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        throw new Error(`Transcription API error: ${response.status}`);
      }

      const data = await response.json();
      const transcribedText = data.text || '';

      if (transcribedText.trim()) {
        onTranscription(transcribedText);

        toast({
          title: 'Transcription complete',
          description: 'Your voice message has been converted to text.',
        });
      } else {
        throw new Error('Empty transcription result');
      }
    } catch (error) {
      console.error('Transcription failed:', error);
      toast({
        title: 'Transcription failed',
        description: 'Could not transcribe your voice message. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setIsTranscribing(false);
    }
  };

  const formatDuration = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  return {
    isRecording,
    isTranscribing,
    recordingDuration,
    formattedDuration: formatDuration(recordingDuration),
    startRecording,
    stopRecording,
  };
}
