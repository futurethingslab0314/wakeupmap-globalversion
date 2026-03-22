import React, { useMemo } from "react";
import { motion } from "motion/react";

const BackgroundEffects: React.FC = () => {
  // Generate random particles
  const particles = useMemo(() => {
    return Array.from({ length: 120 }).map((_, i) => ({
      id: i,
      size: Math.random() * 3 + 1,
      x: Math.random() * 100,
      y: Math.random() * 100,
      duration: Math.random() * 30 + 40, // Slower for cloud-like feel
      delay: Math.random() * -60,
      opacity: Math.random() * 0.15 + 0.05,
    }));
  }, []);

  return (
    <div className="absolute inset-0 pointer-events-none overflow-hidden z-0 bg-[#f8f8f8]">
      {/* Soft Cloud-like Gradients */}
      <motion.div 
        className="absolute inset-0 opacity-[0.15]"
        animate={{
          backgroundPosition: ["0% 0%", "100% 100%"],
        }}
        transition={{
          duration: 120,
          repeat: Infinity,
          ease: "linear",
        }}
        style={{
          background: "radial-gradient(circle at 20% 30%, rgba(0,0,0,0.1) 0%, transparent 50%), radial-gradient(circle at 80% 70%, rgba(0,0,0,0.05) 0%, transparent 40%)",
          backgroundSize: "200% 200%",
        }}
      />

      {/* Noise Texture Overlay */}
      <motion.div 
        className="absolute inset-[-100%] opacity-[0.04] mix-blend-multiply pointer-events-none"
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.65' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)'/%3E%3C/svg%3E")`,
        }}
        animate={{
          x: [0, -5, 2, -2, 5, 0],
          y: [0, 2, -5, 5, -2, 0],
        }}
        transition={{
          duration: 0.15,
          repeat: Infinity,
          ease: "linear",
        }}
      />

      {/* Scanlines Effect */}
      <motion.div 
        className="absolute inset-0 pointer-events-none opacity-[0.015] z-10"
        style={{ backgroundImage: "linear-gradient(rgba(18, 16, 16, 0) 50%, rgba(0, 0, 0, 0.25) 50%)", backgroundSize: "100% 3px" }}
        animate={{
          backgroundPosition: ["0% 0%", "0% 100%"],
        }}
        transition={{
          duration: 20,
          repeat: Infinity,
          ease: "linear",
        }}
      />

      {/* Vignette */}
      <div className="absolute inset-0 pointer-events-none bg-[radial-gradient(circle_at_center,transparent_40%,rgba(0,0,0,0.04)_100%)]" />

      {/* Floating Particles (Cloud Drift Style) */}
      {particles.map((p) => (
        <motion.div
          key={p.id}
          className="absolute rounded-full bg-black"
          style={{
            width: p.size,
            height: p.size,
            left: `${p.x}%`,
            top: `${p.y}%`,
            opacity: p.opacity,
          }}
          animate={{
            x: [0, 150, 0], // Drifting horizontally like clouds
            y: [0, -30, 0],
            opacity: [p.opacity, p.opacity * 2, p.opacity],
            scale: [1, 1.5, 1],
          }}
          transition={{
            duration: p.duration,
            repeat: Infinity,
            delay: p.delay,
            ease: "easeInOut",
          }}
        />
      ))}
    </div>
  );
};

export default BackgroundEffects;
