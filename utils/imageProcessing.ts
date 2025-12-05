
import { ParticleData } from '../types';

export const processImageToParticles = (imageUrl: string, targetCount: number): Promise<ParticleData[]> => {
  return new Promise((resolve, reject) => {
    const img = new Image();
    
    // Only set crossOrigin for remote URLs. 
    // Setting it for local 'blob:' or 'data:' URLs can cause security errors or load failures in some browsers.
    if (!imageUrl.startsWith('blob:') && !imageUrl.startsWith('data:')) {
        img.crossOrigin = "Anonymous";
    }
    
    img.src = imageUrl;

    img.onload = () => {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        reject(new Error("Could not get canvas context"));
        return;
      }

      // Internal resolution for sampling
      const width = 800; 
      const aspectRatio = img.width / img.height;
      const height = width / aspectRatio;
      
      canvas.width = width;
      canvas.height = height;
      
      ctx.drawImage(img, 0, 0, width, height);
      const imgData = ctx.getImageData(0, 0, width, height);
      const data = imgData.data;

      const particles: ParticleData[] = [];
      let attempts = 0;
      // Allow more attempts to fill the high density
      const maxAttempts = targetCount * 200; 

      while (particles.length < targetCount && attempts < maxAttempts) {
        attempts++;
        
        // Monte Carlo Sampling with Central Bias
        const rx = Math.floor(Math.random() * width);
        const ry = Math.floor(Math.random() * height);

        // Normalize coordinates to -1 to 1 for distance check
        const nx = (rx / width) * 2 - 1;
        const ny = (ry / height) * 2 - 1;
        const distFromCenter = Math.sqrt(nx*nx + ny*ny); // 0 at center, ~1.4 at corners

        // Rejection Sampling for Vignette Density
        // Probability of keeping a point drops as it gets further from center
        // Formula: Keep if random > dist^2 (Creates quadratic falloff)
        // Tune the exponent to change falloff sharpness (1.5 = smooth, 3.0 = sharp)
        if (Math.random() < Math.pow(distFromCenter, 1.5)) {
             // Skip this point (it's too far from center relative to probability)
             // However, we don't want to leave edges EMPTY, just sparse.
             // So we combine density check with a base chance.
             if (Math.random() > 0.15) continue; 
        }

        const i = (ry * width + rx) * 4;

        // Skip transparent or very dark pixels
        if (data[i + 3] > 20) { 
            const r = data[i] / 255;
            const g = data[i + 1] / 255;
            const b = data[i + 2] / 255;

            // Calculate Luminance (Perceived Brightness)
            const luminance = 0.21 * r + 0.72 * g + 0.07 * b;

            // Map Luminance to Z-Axis (Depth)
            // Brighter = Closer (Positive Z), Darker = Further (Negative Z)
            const zDepth = (luminance - 0.5) * 2.5;

            // Normalized coordinates centered at 0
            const finalX = (rx / width - 0.5) * 10 * aspectRatio; 
            const finalY = -(ry / height - 0.5) * 10; 

            particles.push({
                x: finalX,
                y: finalY,
                z: zDepth, 
                originalX: finalX,
                originalY: finalY,
                originalZ: zDepth,
                r, g, b,
                random: Math.random()
            });
        }
      }

      if (particles.length === 0) {
           particles.push({ x:0, y:0, z:0, originalX:0, originalY:0, originalZ:0, r:1, g:1, b:1, random:0 });
      }

      resolve(particles);
    };

    img.onerror = (err) => reject(err);
  });
};
