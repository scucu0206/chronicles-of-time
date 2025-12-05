
import React, { useState, useEffect, useRef, useCallback, Suspense, useMemo } from 'react';
import { Canvas, useThree } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import ParticleScene from './components/ParticleScene';
import { Controls } from './components/Controls';
import TextParticleSystem from './components/TextParticleSystem';
import MemoryPalace from './components/MemoryPalace';
import { ReadingOverlay } from './components/ReadingOverlay'; 
import { processImageToParticles } from './utils/imageProcessing';
import { initializeHandTracking, detectHands } from './services/handTracking';
import { analyzeAudioSentiment } from './services/geminiService'; // Use Gemini directly
import { ParticleData, HandData, Sentiment, VoiceMemory, MemoryPackage } from './types';
import { PARTICLE_COUNT } from './constants';
import * as THREE from 'three';

// Component to handle Camera Reset
const CameraManager: React.FC<{ trigger: any }> = ({ trigger }) => {
  const { camera } = useThree();
  useEffect(() => {
    camera.position.set(0, 0, 10);
    camera.lookAt(0, 0, 0);
    camera.updateProjectionMatrix();
  }, [camera, trigger]);
  return null;
};

// --- VOICE SEARCH CONSTANTS ---
const STOP_WORDS = new Set([
    'the', 'is', 'at', 'which', 'on', 'a', 'an', 'and', 'or', 'but', 'if', 'then', 'else', 'when', 'in', 'to', 'for', 'of',
    '的', '了', '和', '是', '就', '都', '而', '及', '与', '着', '或', '一个', '没有', '我们', '你们', '他们', '这个', '那个', '在'
]);

const App: React.FC = () => {
  // Application State
  const [viewMode, setViewMode] = useState<'LIVE' | 'PALACE'>('LIVE');
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved'>('idle');
  const [savedMemories, setSavedMemories] = useState<MemoryPackage[]>([]);

  // Live Scene State
  const [particles, setParticles] = useState<ParticleData[]>([]);
  // Use lower default density on mobile? Ideally detectable, but sticking to logic.
  const [density, setDensity] = useState<number>(PARTICLE_COUNT); 
  const [size, setSize] = useState<number>(0.3);
  const [textSize, setTextSize] = useState<number>(1.5); 
  const [sentiment, setSentiment] = useState<Sentiment>(Sentiment.NEUTRAL);
  const sentimentRef = useRef<Sentiment>(Sentiment.NEUTRAL); 
  
  // Voice & Transcript State
  const [transcript, setTranscript] = useState<string>(""); 
  const [finalizedTranscript, setFinalizedTranscript] = useState<string>(""); 
  
  const [voiceMemories, setVoiceMemories] = useState<VoiceMemory[]>([]);
  const [isRecording, setIsRecording] = useState<boolean>(false);
  const isRecordingRef = useRef<boolean>(false); 

  // Reading Mode State
  const [readingMode, setReadingMode] = useState<boolean>(false);
  // Track timestamp for reading mode
  const [currentMemoryTimestamp, setCurrentMemoryTimestamp] = useState<number>(Date.now());

  const [handData, setHandData] = useState<HandData | null>(null);
  const [sceneVersion, setSceneVersion] = useState<number>(0);
  
  // Refs
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null); 
  const recognitionRef = useRef<any>(null); 
  const currentImageUrlRef = useRef<string>("https://picsum.photos/id/28/800/800"); 

  // Sentiment Recorder Refs
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const sentimentIntervalRef = useRef<any>(null);

  const lastPointerRef = useRef<{x: number, y: number} | null>(null);
  const lastTimeRef = useRef<number>(0);

  useEffect(() => { sentimentRef.current = sentiment; }, [sentiment]);
  useEffect(() => { isRecordingRef.current = isRecording; }, [isRecording]);

  // Re-attach camera stream
  useEffect(() => {
    if (viewMode === 'LIVE' && videoRef.current && streamRef.current) {
        videoRef.current.srcObject = streamRef.current;
        videoRef.current.play().catch(e => console.error("Video play failed on resume", e));
    }
  }, [viewMode]);

  // --- SEARCH LOGIC (Voice Matching) ---
  const processedMemories = useMemo(() => {
      const searchQuery = transcript || finalizedTranscript;

      if (viewMode === 'LIVE' || !searchQuery) {
          return savedMemories.map(m => ({ ...m, matchScore: 0 })).sort((a, b) => b.timestamp - a.timestamp);
      }

      // 1. Extract Keywords with Chinese Tokenization
      let keywords: string[] = [];
      const normalizedQuery = searchQuery.toLowerCase().replace(/[.,\/#!$%\^&\*;:{}=\-_`~()]/g, "");
      const hasChinese = /[\u4e00-\u9fa5]/.test(normalizedQuery);
      
      if (hasChinese) {
          for (let i = 0; i < normalizedQuery.length; i++) {
              const char = normalizedQuery[i];
              if (char.trim() && !STOP_WORDS.has(char)) keywords.push(char);
          }
          for (let i = 0; i < normalizedQuery.length - 1; i++) {
              const bigram = normalizedQuery.slice(i, i + 2);
              if (!STOP_WORDS.has(bigram)) keywords.push(bigram);
          }
          const splitParts = normalizedQuery.split(/\s+/).filter(w => w.length > 0 && !STOP_WORDS.has(w));
          keywords = [...keywords, ...splitParts];
      } else {
          keywords = normalizedQuery.split(/\s+/).filter(w => w.length > 0 && !STOP_WORDS.has(w));
      }
      keywords = [...new Set(keywords)];

      if (keywords.length === 0) {
          return savedMemories.map(m => ({ ...m, matchScore: 0 })).sort((a, b) => b.timestamp - a.timestamp);
      }
      
      console.log("Search Keywords:", keywords);

      // 2. Score Memories (Full Transcript Check)
      const scoredMemories = savedMemories.map(memory => {
          let hits = 0;
          const content = (memory.transcriptSnapshot + " " + memory.sentiment).toLowerCase();
          
          keywords.forEach(word => {
              if (content.includes(word)) hits++;
          });

          let score = 0;
          if (hits > 0) {
              score = (hits / Math.max(1, keywords.length * 0.5)); 
              score = Math.min(score, 1.0);
          }
          
          return { ...memory, matchScore: score };
      });

      return scoredMemories.sort((a, b) => {
          if ((b.matchScore || 0) > 0 || (a.matchScore || 0) > 0) {
              return (b.matchScore || 0) - (a.matchScore || 0);
          }
          return b.timestamp - a.timestamp;
      });
  }, [savedMemories, transcript, finalizedTranscript, viewMode]);

  useEffect(() => {
    processImageToParticles(currentImageUrlRef.current, density).then((data) => {
        setParticles(data);
        setSceneVersion(Date.now());
    }).catch(err => console.error(err));

    const initSystem = async () => {
      const startVideo = () => {
          const checkRef = setInterval(async () => {
              if (videoRef.current) {
                  clearInterval(checkRef);
                  try {
                      if (!streamRef.current) {
                          const stream = await navigator.mediaDevices.getUserMedia({ 
                              video: { width: { ideal: 640 }, height: { ideal: 480 }, facingMode: "user" },
                              audio: false // Audio is handled separately
                          });
                          streamRef.current = stream;
                      }
                      if (videoRef.current) {
                          videoRef.current.srcObject = streamRef.current;
                          videoRef.current.play();
                      }
                  } catch (e) { console.error(e); }
              }
          }, 100);
      };
      startVideo();

      try {
        await initializeHandTracking();
        const startTrackingLoop = () => {
             const detectLoop = () => {
                if (videoRef.current && videoRef.current.readyState >= 2) {
                    const result = detectHands(videoRef.current, Date.now());
                    
                    if (result && result.landmarks && result.landmarks.length > 0) {
                        const landmarks = result.landmarks[0];
                        const wrist = landmarks[0];
                        let extendedFingers = 0;
                        const tips = [8, 12, 16, 20]; 
                        tips.forEach(idx => {
                             const tipY = landmarks[idx].y;
                             const pipY = landmarks[idx-2].y;
                             if (wrist.y - tipY > 0.1 && pipY - tipY > 0.05) extendedFingers++;
                        });

                        const ax = landmarks[5].x - landmarks[0].x;
                        const ay = landmarks[5].y - landmarks[0].y;
                        const bx = landmarks[17].x - landmarks[0].x;
                        const by = landmarks[17].y - landmarks[0].y;
                        const palmNormalZ = ax * by - ay * bx;

                        const thumbTip = landmarks[4];
                        const indexTip = landmarks[8];
                        const pinchDistance = Math.sqrt(
                            Math.pow(thumbTip.x - indexTip.x, 2) + 
                            Math.pow(thumbTip.y - indexTip.y, 2)
                        );
                        
                        const now = Date.now();
                        const px = -(landmarks[8].x - 0.5) * 2;
                        const py = -(landmarks[8].y - 0.5) * 2;
                        let velocity = 0;
                        if (lastPointerRef.current && lastTimeRef.current) {
                            const dt = (now - lastTimeRef.current) / 1000;
                            if (dt > 0) {
                                const dx = px - lastPointerRef.current.x;
                                const dy = py - lastPointerRef.current.y;
                                velocity = Math.sqrt(dx*dx + dy*dy) / dt;
                            }
                        }
                        lastPointerRef.current = { x: px, y: py };
                        lastTimeRef.current = now;

                        let gesture: 'OPEN' | 'CLOSED' | 'SWIPE' | 'PINCH' | 'IDLE' = 'IDLE';
                        if (pinchDistance < 0.08) gesture = 'PINCH';
                        else if (extendedFingers >= 4) gesture = 'OPEN';
                        else if (extendedFingers <= 1 && Math.abs(palmNormalZ) > 0.01) gesture = 'CLOSED';
                        else if (extendedFingers === 1 && velocity > 0.5) { 
                             const indexExtended = (landmarks[6].y - landmarks[8].y) > 0.05;
                             if (indexExtended) gesture = 'SWIPE';
                        }

                        setHandData({
                            gesture,
                            position: { x: -(landmarks[9].x - 0.5) * 2, y: -(landmarks[9].y - 0.5) * 2, z: 0 },
                            palmCenter: { x: -(landmarks[9].x - 0.5) * 2, y: -(landmarks[9].y - 0.5) * 2 },
                            pointer: { x: px, y: py },
                            rotation: { 
                                x: Math.atan2(landmarks[9].y - landmarks[0].y, landmarks[9].x - landmarks[0].x), 
                                y: Math.atan2(landmarks[5].y - landmarks[17].y, landmarks[5].x - landmarks[17].x) 
                            },
                            detected: true,
                            pinchDistance: pinchDistance
                        });
                    } else {
                        setHandData(prev => prev ? { ...prev, detected: false, gesture: 'IDLE' } : null);
                        lastPointerRef.current = null;
                    }
                }
                requestAnimationFrame(detectLoop);
             };
             detectLoop();
        };
        startTrackingLoop();
      } catch (err) { console.error(err); }
    };
    initSystem();

    if ('webkitSpeechRecognition' in window) {
        const recognition = new (window as any).webkitSpeechRecognition();
        recognition.continuous = true;
        recognition.interimResults = true;
        recognition.lang = 'zh-CN'; 

        recognition.onresult = (event: any) => {
            let interim = '';
            for (let i = event.resultIndex; i < event.results.length; ++i) {
                if (event.results[i].isFinal) {
                    const finalText = event.results[i][0].transcript;
                    setFinalizedTranscript(finalText);
                    setTranscript(''); 
                    
                    const newMemory: VoiceMemory = {
                        id: Date.now().toString(),
                        transcript: finalText,
                        sentiment: sentimentRef.current,
                        timestamp: Date.now()
                    };
                    setVoiceMemories(prev => [...prev, newMemory]);
                } else {
                    interim += event.results[i][0].transcript;
                }
            }
            if (interim) setTranscript(interim);
        };
        recognition.onend = () => {
             if (isRecordingRef.current) {
                 try { recognition.start(); } catch(e) {}
             }
        };
        recognitionRef.current = recognition;
    }
  }, []); 

  const handleUpload = (file: File) => {
      const url = URL.createObjectURL(file);
      currentImageUrlRef.current = url;
      setParticles([]); 
      setTranscript("");
      setFinalizedTranscript("");
      setVoiceMemories([]);
      setCurrentMemoryTimestamp(Date.now());
      processImageToParticles(url, density).then((data) => {
          setParticles(data);
          setSceneVersion(Date.now());
      });
  };
  
  const handleToggleRecording = async () => {
      if (isRecording) {
          // STOP RECORDING
          recognitionRef.current?.stop();
          setIsRecording(false);
          
          if (mediaRecorderRef.current) {
              mediaRecorderRef.current.stop();
              mediaRecorderRef.current = null;
          }
          if (sentimentIntervalRef.current) {
              clearInterval(sentimentIntervalRef.current);
              sentimentIntervalRef.current = null;
          }
      } else {
          // START RECORDING
          try { recognitionRef.current?.start(); } catch (e) {}
          setIsRecording(true);

          // Start Gemini Sentiment Loop
          try {
              const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
              const mediaRecorder = new MediaRecorder(stream);
              mediaRecorderRef.current = mediaRecorder;

              mediaRecorder.ondataavailable = async (e) => {
                  if (e.data.size > 0) {
                      const result = await analyzeAudioSentiment(e.data);
                      if (result.sentiment !== Sentiment.NEUTRAL) {
                          setSentiment(result.sentiment);
                      }
                  }
              };

              // Start recording and slice into 4-second chunks
              mediaRecorder.start();
              
              sentimentIntervalRef.current = setInterval(() => {
                  if (mediaRecorder.state === 'recording') {
                      mediaRecorder.stop();
                      mediaRecorder.start(); // Restart to get the chunk
                  }
              }, 4000); 

          } catch (e) {
              console.error("Sentiment Audio Error:", e);
          }
      }
  };

  const handleSaveMemory = () => {
       setSaveStatus('saving');
       const glCanvas = document.querySelector('canvas');
       let screenshotUrl = '';
       if (glCanvas) screenshotUrl = glCanvas.toDataURL('image/png', 0.8);

       const palette: string[] = [];
       const sortedParticles = [...particles].sort((a, b) => b.z - a.z);
       if (sortedParticles.length > 0) {
           const chunkSize = Math.ceil(sortedParticles.length / 3);
           for (let i = 0; i < 3; i++) {
               let r = 0, g = 0, b = 0, count = 0;
               for (let j = i * chunkSize; j < (i + 1) * chunkSize && j < sortedParticles.length; j += 10) {
                   r += sortedParticles[j].r;
                   g += sortedParticles[j].g;
                   b += sortedParticles[j].b;
                   count++;
               }
               if (count > 0) {
                   const hex = "#" + ((1 << 24) + (Math.floor(r / count * 255) << 16) + (Math.floor(g / count * 255) << 8) + Math.floor(b / count * 255)).toString(16).slice(1);
                   palette.push(hex);
               } else {
                   palette.push("#ffffff");
               }
           }
       } else {
           palette.push("#ffffff", "#cccccc", "#999999");
       }

       // SAVE FULL CONTEXT
       const fullTranscript = voiceMemories.map(m => m.transcript).join(" ");
       const finalSnapshot = fullTranscript || finalizedTranscript || "Silent Memory";

       const pkg: MemoryPackage = {
           id: Date.now().toString(),
           timestamp: Date.now(),
           thumbnail: screenshotUrl,
           imageSnapshot: currentImageUrlRef.current,
           particleCount: density,
           sentiment: sentiment,
           transcriptSnapshot: finalSnapshot, 
           dominantColor: palette[0],
           palette: palette,
           voiceMemories: voiceMemories,
           matchScore: 0
       };
       setSavedMemories(prev => [pkg, ...prev]);
       setTimeout(() => {
           setSaveStatus('saved');
           setTimeout(() => setSaveStatus('idle'), 2000);
       }, 500);
  };

  const handleRestoreMemory = (memory: MemoryPackage) => {
      setViewMode('LIVE');
      currentImageUrlRef.current = memory.imageSnapshot;
      setDensity(memory.particleCount);
      setSentiment(memory.sentiment);
      
      setFinalizedTranscript(memory.transcriptSnapshot);
      setVoiceMemories(memory.voiceMemories || []);
      setCurrentMemoryTimestamp(memory.timestamp);

      setParticles([]);
      processImageToParticles(memory.imageSnapshot, memory.particleCount).then((data) => {
          setParticles(data);
          setSceneVersion(Date.now());
      });
  };

  const handleTextClick = () => {
      setReadingMode(true);
  };

  return (
    <div className="w-full h-screen bg-black overflow-hidden relative">
      <Controls 
        onUpload={handleUpload}
        density={density}
        setDensity={(val) => {
             setDensity(val);
             processImageToParticles(currentImageUrlRef.current, val).then((data) => {
                setParticles(data);
                setSceneVersion(Date.now());
            });
        }}
        size={size}
        setSize={setSize}
        textSize={textSize}
        setTextSize={setTextSize}
        isRecording={isRecording}
        toggleRecording={handleToggleRecording}
        sentiment={sentiment}
        handActive={!!handData?.detected}
        transcript={transcript}
        videoRef={videoRef}
        onSaveMemory={handleSaveMemory}
        onToggleView={() => setViewMode(prev => prev === 'LIVE' ? 'PALACE' : 'LIVE')}
        viewMode={viewMode}
        saveStatus={saveStatus}
        searchResultsCount={viewMode === 'PALACE' && (transcript || finalizedTranscript) ? processedMemories.filter(m => (m.matchScore||0) > 0).length : undefined}
      />
      
      {readingMode && (
          <ReadingOverlay 
              text={finalizedTranscript || "No Transcript Data"} 
              timestamp={currentMemoryTimestamp}
              onClose={() => setReadingMode(false)} 
          />
      )}

      <Canvas 
        className="z-0"
        camera={{ position: [0, 0, 10], fov: 60 }} 
        gl={{ preserveDrawingBuffer: true, alpha: false, antialias: true }}
      >
        <Suspense fallback={null}>
            <ambientLight intensity={0.5} />
            <CameraManager trigger={`${viewMode}-${sceneVersion}`} />

            {viewMode === 'LIVE' ? (
                <>
                    <ParticleScene 
                        particles={particles} 
                        size={size} 
                        handData={handData} 
                        sentiment={sentiment}
                        sceneVersion={sceneVersion}
                        readingMode={readingMode}
                    />
                    <TextParticleSystem 
                        transcript={finalizedTranscript} 
                        handData={handData}
                        sceneVersion={sceneVersion}
                        textSize={textSize}
                        onTextClick={handleTextClick}
                        readingMode={readingMode}
                    />
                    <OrbitControls 
                        key={`orbit-${viewMode}-${sceneVersion}`}
                        enableZoom={true} 
                        enableRotate={false} 
                        enablePan={false} 
                        makeDefault
                    />
                </>
            ) : (
                <MemoryPalace 
                    memories={processedMemories} 
                    onRestore={handleRestoreMemory} 
                    handData={handData}
                />
            )}
        </Suspense>
      </Canvas>
    </div>
  );
};

export default App;
