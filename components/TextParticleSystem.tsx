
import React, { useRef, useState, useEffect } from 'react';
import { useFrame } from '@react-three/fiber';
import { Text } from '@react-three/drei';
import * as THREE from 'three';
import { HandData, TextParticle } from '../types';

interface TextParticleSystemProps {
  transcript: string;
  handData: HandData | null;
  sceneVersion: number;
  textSize: number;
  onTextClick?: () => void;
  readingMode: boolean;
}

const TextParticleSystem: React.FC<TextParticleSystemProps> = ({ transcript, handData, textSize, sceneVersion, onTextClick, readingMode }) => {
  const [particles, setParticles] = useState<TextParticle[]>([]);
  
  // Refs for physics loop
  const physicsStateRef = useRef<Map<string, TextParticle>>(new Map());
  const textRefs = useRef<Map<string, THREE.Object3D>>(new Map());
  
  // Track state
  const lastTranscriptRef = useRef<string>('');
  const lastSceneVersionRef = useRef<number>(sceneVersion);
  const totalCharCountRef = useRef<number>(0);
  const initialSpawnRef = useRef<boolean>(false);
  
  // Configuration
  const MAX_CHARS = 500; 
  const ORBIT_Z = 2.5; 
  const CHARS_PER_RING = 50;
  
  // Box Size for Docking (approx 1.15x Image Size of 10.0)
  const BOX_SIZE = 8.6; 

  // --- SPAWN LOGIC ---
  useEffect(() => {
    const isReset = sceneVersion !== lastSceneVersionRef.current;
    
    // Check if we are restoring a memory (Scene reset + existing transcript)
    const isRestoring = isReset && transcript && transcript.length > 0;

    // Hard reset on upload
    if (isReset && !isRestoring) {
        setParticles([]);
        physicsStateRef.current.clear();
        textRefs.current.clear();
        lastTranscriptRef.current = '';
        totalCharCountRef.current = 0;
        initialSpawnRef.current = false;
        lastSceneVersionRef.current = sceneVersion;
    }

    if (!transcript) return;
    
    // If restoring, force a process of the full transcript even if it matches "last"
    if (isRestoring && !initialSpawnRef.current) {
        lastTranscriptRef.current = ''; // Clear last to force diff
        initialSpawnRef.current = true;
    }
    
    const currentText = transcript;
    const previousText = lastTranscriptRef.current;
    
    // Determine what's new
    let newPart = '';
    
    if (isRestoring) {
        newPart = currentText;
    } else if (currentText.startsWith(previousText) && !isReset) {
        // Simple append
        newPart = currentText.slice(previousText.length);
    } else {
        // Text changed significantly, treat as new block
        // In a real app we might diff smarter, but for now we just process the whole new block
        // to ensure we don't lose context.
        // To avoid duplicating on screen, we rely on the ID being unique per char index/time
        newPart = currentText; 
        
        // However, if we just spawn everything, we might duplicate.
        // Better strategy for "Changed completely":
        // Only if the new text is NOT a substring of old.
        // For simplicity and robustness (fixing the text loss bug):
        // We will process the *difference* if it looks like a continuation, 
        // OR process the *whole thing* if it looks like a fresh sentence (and clear old if needed, but we keep old particles for history).
        // ACTUALLY: The user wants "History". So we should just spawn the new stuff.
        // If currentText is totally different, we assume it's a NEW sentence.
        
        // Fix: If the text is completely new (not a continuation), we spawn the whole thing.
        // We don't clear old particles, they just drift in orbit.
    }

    if (newPart.length > 0) {
       const newChars = newPart.split('');
       const charWidth = 0.4; 
       const totalWidth = newChars.length * charWidth;
       const startX = -(totalWidth / 2);

       const now = Date.now();
       const holdDuration = 3500; 

       const newParticleObjs: TextParticle[] = newChars.map((char, i) => {
           // Spawn Phase: Center Bottom
           // Raised Y to -3.0 to avoid overlapping with the bottom Control bar on mobile
           const holdX = startX + i * charWidth;
           const holdY = -3.0; 
           const holdZ = 0;

           // Dock Phase: Atomic Shells Ring Layout
           // We use a global counter to ensure rings stack nicely even across multiple sentences
           const globalIndex = isRestoring ? i : (totalCharCountRef.current + i);
           const ringIndex = Math.floor(globalIndex / CHARS_PER_RING);
           const localIndex = globalIndex % CHARS_PER_RING;
           
           // Calculate Ring Position (Circle)
           const radius = 4.3; // Approx half of BOX_SIZE
           const angleStep = (Math.PI * 2) / CHARS_PER_RING;
           const theta = localIndex * angleStep;
           
           const baseX = Math.cos(theta) * radius;
           const baseY = Math.sin(theta) * radius;
           const baseZ = 0;
           
           // Rotate Ring based on Shell Index (Atomic effect)
           const ringRotationY = ringIndex * (Math.PI / 6); // 30 degrees per shell
           
           // Apply rotation
           const x1 = baseX * Math.cos(ringRotationY) - baseZ * Math.sin(ringRotationY);
           const z1 = baseX * Math.sin(ringRotationY) + baseZ * Math.cos(ringRotationY);
           const y1 = baseY;
           
           const dockX = x1;
           const dockY = y1;
           const dockZ = z1 + ORBIT_Z; 

           // Bezier Control Point (High Arc)
           const ctrlX = dockX * 1.5;
           const ctrlY = dockY + 5.0; 
           const ctrlZ = 5.0; 

           return {
               id: Math.random().toString(36).substr(2, 9) + i + now,
               char,
               position: { x: holdX, y: holdY - 2.0, z: holdZ }, // Start slightly below
               velocity: { x: 0, y: 0, z: 0 },
               rotation: { x: 0, y: 0, z: 0 },
               holdPosition: { x: holdX, y: holdY, z: holdZ },
               dockPosition: { x: dockX, y: dockY, z: dockZ },
               controlPoint: { x: ctrlX, y: ctrlY, z: ctrlZ },
               phase: 'spawn',
               spawnTime: now,
               morphTime: now + holdDuration,
               flyStartTime: 0,
               delay: i * 80, // Staggered start
               color: '#FFFFFF'
           };
       });
       
       // Update counters
       if (isRestoring) {
           totalCharCountRef.current = newChars.length;
       } else {
           totalCharCountRef.current += newChars.length;
       }

       newParticleObjs.forEach(p => physicsStateRef.current.set(p.id, p));

       setParticles(prev => {
           const combined = [...prev, ...newParticleObjs];
           // Limit max particles for performance
           if (combined.length > MAX_CHARS) {
               const keep = combined.slice(combined.length - MAX_CHARS);
               // Clean up physics state for removed particles
               const keepIds = new Set(keep.map(p => p.id));
               physicsStateRef.current.forEach((_, id) => {
                   if (!keepIds.has(id)) {
                       physicsStateRef.current.delete(id);
                       textRefs.current.delete(id);
                   }
               });
               return keep;
           }
           return combined;
       });
    }
    
    lastTranscriptRef.current = currentText;
    if (isReset) lastSceneVersionRef.current = sceneVersion;

  }, [transcript, sceneVersion]);


  // --- PHYSICS LOOP ---
  useFrame((state, delta) => {
      if (readingMode) return; // Pause physics in reading mode

      const now = Date.now();
      const time = state.clock.elapsedTime;
      const safeDelta = Math.min(delta, 0.1);

      physicsStateRef.current.forEach((p, id) => {
          const textMesh = textRefs.current.get(id);
          if (!p || !textMesh) return;

          // PHASE 1: SPAWN & RISE
          if (p.phase === 'spawn') {
              const lerpFactor = 3.0 * safeDelta;
              p.position.x += (p.holdPosition.x - p.position.x) * lerpFactor;
              p.position.y += (p.holdPosition.y - p.position.y) * lerpFactor;
              p.position.z += (p.holdPosition.z - p.position.z) * lerpFactor;

              if (now >= p.morphTime) {
                  p.phase = 'fly'; 
                  p.flyStartTime = now + p.delay;
              }
              
              textMesh.position.set(p.position.x, p.position.y + Math.sin(time * 2 + p.position.x) * 0.05, p.position.z);
              textMesh.scale.setScalar(1.0); 
          }

          // PHASE 2: FLY
          else if (p.phase === 'fly') {
              const duration = 2500; 
              const elapsed = now - p.flyStartTime;
              const progress = Math.max(0, Math.min(1, elapsed / duration));
              
              if (progress >= 1 || elapsed > 4000) { 
                  p.phase = 'dock';
              } else {
                  const t = progress;
                  const invT = 1 - t;
                  const cp = p.controlPoint || p.dockPosition; 

                  const bx = (invT * invT * p.holdPosition.x) + (2 * invT * t * cp.x) + (t * t * p.dockPosition.x);
                  const by = (invT * invT * p.holdPosition.y) + (2 * invT * t * cp.y) + (t * t * p.dockPosition.y);
                  const bz = (invT * invT * p.holdPosition.z) + (2 * invT * t * cp.z) + (t * t * p.dockPosition.z);
                  
                  p.position.x = bx;
                  p.position.y = by;
                  p.position.z = bz;
              }

              textMesh.position.set(p.position.x, p.position.y, p.position.z);
              textMesh.scale.setScalar(1.0 + (textSize * 0.2 - 1.0) * progress);
          }

          // PHASE 3: DOCK
          else if (p.phase === 'dock') {
              let tx = p.dockPosition.x;
              let ty = p.dockPosition.y;
              let tz = p.dockPosition.z;

              const angle = time * 0.1;
              const cosA = Math.cos(angle);
              const sinA = Math.sin(angle);
              
              const rotX = tx * cosA - ty * sinA;
              const rotY = tx * sinA + ty * cosA;
              
              tx = rotX;
              ty = rotY;
              tz += Math.sin(time + p.position.x) * 0.2;

              if (handData && handData.detected) {
                  if (handData.gesture === 'OPEN') {
                      const dist = Math.sqrt(tx*tx + ty*ty);
                      tx += (tx/(dist||1)) * 8.0;
                      ty += (ty/(dist||1)) * 8.0;
                      tz += 5.0; 
                  } else if (handData.gesture === 'SWIPE') {
                      const ptrX = handData.pointer.x * 12;
                      const ptrY = handData.pointer.y * 8;
                      const dx = p.position.x - ptrX;
                      const dy = p.position.y - ptrY;
                      const dist = Math.sqrt(dx*dx + dy*dy);
                      if (dist < 3.5) {
                          const force = (1.0 - dist / 3.5) * 6.0;
                          tx += (dx/dist) * force;
                          ty += (dy/dist) * force;
                      }
                  } else if (handData.gesture === 'CLOSED') {
                      // Gather tightly
                      tx = p.dockPosition.x * 0.5;
                      ty = p.dockPosition.y * 0.5;
                  }
              }

              const lerpFactor = handData?.gesture === 'CLOSED' ? 0.2 : 0.05;
              p.position.x += (tx - p.position.x) * lerpFactor;
              p.position.y += (ty - p.position.y) * lerpFactor;
              p.position.z += (tz - p.position.z) * lerpFactor;

              textMesh.position.set(p.position.x, p.position.y, p.position.z);
              textMesh.scale.setScalar(textSize * 0.2); 
          }
      });
  });

  return (
    <group visible={!readingMode}>
      {particles.map((p) => (
        <group key={p.id}>
            {/* Click HitBox (Invisible plane for easier clicking) */}
            <mesh 
                position={[p.position.x, p.position.y, p.position.z]} 
                onClick={(e) => { e.stopPropagation(); if (onTextClick) onTextClick(); }}
                visible={false}
            >
                <planeGeometry args={[0.8, 0.8]} />
            </mesh>
            
            {/* Visual Text */}
            <Text
                ref={(el) => {
                    if (el) textRefs.current.set(p.id, el);
                    else textRefs.current.delete(p.id);
                }}
                position={[p.position.x, p.position.y, p.position.z]}
                fontSize={0.5} 
                anchorX="center"
                anchorY="middle"
                outlineWidth={0.02}
                outlineColor="#ffffff"
                fillOpacity={1.0}
                frustumCulled={false} 
                onClick={(e) => { e.stopPropagation(); if (onTextClick) onTextClick(); }}
                onSync={() => {}}
            >
                {p.char}
            </Text>
        </group>
      ))}
    </group>
  );
};

export default TextParticleSystem;
