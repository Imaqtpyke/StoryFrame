import { useEffect, useRef } from 'react';

interface Particle {
  x: number;
  y: number;
  size: number;
  speedY: number;
  speedX: number;
  opacity: number;
  baseOpacity: number;
  hue: 'amber' | 'neutral';
  pulseSpeed: number;
  pulseOffset: number;
}

export default function BackgroundEffect() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d', { alpha: true });
    if (!ctx) return;

    let animationFrameId: number;
    let width = (canvas.width = window.innerWidth);
    let height = (canvas.height = window.innerHeight);

    const handleResize = () => {
      if (!canvas) return;
      width = canvas.width = window.innerWidth;
      height = canvas.height = window.innerHeight;
      initParticles();
    };

    window.addEventListener('resize', handleResize);

    // Initialize 35mm micro-embers and film dust motes
    const particleCount = Math.min(48, Math.max(24, Math.floor((width * height) / 38000)));
    let particles: Particle[] = [];

    const createParticle = (randomY = true): Particle => {
      const isAmber = Math.random() < 0.65; // Warm cinematic amber tone
      const baseOpacity = isAmber
        ? 0.15 + Math.random() * 0.28
        : 0.10 + Math.random() * 0.18;

      return {
        x: Math.random() * width,
        y: randomY ? Math.random() * height : height + 10,
        size: 0.75 + Math.random() * 1.5,
        speedY: -(0.18 + Math.random() * 0.38), // Gentle upward thermal float
        speedX: (Math.random() - 0.5) * 0.22, // Slight organic drift
        opacity: baseOpacity,
        baseOpacity,
        hue: isAmber ? 'amber' : 'neutral',
        pulseSpeed: 0.015 + Math.random() * 0.03,
        pulseOffset: Math.random() * Math.PI * 2,
      };
    };

    const initParticles = () => {
      particles = [];
      for (let i = 0; i < particleCount; i++) {
        particles.push(createParticle(true));
      }
    };

    initParticles();

    // Create a lightweight, high-performance static offscreen noise canvas for authentic 35mm film grain
    const noiseCanvas = document.createElement('canvas');
    const noiseWidth = 256;
    const noiseHeight = 256;
    noiseCanvas.width = noiseWidth;
    noiseCanvas.height = noiseHeight;
    const noiseCtx = noiseCanvas.getContext('2d');

    if (noiseCtx) {
      const noiseImageData = noiseCtx.createImageData(noiseWidth, noiseHeight);
      const data = noiseImageData.data;
      for (let i = 0; i < data.length; i += 4) {
        // Subtle monochrome luminance variance
        const val = Math.floor(Math.random() * 255);
        data[i] = val;     // R
        data[i + 1] = val; // G
        data[i + 2] = val; // B
        data[i + 3] = Math.random() < 0.3 ? Math.floor(Math.random() * 28) : 0; // Very soft sparse alpha
      }
      noiseCtx.putImageData(noiseImageData, 0, 0);
    }

    const noisePattern = ctx.createPattern(noiseCanvas, 'repeat');

    let t = 0;
    let grainFrame = 0;

    const render = () => {
      t += 0.006;
      grainFrame++;
      ctx.clearRect(0, 0, width, height);

      // 1. Deep Cinematic Atmospheric Vignette & Soft Warm Hearth Glow
      const centerGlowX = width * 0.5 + Math.sin(t * 0.4) * (width * 0.06);
      const centerGlowY = height * 0.35 + Math.cos(t * 0.3) * (height * 0.05);
      const glowRadius = Math.max(width, height) * 0.55;

      const ambientGlow = ctx.createRadialGradient(
        centerGlowX,
        centerGlowY,
        0,
        centerGlowX,
        centerGlowY,
        glowRadius
      );
      // Soft amber-tinted obsidian radiance
      ambientGlow.addColorStop(0, 'rgba(217, 119, 6, 0.028)');
      ambientGlow.addColorStop(0.4, 'rgba(255, 255, 255, 0.012)');
      ambientGlow.addColorStop(1, 'rgba(0, 0, 0, 0)');

      ctx.fillStyle = ambientGlow;
      ctx.fillRect(0, 0, width, height);

      // 2. Vintage 35mm Organic Film Grain Simulation (subtle jitter every 2 frames)
      if (noisePattern) {
        ctx.save();
        ctx.globalAlpha = 0.32;
        // Subtle film gate vibration
        const shiftX = (grainFrame % 3) * 31;
        const shiftY = ((grainFrame + 1) % 4) * 23;
        ctx.translate(shiftX, shiftY);
        ctx.fillStyle = noisePattern;
        ctx.fillRect(-shiftX, -shiftY, width + shiftX, height + shiftY);
        ctx.restore();
      }

      // 3. Floating Micro-Embers & Golden Dust Motes
      for (let i = 0; i < particles.length; i++) {
        const p = particles[i];

        // Animate drift & subtle thermal wave
        p.y += p.speedY;
        p.x += p.speedX + Math.sin(t * 1.5 + p.pulseOffset) * 0.15;

        // Gentle breathing pulsation
        const pulse = Math.sin(t * p.pulseSpeed * 60 + p.pulseOffset);
        const currentOpacity = Math.max(0.04, p.baseOpacity + pulse * 0.08);

        // Respawn if drifted off the top or sides
        if (p.y < -10 || p.x < -10 || p.x > width + 10) {
          particles[i] = createParticle(false);
          continue;
        }

        // Render ember with delicate soft halo
        ctx.save();
        const emberGradient = ctx.createRadialGradient(
          p.x,
          p.y,
          0,
          p.x,
          p.y,
          p.size * 2.4
        );

        if (p.hue === 'amber') {
          // Warm gold/amber ember
          emberGradient.addColorStop(0, `rgba(251, 191, 36, ${currentOpacity.toFixed(3)})`);
          emberGradient.addColorStop(0.5, `rgba(245, 158, 11, ${(currentOpacity * 0.5).toFixed(3)})`);
          emberGradient.addColorStop(1, 'rgba(245, 158, 11, 0)');
        } else {
          // Cinematic neutral silver-white dust mote
          emberGradient.addColorStop(0, `rgba(245, 245, 240, ${(currentOpacity * 0.75).toFixed(3)})`);
          emberGradient.addColorStop(0.6, `rgba(200, 200, 195, ${(currentOpacity * 0.25).toFixed(3)})`);
          emberGradient.addColorStop(1, 'rgba(255, 255, 255, 0)');
        }

        ctx.fillStyle = emberGradient;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size * 2.4, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }

      animationFrameId = requestAnimationFrame(render);
    };

    render();

    return () => {
      window.removeEventListener('resize', handleResize);
      cancelAnimationFrame(animationFrameId);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className="fixed inset-0 pointer-events-none z-0"
      style={{ opacity: 0.95 }}
      aria-hidden="true"
    />
  );
}
