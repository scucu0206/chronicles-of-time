import { Sentiment, WebSocketResponse } from '../types';

type TranscriptionCallback = (text: string) => void;
type SentimentCallback = (sentiment: Sentiment) => void;

export class AudioStreamer {
  private socket: WebSocket | null = null;
  private audioContext: AudioContext | null = null;
  private processor: ScriptProcessorNode | null = null;
  private inputStream: MediaStream | null = null;
  private isConnected: boolean = false;
  
  constructor(
    private onTranscription: TranscriptionCallback,
    private onSentiment: SentimentCallback
  ) {}

  connect() {
    if (this.socket) return;
    
    // Connect to local python server
    this.socket = new WebSocket('ws://127.0.0.1:3000');
    
    this.socket.onopen = () => {
      console.log('Audio Socket Connected');
      this.isConnected = true;
    };

    this.socket.onmessage = (event) => {
      try {
        const data: WebSocketResponse = JSON.parse(event.data);
        if (data.type === 'audio_processed') {
          if (data.transcript) {
            this.onTranscription(data.transcript);
          }
          if (data.sentimentScore !== undefined) {
             // Map -1 to 1 score to Sentiment Enum
             if (data.sentimentScore > 0.2) this.onSentiment(Sentiment.POSITIVE);
             else if (data.sentimentScore < -0.2) this.onSentiment(Sentiment.NEGATIVE);
             else this.onSentiment(Sentiment.NEUTRAL);
          }
        }
      } catch (e) {
        console.error('Socket parse error', e);
      }
    };

    this.socket.onclose = () => {
      console.log('Audio Socket Closed');
      this.isConnected = false;
      this.socket = null;
    };
  }

  async startRecording() {
    if (!this.isConnected || !this.socket) {
        this.connect();
        // Give it a second to connect if not already
        await new Promise(r => setTimeout(r, 500));
    }

    try {
      this.audioContext = new (window.AudioContext || (window as any).webkitAudioContext)({
        sampleRate: 16000 // Match server requirement
      });
      
      this.inputStream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const source = this.audioContext.createMediaStreamSource(this.inputStream);
      
      // Use ScriptProcessor for raw PCM access (AudioWorklet is better but more complex to setup in a single file structure)
      this.processor = this.audioContext.createScriptProcessor(4096, 1, 1);
      
      this.processor.onaudioprocess = (e) => {
        if (!this.socket || this.socket.readyState !== WebSocket.OPEN) return;

        const inputData = e.inputBuffer.getChannelData(0);
        
        // Convert Float32 (-1.0 to 1.0) to Int16 PCM
        const pcmData = new Int16Array(inputData.length);
        for (let i = 0; i < inputData.length; i++) {
          let s = Math.max(-1, Math.min(1, inputData[i]));
          pcmData[i] = s < 0 ? s * 0x8000 : s * 0x7FFF;
        }
        
        this.socket.send(pcmData.buffer);
      };

      source.connect(this.processor);
      this.processor.connect(this.audioContext.destination); // Needed for chrome to fire events
      
    } catch (e) {
      console.error("Mic Error:", e);
    }
  }

  stopRecording() {
    if (this.inputStream) {
      this.inputStream.getTracks().forEach(track => track.stop());
      this.inputStream = null;
    }
    if (this.processor) {
      this.processor.disconnect();
      this.processor = null;
    }
    if (this.audioContext) {
      this.audioContext.close();
      this.audioContext = null;
    }
  }
}
