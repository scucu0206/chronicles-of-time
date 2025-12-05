

export interface ParticleData {
  x: number;
  y: number;
  z: number;
  r: number;
  g: number;
  b: number;
  originalX: number;
  originalY: number;
  originalZ: number;
  random: number; // For shader noise
}

export interface HandData {
  gesture: 'OPEN' | 'CLOSED' | 'SWIPE' | 'IDLE' | 'PINCH';
  position: { x: number; y: number; z: number };
  palmCenter: { x: number; y: number }; // Raw screen coordinates for panning
  pointer: { x: number; y: number }; // Index finger tip for swiping
  rotation: { x: number; y: number };
  detected: boolean;
  pinchDistance: number; // Distance between thumb and index for scaling
}

export interface TextParticle {
  id: string;
  char: string;
  // Physics
  position: { x: number; y: number; z: number };
  velocity: { x: number; y: number; z: number };
  rotation: { x: number; y: number; z: number };
  
  // Phases
  phase: 'spawn' | 'hold' | 'fly' | 'dock';
  
  // Timestamps & Delays
  spawnTime: number;
  morphTime: number; // End of hold phase
  flyStartTime: number;
  delay: number; // Delay before flying
  
  // Targets
  holdPosition: { x: number; y: number; z: number };
  dockPosition: { x: number; y: number; z: number }; 
  controlPoint: { x: number; y: number; z: number }; // Bezier control
  
  color: string;
}

export enum Sentiment {
  POSITIVE = 'positive',
  NEGATIVE = 'negative',
  NEUTRAL = 'neutral',
}

export interface AudioAnalysisResult {
  sentiment: Sentiment;
  confidence: number;
}

export interface WebSocketResponse {
  type: string;
  transcript?: string;
  sentimentScore?: number;
  confidence?: number;
  data?: any;
  message?: string;
}

export interface VoiceMemory {
  id: string;
  transcript: string;
  sentiment: Sentiment;
  timestamp: number;
}

export interface MemoryPackage {
  id: string;
  timestamp: number;
  thumbnail: string; // Base64 image for the bubble texture
  
  // State for restoration
  imageSnapshot: string; // URL or Base64 of the original image
  particleCount: number;
  sentiment: Sentiment;
  transcriptSnapshot: string; // The full text ring content
  
  // Visuals
  dominantColor: string; // Hex color extracted from particles
  palette: string[]; // [hex, hex, hex] - 3 dominant colors from depth layers
  matchScore?: number; // 0 to 1, for search highlighting
  
  // Metadata
  voiceMemories: VoiceMemory[];
}
