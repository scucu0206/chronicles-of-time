
export const PARTICLE_COUNT = 130000;
export const CAMERA_FOV = 75;
export const PARTICLE_SIZE_BASE = 0.05;

// Gemini Model
export const GEMINI_MODEL = 'gemini-2.5-flash';
export const SYSTEM_INSTRUCTION = `
You are an emotion analysis engine.
Analyze the user's audio input.
Return a JSON object with the field 'sentiment'.
Values must be one of: 'positive', 'negative', 'neutral'.
Positive includes happiness, excitement, calm.
Negative includes sadness, anger, fear.
Neutral is for silence or background noise.
`;
