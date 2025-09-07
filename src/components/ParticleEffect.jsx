import { useState, useEffect, useRef } from "react";

export const ParticleEffect = () => {
  const [particles, setParticles] = useState([]);
  const particleIdRef = useRef(0);
  const intervalRef = useRef(null);

  useEffect(() => {
    const createParticle = () => {
      const id = particleIdRef.current++;
      const newParticle = {
        id,
        x: Math.random() * window.innerWidth,
        opacity: Math.random() * 0.8 + 0.2,
        duration: Math.random() * 3000 + 2000,
      };

      setParticles((prev) => [...prev, newParticle]);

      // Remove particle after animation completes
      setTimeout(() => {
        setParticles((prev) => prev.filter((p) => p.id !== id));
      }, newParticle.duration);
    };

    intervalRef.current = setInterval(createParticle, 300);

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
      // Clean up all particles
      setParticles([]);
    };
  }, []);

  return (
    <div
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        width: "100%",
        height: "100%",
        pointerEvents: "none",
        zIndex: 0,
      }}
    >
      {particles.map((particle) => (
        <div
          key={particle.id}
          aria-hidden="true"
          style={{
            position: "absolute",
            width: "2px",
            height: "2px",
            background: "#9ca3af",
            left: `${particle.x}px`,
            top: "100%",
            opacity: particle.opacity,
            animation: `floatUp ${particle.duration}ms linear forwards`,
          }}
        />
      ))}
      <style
        dangerouslySetInnerHTML={{
          __html: `
          @keyframes floatUp {
            from {
              transform: translateY(0px);
            }
            to {
              transform: translateY(-${window.innerHeight + 100}px);
              opacity: 0;
            }
          }
        `,
        }}
      />
    </div>
  );
};
