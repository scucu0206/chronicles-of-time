import { GoogleGenAI, Type } from "@google/genai";
import { GEMINI_MODEL, SYSTEM_INSTRUCTION } from '../constants';
import { Sentiment, AudioAnalysisResult } from '../types';

let aiClient: GoogleGenAI | null = null;

const getClient = () => {
  if (!aiClient) {
    aiClient = new GoogleGenAI({ apiKey: process.env.API_KEY });
  }
  return aiClient;
};

// Convert Blob to Base64
const blobToBase64 = (blob: Blob): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const base64String = reader.result as string;
      // Remove data url prefix (e.g. "data:audio/wav;base64,")
      const base64Data = base64String.split(',')[1];
      resolve(base64Data);
    };
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
};

export const analyzeAudioSentiment = async (audioBlob: Blob): Promise<AudioAnalysisResult> => {
  try {
    const client = getClient();
    const base64Audio = await blobToBase64(audioBlob);

    const response = await client.models.generateContent({
      model: GEMINI_MODEL,
      contents: {
        parts: [
          {
            inlineData: {
              mimeType: audioBlob.type || 'audio/webm',
              data: base64Audio,
            },
          },
          {
            text: "Analyze the emotion of this voice audio.",
          },
        ],
      },
      config: {
        systemInstruction: SYSTEM_INSTRUCTION,
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            sentiment: {
              type: Type.STRING,
              enum: [Sentiment.POSITIVE, Sentiment.NEGATIVE, Sentiment.NEUTRAL],
              description: "The detected sentiment."
            }
          },
          required: ["sentiment"]
        }
      },
    });

    const text = response.text;
    if (!text) return { sentiment: Sentiment.NEUTRAL, confidence: 0 };

    const result = JSON.parse(text);
    return {
      sentiment: result.sentiment as Sentiment,
      confidence: 1.0, // Simplified confidence
    };

  } catch (error) {
    console.error("Gemini analysis failed:", error);
    return { sentiment: Sentiment.NEUTRAL, confidence: 0 };
  }
};
