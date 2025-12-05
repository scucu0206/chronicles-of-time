
import React, { useRef, useState, useMemo, useEffect } from 'react';
import { useFrame } from '@react-three/fiber';
import { Text, Html, OrbitControls } from '@react-three/drei';
import * as THREE from 'three';
import { MemoryPackage, Sentiment, HandData } from '../types';

interface MemoryPalaceProps {
  memories: MemoryPackage[];
  onRestore: (memory: MemoryPackage) => void;
  handData: HandData | null;
}

// --- GRADIENT BUBBLE SHADER MATERIAL ---
const bubbleVertexShader = `
  varying vec2 vUv;
  varying vec3 vNormal;
  varying vec3 vViewPosition;

  void main() {
    vUv = uv;
    vNormal = normalize(normalMatrix * normal);
    vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
    vViewPosition = -mvPosition.xyz;
    gl_Position = projectionMatrix * mvPosition;
  }
`;

const bubbleFragmentShader = `
  uniform vec3 uColor1;
  uniform vec3 uColor2;
  uniform vec3 uColor3;
  uniform sampler2D uTexture;
  uniform float uTime;
  uniform float uMatchScore; // 0.0 to 1.0, -1.0 for dim

  varying vec2 vUv;
  varying vec3 vNormal;
  varying vec3 vViewPosition;

  void main() {
    vec3 normal = normalize(vNormal);
    vec3 viewDir = normalize(vViewPosition);

    // 1. Tri-Color Gradient based on Y-axis (vUv.y)
    vec3 gradient = mix(uColor1, uColor2, smoothstep(0.0, 0.5, vUv.y));
    gradient = mix(gradient, uColor3, smoothstep(0.5, 1.0, vUv.y));

    // 2. Texture Sample (The Snapshot)
    vec4 texColor = texture2D(uTexture, vUv);
    
    // Blend Gradient with Texture (Overlay mode approximation)
    vec3 baseColor = mix(gradient, texColor.rgb, 0.6); 

    // 3. Fresnel Effect (Rim Light)
    float fresnelTerm = dot(viewDir, normal);
    fresnelTerm = clamp(1.0 - fresnelTerm, 0.0, 1.0);
    float fresnel = pow(fresnelTerm, 3.0);

    // 4. Inner Glow / Pulse
    float pulse = sin(uTime * 2.0) * 0.1 + 0.9;
    
    // 5. Voice Search Highlight Logic
    vec3 highlightColor = vec3(1.0, 0.8, 0.2); // Gold
    
    if (uMatchScore > 0.0) {
        // MATCHED: Strong Pulse & Gold Tint
        pulse = sin(uTime * 8.0) * 0.3 + 1.2; 
        baseColor = mix(baseColor, highlightColor, uMatchScore * 0.6); 
        fresnel *= 2.5; 
    } else if (uMatchScore < -0.5) {
        // UNMATCHED (DIMMED): Darken and fade
        baseColor *= 0.2; 
        pulse = 0.8;
        fresnel *= 0.5;
    }

    vec3 finalColor = mix(baseColor, vec3(1.0), fresnel * 0.8);
    finalColor *= pulse;

    // Opacity logic for dimming
    float alpha = 0.9;
    if (uMatchScore < -0.5) alpha = 0.3;

    gl_FragColor = vec4(finalColor, alpha);
  }
`;

const MemoryBubble: React.FC<{ 
  memory: MemoryPackage; 
  targetPosition: [number, number, number]; // Target for animation
  onClick: () => void;
  hasActiveSearch: boolean;
}> = ({ memory, targetPosition, onClick, hasActiveSearch }) => {
  const meshRef = useRef<THREE.Group>(null);
  const materialRef = useRef<THREE.ShaderMaterial>(null);
  const [hovered, setHovered] = useState(false);

  // Position Lerping State
  const currentPos = useRef(new THREE.Vector3(...targetPosition));

  const texture = useMemo(() => {
    const loader = new THREE.TextureLoader();
    return loader.load(memory.thumbnail);
  }, [memory.thumbnail]);

  const colors = useMemo(() => {
      const palette = memory.palette && memory.palette.length === 3 
          ? memory.palette 
          : [memory.dominantColor || '#ffffff', memory.dominantColor || '#ffffff', '#ffffff'];
      
      return {
          c1: new THREE.Color(palette[0]),
          c2: new THREE.Color(palette[1]),
          c3: new THREE.Color(palette[2])
      };
  }, [memory.palette, memory.dominantColor]);

  // Determine uniform value for match score
  const matchUniformVal = useMemo(() => {
      if (!hasActiveSearch) return 0.0;
      // If score > 0 return score. If score is 0 but search is active, return -1 (Dim)
      return (memory.matchScore || 0) > 0 ? (memory.matchScore || 0) : -1.0;
  }, [hasActiveSearch, memory.matchScore]);

  const uniforms = useMemo(() => ({
      uColor1: { value: colors.c1 },
      uColor2: { value: colors.c2 },
      uColor3: { value: colors.c3 },
      uTexture: { value: texture },
      uTime: { value: 0 },
      uMatchScore: { value: 0 }
  }), [colors, texture]);

  // Update uniform ref
  useEffect(() => {
      if (materialRef.current) {
          materialRef.current.uniforms.uMatchScore.value = matchUniformVal;
      }
  }, [matchUniformVal]);

  useFrame((state) => {
    if (!meshRef.current) return;
    const time = state.clock.elapsedTime;
    
    // --- ANIMATION: FOCUS LERP ---
    // Smoothly interpolate current position to target position
    // This creates the "Focus Animation" effect
    const targetVec = new THREE.Vector3(...targetPosition);
    
    // Add floating motion to target (only if not moving fast)
    if (matchUniformVal >= 0) {
        targetVec.y += Math.sin(time + targetPosition[0]) * 0.5;
    }
    
    currentPos.current.lerp(targetVec, 0.05); // 0.05 factor for smooth ease-out
    meshRef.current.position.copy(currentPos.current);

    // Rotation
    meshRef.current.rotation.y += 0.002;
    
    if (materialRef.current) {
        materialRef.current.uniforms.uTime.value = time;
    }
  });

  const ringGeo = useMemo(() => new THREE.TorusGeometry(3.2, 0.05, 16, 100), []);

  return (
    <group 
      ref={meshRef} 
      onClick={(e) => { e.stopPropagation(); onClick(); }}
      onPointerOver={() => setHovered(true)}
      onPointerOut={() => setHovered(false)}
      scale={matchUniformVal > 0 ? 1.2 : 1.0} 
    >
      {/* 1. The Image Sphere */}
      <mesh>
        <sphereGeometry args={[2.5, 64, 64]} />
        <shaderMaterial 
            ref={materialRef}
            vertexShader={bubbleVertexShader}
            fragmentShader={bubbleFragmentShader}
            uniforms={uniforms}
            transparent={true}
        />
      </mesh>

      {/* 2. Text Halo Ring */}
      <mesh geometry={ringGeo} rotation={[Math.PI / 2, 0, 0]}>
        <meshBasicMaterial 
            color={memory.dominantColor || "#ffffff"} 
            transparent 
            opacity={(hovered || matchUniformVal > 0) ? 0.9 : (matchUniformVal < -0.5 ? 0.2 : 0.6)}
            toneMapped={false} 
        />
      </mesh>

      {/* 3. Labels (Hide if dimmed) */}
      {matchUniformVal >= -0.5 && (
          <group position={[0, -3.5, 0]}>
            <Text fontSize={0.4} color="white" anchorX="center" anchorY="top" outlineWidth={0.02}>
              {new Date(memory.timestamp).toLocaleDateString()}
            </Text>
            <Text position={[0, -0.6, 0]} fontSize={0.3} color="#ffffff" anchorX="center" anchorY="top">
              {memory.sentiment.toUpperCase()}
            </Text>
          </group>
      )}

      {/* 4. Hover Info */}
      {(hovered || matchUniformVal > 0) && (
        <Html position={[0, 4, 0]} center distanceFactor={10}>
          <div className="bg-black/80 backdrop-blur-md border border-white/20 p-4 rounded-lg text-center w-48 pointer-events-none">
            {matchUniformVal > 0 && (
                <div className="mb-2 text-yellow-400 font-bold text-xs animate-pulse">MATCH {(matchUniformVal * 100).toFixed(0)}%</div>
            )}
            <p className="text-white text-xs font-light mb-1">TRANSCRIPT</p>
            <p className="text-white/80 text-xs italic line-clamp-3">
              "{memory.transcriptSnapshot || 'No voice data'}"
            </p>
          </div>
        </Html>
      )}
    </group>
  );
};

const MemoryPalace: React.FC<MemoryPalaceProps> = ({ memories, onRestore, handData }) => {
  const groupRef = useRef<THREE.Group>(null);
  
  // Gesture State Manager
  const gestureState = useRef({
      prevPinch: 0,
      prevPalm: { x: 0, y: 0 },
      targetRot: { x: 0, y: 0 },
      targetScale: 1.0,
      isPinching: false,
      isPanning: false
  });

  const hasActiveSearch = useMemo(() => {
      return memories.some(m => (m.matchScore || 0) > 0);
  }, [memories]);

  // --- DYNAMIC LAYOUT CALCULATION ---
  const targetPositions = useMemo(() => {
    // 1. Filter matches for Focus Mode
    // Note: memories are already sorted by matchScore in App.tsx
    const matches = memories.filter(m => (m.matchScore || 0) > 0);
    const nonMatches = memories.filter(m => (m.matchScore || 0) <= 0);

    // Helper map to store positions by ID
    const posMap = new Map<string, [number, number, number]>();

    if (hasActiveSearch && matches.length > 0) {
        // --- FOCUS MODE (Search Active) ---
        
        // Strategy: Alternating layout to place highest scores in center
        // Index 0 -> Center (0)
        // Index 1 -> Right (+1)
        // Index 2 -> Left (-1)
        // Index 3 -> Right (+2)
        // Index 4 -> Left (-2)
        
        const spread = 7.0; // Spacing between bubbles

        matches.forEach((mem, i) => {
            // Calculate Alternating Offset
            let offsetUnit = 0;
            if (i > 0) {
                offsetUnit = Math.ceil(i / 2) * (i % 2 === 1 ? 1 : -1);
            }
            
            const offset = offsetUnit * spread;
            
            // Z-Position: Center is closest (6.0), edges recede slightly
            const z = 6.0 - Math.abs(offsetUnit) * 1.5; 
            
            // Y-Position: Slight arch
            const y = -Math.abs(offsetUnit) * 0.5;

            posMap.set(mem.id, [offset, y, z]);
        });

        // Scatter non-matches in deep background
        nonMatches.forEach((mem, i) => {
             const angle = i * 137.5 * (Math.PI / 180); 
             const radius = 20 + Math.random() * 10;
             const x = Math.cos(angle) * radius;
             const y = (Math.random() - 0.5) * 15;
             const z = -15 - Math.random() * 10; // Deep background
             posMap.set(mem.id, [x, y, z]);
        });

    } else {
        // --- GALLERY MODE (Default Spiral) ---
        memories.forEach((mem, i) => {
            const angle = i * 1.5; 
            const radius = 5 + i * 4; 
            const x = Math.cos(angle) * radius;
            const z = Math.sin(angle) * radius;
            const y = Math.sin(i * 0.5) * 2;
            posMap.set(mem.id, [x, y, z]);
        });
    }

    return posMap;
  }, [memories, hasActiveSearch]);

  useFrame(() => {
      if (!groupRef.current) return;
      
      const state = gestureState.current;
      
      if (handData && handData.detected) {
          // --- SCALE CONTROL (PINCH) ---
          const pinchDist = handData.pinchDistance || 1.0;
          const isPinchingNow = pinchDist < 0.15; 

          if (isPinchingNow) {
              if (!state.isPinching) {
                  state.isPinching = true;
                  state.prevPinch = pinchDist;
              } else {
                  const safePrev = state.prevPinch || 0.001;
                  const ratio = pinchDist / safePrev;
                  const scaleDelta = (ratio - 1) * 1.5; 
                  
                  let newScale = state.targetScale + scaleDelta;
                  newScale = Math.max(0.3, Math.min(3.0, newScale));
                  state.targetScale = newScale;
                  state.prevPinch = pinchDist;
              }
          } else {
              state.isPinching = false;
          }

          // --- ROTATION CONTROL (PAN) ---
          if (!isPinchingNow) {
              if (!state.isPanning) {
                  state.isPanning = true;
                  state.prevPalm = handData.palmCenter;
              } else {
                  const dx = handData.palmCenter.x - state.prevPalm.x;
                  const dy = handData.palmCenter.y - state.prevPalm.y;
                  
                  state.targetRot.y += dx * 0.5; 
                  state.targetRot.x += dy * 0.5; 
                  
                  state.prevPalm = handData.palmCenter;
              }
          } else {
              state.isPanning = false;
          }
      }

      // Smooth Interpolation for Scene
      groupRef.current.rotation.y = THREE.MathUtils.lerp(groupRef.current.rotation.y, state.targetRot.y, 0.1);
      groupRef.current.rotation.x = THREE.MathUtils.lerp(groupRef.current.rotation.x, state.targetRot.x, 0.1);
      groupRef.current.scale.setScalar(THREE.MathUtils.lerp(groupRef.current.scale.x, state.targetScale, 0.1));
  });

  return (
    <>
      <ambientLight intensity={0.5} />
      <pointLight position={[10, 10, 10]} intensity={1} />
      <fog attach="fog" args={['#050505', 5, 50]} />

      <group ref={groupRef}>
        {memories.map((mem) => {
            const targetPos = targetPositions.get(mem.id) || [0,0,0];
            return (
              <MemoryBubble 
                key={mem.id} 
                memory={mem} 
                targetPosition={targetPos} 
                onClick={() => onRestore(mem)} 
                hasActiveSearch={hasActiveSearch}
              />
            );
        })}
        
        {memories.length === 0 && (
          <Text position={[0, 0, 0]} fontSize={1} color="white" anchorX="center" anchorY="middle">
            No Memories Saved Yet
          </Text>
        )}
      </group>

      {!handData?.detected && (
        <OrbitControls enableZoom={true} enablePan={true} enableRotate={true} autoRotate={false} />
      )}
    </>
  );
};

export default MemoryPalace;
