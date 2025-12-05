
import { FilesetResolver, HandLandmarker, HandLandmarkerResult } from "@mediapipe/tasks-vision";

let handLandmarker: HandLandmarker | undefined;

export const initializeHandTracking = async () => {
  try {
    // Use a specific, stable version for the WASM files to avoid version mismatch errors
    const vision = await FilesetResolver.forVisionTasks(
      "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14/wasm"
    );
    
    handLandmarker = await HandLandmarker.createFromOptions(vision, {
      baseOptions: {
        modelAssetPath: `https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task`,
        delegate: "GPU"
      },
      runningMode: "VIDEO",
      numHands: 1
    });
  } catch (error) {
    console.warn("Hand Tracking Init Failed (WASM fetch error). Gestures will be disabled.", error);
    // Do not throw, allowing the app to run without hand tracking
  }
};

export const detectHands = (video: HTMLVideoElement, timestamp: number): HandLandmarkerResult | null => {
  if (!handLandmarker) return null;
  try {
    return handLandmarker.detectForVideo(video, timestamp);
  } catch (e) {
    console.error("Hand detection error:", e);
    return null;
  }
};
