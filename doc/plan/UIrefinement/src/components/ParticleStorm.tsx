import React, { useEffect, useRef } from "react";

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
  size: number;
  alpha: number;
}

interface GridPoint {
  angle: number;
  radius: number;
  speed: number;
  size: number;
}

const ParticleStorm: React.FC<{ isShifted: boolean; showDatabase: boolean; rotation: [number, number, number] }> = ({ isShifted, showDatabase, rotation }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const particles = useRef<Particle[]>([]);
  const gridPoints = useRef<GridPoint[]>([]);
  const animationFrameId = useRef<number>(0);

  // Initialize grid points
  useEffect(() => {
    const points: GridPoint[] = [];
    for (let i = 0; i < 200; i++) {
      points.push({
        angle: Math.random() * Math.PI * 2,
        radius: 100 + Math.random() * 300,
        speed: (Math.random() - 0.5) * 0.01,
        size: Math.random() * 2 + 1,
      });
    }
    gridPoints.current = points;
  }, []);

  const currentShift = useRef(0);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const resize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    };

    window.addEventListener("resize", resize);
    resize();

    const render = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      // 1. Smoothly animate the shift
      // Matches App.tsx: x: (selectedRecord || selectedContinent) ? "-25%" : (showDatabase ? "100%" : "0%")
      let targetShift = 0;
      if (isShifted) {
        targetShift = -window.innerWidth * 0.25;
      } else if (showDatabase) {
        targetShift = window.innerWidth;
      }
      
      // Simple lerp for smooth transition (0.08 is the speed)
      currentShift.current += (targetShift - currentShift.current) * 0.08;

      const centerX = canvas.width / 2 + currentShift.current;
      const centerY = canvas.height / 2;
      const maxRadius = Math.max(canvas.width, canvas.height);

      // 1. Radial Gradient Background
      const bgGradient = ctx.createRadialGradient(centerX, centerY, 0, centerX, centerY, maxRadius);
      bgGradient.addColorStop(0, "rgba(255, 255, 255, 0.7)"); // Brighter white center
      bgGradient.addColorStop(0.48, "rgba(255, 255, 255, 0.3)"); // Reduced from 0.6 to 0.48 (20% reduction)
      bgGradient.addColorStop(0.9, "rgba(132, 204, 22, 0.08)"); // Muted green pushed to edges
      bgGradient.addColorStop(1, "rgba(132, 204, 22, 0.12)");
      
      ctx.fillStyle = bgGradient;
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      // 2. Draw Wireframe Arcs (Dynamic)
      ctx.save();
      ctx.translate(centerX, centerY);
      
      const rotationX = (rotation[0] * Math.PI) / 180;
      const rotationY = (rotation[1] * Math.PI) / 180;
      
      ctx.strokeStyle = "rgba(132, 204, 22, 0.2)";
      ctx.lineWidth = 0.8;
      
      for (let i = 0; i < 12; i++) {
        const r = 80 + i * 70;
        ctx.beginPath();
        const baseStartAngle = (i * 137.5) % (Math.PI * 2);
        const dynamicOffset = rotationX * (0.2 + i * 0.05) + (rotationY * 0.1); 
        const startAngle = baseStartAngle + dynamicOffset;
        
        ctx.arc(0, 0, r, startAngle, startAngle + Math.PI * 1.3);
        ctx.stroke();
      }

      // Draw some "cross" stars
      ctx.strokeStyle = "rgba(255, 255, 255, 0.5)"; // White stars
      ctx.lineWidth = 1;
      const drawStar = (x: number, y: number, size: number) => {
        ctx.beginPath();
        for (let j = 0; j < 8; j++) {
          const angle = (j * Math.PI) / 4;
          ctx.moveTo(x, y);
          ctx.lineTo(x + Math.cos(angle) * size, y + Math.sin(angle) * size);
        }
        ctx.stroke();
      };
      
      drawStar(-centerX * 0.3, -centerY * 0.4, 12);
      drawStar(centerX * 0.2, centerY * 0.3, 8);
      drawStar(-centerX * 0.1, centerY * 0.7, 10);
      ctx.restore();

      // 3. Subtle Noise Overlay
      ctx.fillStyle = "rgba(255, 255, 255, 0.2)";
      for (let i = 0; i < 15000; i++) {
        const nx = Math.random() * canvas.width;
        const ny = Math.random() * canvas.height;
        ctx.fillRect(nx, ny, 1, 1);
      }

      animationFrameId.current = requestAnimationFrame(render);
    };

    animationFrameId.current = requestAnimationFrame(render);

    return () => {
      window.removeEventListener("resize", resize);
      cancelAnimationFrame(animationFrameId.current);
    };
  }, [isShifted, showDatabase, rotation]);

  return (
    <canvas
      ref={canvasRef}
      className="absolute inset-0 pointer-events-none z-0"
      style={{ mixBlendMode: "multiply" }}
    />
  );
};

export default ParticleStorm;
