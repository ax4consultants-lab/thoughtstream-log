import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export const blobToBase64 = (blob: Blob): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      // Remove data:audio/webm;base64, prefix if present
      const base64 = result.includes(',') ? result.split(',')[1] : result;
      resolve(base64);
    };
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });
};

export const transcribeAudio = async (audioBlob: Blob): Promise<string> => {
  const apiKey = localStorage.getItem('OPENAI_API_KEY');
  
  if (!apiKey) {
    return "Transcription not available - add OpenAI API key in Settings to enable auto-transcription.";
  }

  try {
    const formData = new FormData();
    formData.append("file", audioBlob, "journal.webm");
    formData.append("model", "whisper-1");

    const res = await fetch("https://api.openai.com/v1/audio/transcriptions", {
      method: "POST",  
      headers: {
        Authorization: `Bearer ${apiKey}`,
      },
      body: formData,
    });

    if (!res.ok) {
      throw new Error(`API request failed: ${res.status}`);
    }

    const data = await res.json();
    return data.text || "No transcription available";
  } catch (error) {
    console.error('Transcription failed:', error);
    return "Transcription failed - check your API key and connection";
  }
};
