import { useState, useEffect, useRef, useCallback } from "react";

export const ParticleEffect = () => {
  const canvasRef = useRef(null);
  const animationFrameRef = useRef(null);
  const particlesRef = useRef([]);
  const lastTimeRef = useRef(0);
  const particleIdRef = useRef(0);

  // Particle configuration
  const config = {
    maxParticles: 50,
    spawnRate: 300, // milliseconds between spawns
    speed: 0.4, // pixels per millisecond
    size: 1,
    opacity: { min: 0.2, max: 0.8 },
    colors: ["#9ca3af", "#6b7280", "#4b5563"], // Different shades of gray
  };

  // Particle class for better organization
  class Particle {
    constructor(canvasWidth, canvasHeight) {
      this.id = particleIdRef.current++;
      this.x = Math.random() * canvasWidth;
      this.y = canvasHeight + 10; // Start below viewport
      this.targetY = -10; // End above viewport
      this.opacity =
        Math.random() * (config.opacity.max - config.opacity.min) +
        config.opacity.min;
      this.speed = config.speed + (Math.random() - 0.5) * 0.01; // Slight speed variation
      this.color =
        config.colors[Math.floor(Math.random() * config.colors.length)];
      this.size = config.size + Math.random() * 1; // Slight size variation
    }

    update(deltaTime) {
      this.y -= this.speed * deltaTime;
      // Fade out as it reaches the top
      const fadeZone = 200;
      if (this.y < fadeZone) {
        this.opacity *= 0.98;
      }
      return this.y > this.targetY && this.opacity > 0.01;
    }

    draw(ctx) {
      ctx.globalAlpha = this.opacity;
      ctx.fillStyle = this.color;
      ctx.beginPath();
      ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  // Resize canvas to match display size
  const resizeCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;

    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;

    const ctx = canvas.getContext("2d");
    ctx.scale(dpr, dpr);

    // Set canvas display size
    canvas.style.width = `${rect.width}px`;
    canvas.style.height = `${rect.height}px`;
  }, []);

  // Animation loop
  const animate = useCallback((currentTime) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    const deltaTime = currentTime - lastTimeRef.current;
    lastTimeRef.current = currentTime;

    // Clear canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Update and draw particles
    particlesRef.current = particlesRef.current.filter((particle) => {
      const isAlive = particle.update(deltaTime);
      if (isAlive) {
        particle.draw(ctx);
      }
      return isAlive;
    });

    // Spawn new particles
    const shouldSpawn =
      particlesRef.current.length < config.maxParticles &&
      Math.random() < deltaTime / config.spawnRate;

    if (shouldSpawn) {
      const rect = canvas.getBoundingClientRect();
      particlesRef.current.push(new Particle(rect.width, rect.height));
    }

    // Continue animation
    animationFrameRef.current = requestAnimationFrame(animate);
  }, []);

  // Setup effect
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    // Initial setup
    resizeCanvas();
    lastTimeRef.current = performance.now();
    animationFrameRef.current = requestAnimationFrame(animate);

    // Handle resize
    const handleResize = () => {
      resizeCanvas();
    };
    window.addEventListener("resize", handleResize);

    // Cleanup
    return () => {
      window.removeEventListener("resize", handleResize);
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
      particlesRef.current = [];
    };
  }, [animate, resizeCanvas]);

  // Pause animation when tab is not visible (performance optimization)
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.hidden) {
        if (animationFrameRef.current) {
          cancelAnimationFrame(animationFrameRef.current);
        }
      } else {
        lastTimeRef.current = performance.now();
        animationFrameRef.current = requestAnimationFrame(animate);
      }
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () =>
      document.removeEventListener("visibilitychange", handleVisibilityChange);
  }, [animate]);

  return (
    <canvas
      ref={canvasRef}
      aria-hidden="true"
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        width: "100%",
        height: "100%",
        pointerEvents: "none",
        zIndex: 0,
      }}
    />
  );
};
