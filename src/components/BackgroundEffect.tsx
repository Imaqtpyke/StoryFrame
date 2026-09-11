import { useEffect, useRef } from 'react';

export default function BackgroundEffect() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animationFrameId: number;
    let width = (canvas.width = window.innerWidth);
    let height = (canvas.height = window.innerHeight);

    const handleResize = () => {
      if (!canvas) return;
      width = canvas.width = window.innerWidth;
      height = canvas.height = window.innerHeight;
    };

    window.addEventListener('resize', handleResize);

    const dotSpacing = 32;
    let t = 0;

    const render = () => {
      t += 0.005;
      ctx.clearRect(0, 0, width, height);

      // Ambient moving soft grayscale glow
      const cx1 = width * 0.3 + Math.sin(t * 0.7) * (width * 0.15);
      const cy1 = height * 0.4 + Math.cos(t * 0.5) * (height * 0.15);
      const radius1 = Math.min(width, height) * 0.5;

      const gradient = ctx.createRadialGradient(cx1, cy1, 0, cx1, cy1, radius1);
      gradient.addColorStop(0, 'rgba(255, 255, 255, 0.035)');
      gradient.addColorStop(0.5, 'rgba(200, 200, 200, 0.015)');
      gradient.addColorStop(1, 'rgba(0, 0, 0, 0)');

      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, width, height);

      // Subtle monochrome dot grid
      ctx.fillStyle = 'rgba(255, 255, 255, 0.07)';
      for (let x = dotSpacing; x < width; x += dotSpacing) {
        for (let y = dotSpacing; y < height; y += dotSpacing) {
          // Micro shimmer based on ambient distance
          const dx = x - cx1;
          const dy = y - cy1;
          const dist = Math.sqrt(dx * dx + dy * dy);
          const factor = Math.max(0, 1 - dist / radius1);
          const alpha = 0.05 + factor * 0.06;

          ctx.fillStyle = `rgba(255, 255, 255, ${alpha.toFixed(3)})`;
          ctx.fillRect(x, y, 1.2, 1.2);
        }
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
      style={{ opacity: 0.85 }}
      aria-hidden="true"
    />
  );
}
