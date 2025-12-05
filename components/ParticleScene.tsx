
import React, { useRef, useMemo, useEffect } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { ParticleData, HandData, Sentiment } from '../types';

interface ParticleSceneProps {
  particles: ParticleData[];
  size: number;
  handData: HandData | null;
  sentiment: Sentiment;
  sceneVersion: number;
  readingMode: boolean; // New Prop
}

// --- GLSL SHADERS ---

const vertexShader = `
  uniform float uTime;
  uniform float uSize;
  uniform vec3 uMouse;
  uniform float uDisruption; // 0.0 = Gathered, >1.0 = Scattered
  uniform vec2 uPointer;     // Hand Pointer for swiping
  uniform float uSwipeActive; // 1.0 if swiping
  uniform float uReadingMode; // 0.0 = Off, 1.0 = On (Blurred/Dimmed)
  
  attribute vec3 color;
  attribute float random;
  attribute vec3 originalPos;

  varying vec3 vColor;
  varying float vAlpha;

  // Simplex Noise 3D function
  vec3 mod289(vec3 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
  vec4 mod289(vec4 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
  vec4 permute(vec4 x) { return mod289(((x*34.0)+1.0)*x); }
  vec4 taylorInvSqrt(vec4 r) { return 1.79284291400159 - 0.85373472095314 * r; }

  float snoise(vec3 v) {
    const vec2  C = vec2(1.0/6.0, 1.0/3.0) ;
    const vec4  D = vec4(0.0, 0.5, 1.0, 2.0);
    vec3 i  = floor(v + dot(v, C.yyy) );
    vec3 x0 = v - i + dot(i, C.xxx) ;
    vec3 g = step(x0.yzx, x0.xyz);
    vec3 l = 1.0 - g;
    vec3 i1 = min( g.xyz, l.zxy );
    vec3 i2 = max( g.xyz, l.zxy );
    vec3 x1 = x0 - i1 + C.xxx;
    vec3 x2 = x0 - i2 + C.yyy;
    vec3 x3 = x0 - D.yyy;
    i = mod289(i);
    vec4 p = permute( permute( permute(
              i.z + vec4(0.0, i1.z, i2.z, 1.0 ))
            + i.y + vec4(0.0, i1.y, i2.y, 1.0 ))
            + i.x + vec4(0.0, i1.x, i2.x, 1.0 ));
    float n_ = 0.142857142857;
    vec3  ns = n_ * D.wyz - D.xzx;
    vec4 j = p - 49.0 * floor(p * ns.z * ns.z);
    vec4 x_ = floor(j * ns.z);
    vec4 y_ = floor(j - 7.0 * x_ );
    vec4 x = x_ *ns.x + ns.yyyy;
    vec4 y = y_ *ns.x + ns.yyyy;
    vec4 h = 1.0 - abs(x) - abs(y);
    vec4 b0 = vec4( x.xy, y.xy );
    vec4 b1 = vec4( x.zw, y.zw );
    vec4 s0 = floor(b0)*2.0 + 1.0;
    vec4 s1 = floor(b1)*2.0 + 1.0;
    vec4 sh = -step(h, vec4(0.0));
    vec4 a0 = b0.xzyw + s0.xzyw*sh.xxyy ;
    vec4 a1 = b1.xzyw + s1.xzyw*sh.zzww ;
    vec3 p0 = vec3(a0.xy,h.x);
    vec3 p1 = vec3(a0.zw,h.y);
    vec3 p2 = vec3(a1.xy,h.z);
    vec3 p3 = vec3(a1.zw,h.w);
    vec4 norm = taylorInvSqrt(vec4(dot(p0,p0), dot(p1,p1), dot(p2, p2), dot(p3,p3)));
    p0 *= norm.x;
    p1 *= norm.y;
    p2 *= norm.z;
    p3 *= norm.w;
    vec4 m = max(0.6 - vec4(dot(x0,x0), dot(x1,x1), dot(x2,x2), dot(x3,x3)), 0.0);
    m = m * m;
    return 42.0 * dot( m*m, vec4( dot(p0,x0), dot(p1,x1), dot(p2,x2), dot(p3,x3) ) );
  }

  vec3 curlNoise(vec3 p) {
    float e = 0.1;
    float n1 = snoise(p + vec3(e, 0, 0));
    float n2 = snoise(p + vec3(-e, 0, 0));
    float n3 = snoise(p + vec3(0, e, 0));
    float n4 = snoise(p + vec3(0, -e, 0));
    float n5 = snoise(p + vec3(0, 0, e));
    float n6 = snoise(p + vec3(0, 0, -e));
    float x = n3 - n4 - n5 + n6;
    float y = n5 - n6 - n1 + n2;
    float z = n1 - n2 - n3 + n4;
    return normalize(vec3(x, y, z));
  }

  void main() {
    vColor = color;
    vec3 pos = originalPos;

    // --- READING MODE BLUR/DEPTH EFFECT ---
    if (uReadingMode > 0.01) {
        // Push back
        pos.z -= 5.0 * uReadingMode;
        
        // Scatter slightly (Blur)
        vec3 noiseBlur = vec3(random - 0.5, fract(random * 10.0) - 0.5, fract(random * 50.0) - 0.5);
        pos += noiseBlur * 2.0 * uReadingMode;
    }

    // --- 1. IDLE / AMBIENT MOTION ---
    // Subtle wave surge when calm
    if (uDisruption < 0.2) {
        float waveX = sin(pos.x * 0.8 + uTime * 0.4);
        float waveY = cos(pos.y * 0.9 + uTime * 0.3);
        float surge = waveX * waveY * 0.3; // Gentle breath
        pos.z += surge; 
    }

    // --- 2. EDGE DISSIPATION ---
    float dist = length(originalPos.xy);
    float edgeFactor = smoothstep(3.5, 6.0, dist);
    
    if (edgeFactor > 0.0) {
        // Continuous flow for edge particles
        vec3 edgeFlow = curlNoise(pos * 0.5 + vec3(0, uTime * 0.2, 0));
        pos += edgeFlow * edgeFactor * 0.8; // More drift
    }

    // --- 3. SWIPE INTERACTION (SAND DISPLACEMENT) ---
    // Single finger swipes create blank space
    if (uSwipeActive > 0.5 && uReadingMode < 0.01) {
        // Calculate distance from particle to pointer (in XY plane)
        float brushRadius = 1.8;
        float dToBrush = distance(pos.xy, uPointer);
        
        if (dToBrush < brushRadius) {
            // Repulsion direction
            vec3 repulsion = normalize(pos - vec3(uPointer, pos.z));
            float force = pow((1.0 - dToBrush / brushRadius), 2.0); // Quadratic falloff for softer edges
            
            // Add some swirl based on noise
            vec3 swirl = curlNoise(pos + uTime);
            
            // Push away logic - Push largely in XY, push slightly down in Z for a "digging" effect
            pos += (repulsion * 3.5 + swirl * 0.5) * smoothstep(0.0, 1.0, force);
            
            // Also push back in Z to create depth crater
            pos.z -= force * 3.0;
        }
    }

    // --- 4. HAND GESTURE (FLOWING SAND SCATTER) ---
    // When uDisruption > 0, we transition to a curl-noise driven flow
    if (uDisruption > 0.01 && uReadingMode < 0.01) {
        vec3 flow = curlNoise(pos * 1.2 + uTime * 0.2); 
        vec3 expansion = normalize(originalPos) * 8.0; 
        vec3 grit = vec3(random - 0.5, fract(random * 13.0) - 0.5, fract(random * 71.0) - 0.5) * 3.0;

        vec3 scatteredPos = originalPos + (flow * 3.0 + expansion * 2.5 + grit) * uDisruption;
        
        pos = mix(pos, scatteredPos, min(1.0, uDisruption * 0.8));
    }

    vec4 mvPosition = modelViewMatrix * vec4(pos, 1.0);
    gl_Position = projectionMatrix * mvPosition;

    // --- SIZE CALCULATION ---
    float sizeRandom = 0.5 + random * 1.0; 
    sizeRandom *= (1.0 - edgeFactor * 0.6); // Edges smaller
    
    // Scale by distance for perspective
    gl_PointSize = (uSize * sizeRandom) * (50.0 / -mvPosition.z);
    
    // --- ALPHA CALCULATION ---
    vAlpha = 1.0;
    vAlpha *= (1.0 - edgeFactor * 0.5); 
    vAlpha *= (1.0 - min(0.6, uDisruption * 0.2));
    
    // Fade out in reading mode
    vAlpha *= (1.0 - uReadingMode * 0.8);
  }
`;

const fragmentShader = `
  varying vec3 vColor;
  varying float vAlpha;

  void main() {
    vec2 cxy = 2.0 * gl_PointCoord - 1.0;
    float r = dot(cxy, cxy);
    if (r > 1.0) discard;

    // Soft circle for dreamy look
    float alpha = 1.0 - smoothstep(0.3, 1.0, r);

    // Add a slight white core for "glowing sand" look
    vec3 finalColor = mix(vColor, vec3(1.0), 0.2 * (1.0 - r));

    gl_FragColor = vec4(finalColor, alpha * vAlpha * 0.8);
  }
`;

const ParticleScene: React.FC<ParticleSceneProps> = ({ particles, size, handData, sentiment, sceneVersion, readingMode }) => {
  const meshRef = useRef<THREE.Points>(null);
  
  const { positions, colors, originals, randoms } = useMemo(() => {
    if (particles.length === 0) {
        return {
            positions: new Float32Array(0),
            colors: new Float32Array(0),
            originals: new Float32Array(0),
            randoms: new Float32Array(0)
        };
    }

    const pos = new Float32Array(particles.length * 3);
    const col = new Float32Array(particles.length * 3);
    const orig = new Float32Array(particles.length * 3);
    const rand = new Float32Array(particles.length);

    particles.forEach((p, i) => {
      pos[i * 3] = p.x;
      pos[i * 3 + 1] = p.y;
      pos[i * 3 + 2] = p.z;

      col[i * 3] = p.r;
      col[i * 3 + 1] = p.g;
      col[i * 3 + 2] = p.b;

      orig[i * 3] = p.originalX;
      orig[i * 3 + 1] = p.originalY;
      orig[i * 3 + 2] = p.originalZ;
      
      rand[i] = p.random;
    });

    return { positions: pos, colors: col, originals: orig, randoms: rand };
  }, [particles, sceneVersion]);

  const uniforms = useRef({
    uTime: { value: 0 },
    uSize: { value: size },
    uMouse: { value: new THREE.Vector3(0, 0, 0) },
    uDisruption: { value: 0 },
    uPointer: { value: new THREE.Vector2(0, 0) },
    uSwipeActive: { value: 0 },
    uReadingMode: { value: 0 },
  });

  useFrame((state) => {
    if (!meshRef.current) return;
    
    uniforms.current.uTime.value = state.clock.getElapsedTime();
    uniforms.current.uSize.value = size; 
    
    // Smooth transition for reading mode
    uniforms.current.uReadingMode.value = THREE.MathUtils.lerp(
        uniforms.current.uReadingMode.value, 
        readingMode ? 1.0 : 0.0, 
        0.05
    );

    // --- INTERACTION LOGIC ---
    let disruptionTarget = 0;
    
    let targetPosX = 0;
    let targetPosY = 0;
    let targetRotX = 0;
    let targetRotY = 0;
    let swipeActive = 0;

    // 1. Sentiment Override (Negative = Scatter)
    if (sentiment === Sentiment.NEGATIVE) {
        disruptionTarget = 1.5; 
    } 

    // 2. Hand Gestures (Only if NOT reading)
    if (handData && handData.detected && !readingMode) {
        
        // --- SCATTER vs GATHER vs SWIPE ---
        if (handData.gesture === 'OPEN') {
             disruptionTarget = 2.5; 
        } else if (handData.gesture === 'CLOSED') {
             disruptionTarget = 0.0; 
        } else if (handData.gesture === 'SWIPE') {
             disruptionTarget = 0.0;
             swipeActive = 1;
             uniforms.current.uPointer.value.set(handData.pointer.x * 12, handData.pointer.y * 8);
        } else {
             disruptionTarget = 0.2; 
        }

        // --- PAN & ROTATE ---
        targetPosX = handData.position.x * 12;
        targetPosY = handData.position.y * 8;
        targetRotX = handData.rotation.y * 1.5; 
        targetRotY = handData.rotation.x * 1.5;

        // Apply Transforms
        meshRef.current.position.x = THREE.MathUtils.lerp(meshRef.current.position.x, targetPosX, 0.1);
        meshRef.current.position.y = THREE.MathUtils.lerp(meshRef.current.position.y, targetPosY, 0.1);
        
        meshRef.current.rotation.x = THREE.MathUtils.lerp(meshRef.current.rotation.x, targetRotX, 0.1);
        meshRef.current.rotation.y = THREE.MathUtils.lerp(meshRef.current.rotation.y, targetRotY, 0.1);

    } else {
        // Reset to Center
        disruptionTarget = 0; 
        
        meshRef.current.position.x = THREE.MathUtils.lerp(meshRef.current.position.x, 0, 0.05);
        meshRef.current.position.y = THREE.MathUtils.lerp(meshRef.current.position.y, 0, 0.05);
        meshRef.current.rotation.x = THREE.MathUtils.lerp(meshRef.current.rotation.x, 0, 0.05);
        meshRef.current.rotation.y = THREE.MathUtils.lerp(meshRef.current.rotation.y, 0, 0.05);
    }

    // --- UNIFORM UPDATES ---
    uniforms.current.uSwipeActive.value = THREE.MathUtils.lerp(uniforms.current.uSwipeActive.value, swipeActive, 0.1); 

    // Transition Physics
    const currentDisruption = uniforms.current.uDisruption.value;
    let lerpSpeed = 0.05;
    if (disruptionTarget > currentDisruption) {
        lerpSpeed = 0.03; 
    } else {
        lerpSpeed = 0.15; 
    }
    
    uniforms.current.uDisruption.value = THREE.MathUtils.lerp(
        currentDisruption,
        disruptionTarget,
        lerpSpeed
    );
  });

  if (particles.length === 0) return null;

  return (
    <points ref={meshRef}>
      <bufferGeometry key={`${particles.length}-${sceneVersion}`}>
        <bufferAttribute attach="attributes-position" count={positions.length / 3} array={positions} itemSize={3} />
        <bufferAttribute attach="attributes-color" count={colors.length / 3} array={colors} itemSize={3} />
        <bufferAttribute attach="attributes-originalPos" count={originals.length / 3} array={originals} itemSize={3} />
        <bufferAttribute attach="attributes-random" count={randoms.length} array={randoms} itemSize={1} />
      </bufferGeometry>
      <shaderMaterial
        vertexShader={vertexShader}
        fragmentShader={fragmentShader}
        uniforms={uniforms.current}
        transparent={true}
        depthWrite={false}
        blending={THREE.NormalBlending} 
      />
    </points>
  );
};

export default ParticleScene;
