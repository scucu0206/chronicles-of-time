
import React, { useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { VoiceMemory, Sentiment } from '../types';

interface VoiceRibbonsProps {
  memories: VoiceMemory[];
}

const Ribbon: React.FC<{ memory: VoiceMemory; index: number }> = ({ memory, index }) => {
  const meshRef = useRef<THREE.Mesh>(null);
  const materialRef = useRef<THREE.ShaderMaterial>(null);
  
  // Create a random organic curve path around the center
  const curve = useMemo(() => {
    const points = [];
    const radius = 6 + Math.random() * 4;
    const yOffset = (Math.random() - 0.5) * 4;
    const tilt = (Math.random() - 0.5) * 1;
    
    for (let i = 0; i <= 20; i++) {
        const t = (i / 20) * Math.PI * 2;
        // Spiral path
        points.push(new THREE.Vector3(
            Math.cos(t) * radius,
            Math.sin(t) * radius * 0.3 + yOffset + Math.sin(t * 3) * 0.5,
            Math.sin(t) * radius
        ).applyAxisAngle(new THREE.Vector3(1,0,0), tilt));
    }
    return new THREE.CatmullRomCurve3(points, true);
  }, []);

  const geometry = useMemo(() => {
      return new THREE.TubeGeometry(curve, 64, 0.04, 8, true);
  }, [curve]);

  // Color based on sentiment
  const color = useMemo(() => {
      if (memory.sentiment === Sentiment.POSITIVE) return new THREE.Color('#34d399'); // Emerald
      if (memory.sentiment === Sentiment.NEGATIVE) return new THREE.Color('#fb7185'); // Rose
      return new THREE.Color('#ffffff'); // White/Neutral
  }, [memory.sentiment]);

  useFrame((state) => {
    if (!meshRef.current || !materialRef.current) return;
    
    // Orbit rotation
    meshRef.current.rotation.y += 0.005 + (index % 3) * 0.002;
    meshRef.current.rotation.x = Math.sin(state.clock.elapsedTime * 0.5 + index) * 0.1;

    // Pulse effect in shader
    materialRef.current.uniforms.uTime.value = state.clock.elapsedTime;
  });

  const shaderArgs = useMemo(() => ({
    uniforms: {
        uTime: { value: 0 },
        uColor: { value: color }
    },
    vertexShader: `
      varying vec2 vUv;
      void main() {
        vUv = uv;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: `
      uniform float uTime;
      uniform vec3 uColor;
      varying vec2 vUv;
      void main() {
        // Flowing light effect along the ribbon
        float flow = sin(vUv.x * 20.0 - uTime * 3.0) * 0.5 + 0.5;
        float alpha = smoothstep(0.0, 0.5, flow) * 0.8;
        
        // Edge glow
        float edge = 1.0 - abs(vUv.y - 0.5) * 2.0;
        
        gl_FragColor = vec4(uColor, (alpha * 0.5 + edge * 0.5) * 0.6);
      }
    `,
    transparent: true,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    side: THREE.DoubleSide
  }), [color]);

  return (
    <mesh ref={meshRef} geometry={geometry}>
        <shaderMaterial ref={materialRef} args={[shaderArgs]} />
    </mesh>
  );
};

export const VoiceRibbons: React.FC<VoiceRibbonsProps> = ({ memories }) => {
  return (
    <group>
      {memories.map((mem, i) => (
        <Ribbon key={mem.id} memory={mem} index={i} />
      ))}
    </group>
  );
};
