import { useEffect, useRef, useCallback } from "react";
import { scheduleAfterFirstPaint } from "../lib/nonCriticalScheduler";

const config = {
  maxParticles: 50,
  spawnRate: 300,
  speed: 0.4,
  size: 1,
  opacity: { min: 0.2, max: 0.8 },
  colors: ["#9ca3af", "#6b7280", "#4b5563"],
};

export const ParticleEffect = () => {
  const canvasRef = useRef(null);
  const animationFrameRef = useRef(null);
  const particlesRef = useRef([]);
  const lastTimeRef = useRef(0);
  const particleIdRef = useRef(0);
  // Armed only after post-paint start so visibility resume cannot open a loop
  // before the deferred first frame, and StrictMode cleanup can disarm it.
  const loopArmedRef = useRef(false);

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

  // Resize backing store to the current CSS box + DPR. Do not write pixel
  // width/height into style - that locks the box to the old viewport and breaks
  // later resize/orientation updates (CSS stays width/height 100%).
  const resizeCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    const width = Math.max(1, Math.round(rect.width * dpr));
    const height = Math.max(1, Math.round(rect.height * dpr));

    if (canvas.width !== width || canvas.height !== height) {
      canvas.width = width;
      canvas.height = height;
    }

    const ctx = canvas.getContext("2d");
    // width/height assignment resets the context; map CSS pixels via DPR.
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
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
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Setup effect: keep the canvas mounted; arm setup + first rAF only after
  // the initial React commit and a meaningful browser paint.
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    // Respect reduced-motion: the global CSS rule can't stop this canvas rAF, so
    // skip the animation entirely (no drifting particles) and leave the canvas blank.
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      resizeCanvas();
      return;
    }

    let cancelled = false;

    const stopLoop = () => {
      if (animationFrameRef.current !== null) {
        cancelAnimationFrame(animationFrameRef.current);
        animationFrameRef.current = null;
      }
    };

    const startLoop = () => {
      if (cancelled || loopArmedRef.current) return;
      loopArmedRef.current = true;
      resizeCanvas();
      // Arm after paint even if the tab is hidden; visibility handler resumes.
      if (document.hidden) return;
      lastTimeRef.current = performance.now();
      animationFrameRef.current = requestAnimationFrame(animate);
    };

    const cancelPaint = scheduleAfterFirstPaint(startLoop);

    // Handle resize
    const handleResize = () => {
      resizeCanvas();
    };
    window.addEventListener("resize", handleResize);

    // Cleanup
    return () => {
      cancelled = true;
      loopArmedRef.current = false;
      cancelPaint();
      window.removeEventListener("resize", handleResize);
      stopLoop();
      particlesRef.current = [];
    };
  }, [animate, resizeCanvas]);

  // Pause animation when tab is not visible (performance optimization).
  useEffect(() => {
    // Reduced motion: the setup effect never starts the loop, so don't register a
    // handler that could restart it when the tab regains focus.
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    const handleVisibilityChange = () => {
      if (document.hidden) {
        if (animationFrameRef.current !== null) {
          cancelAnimationFrame(animationFrameRef.current);
          animationFrameRef.current = null;
        }
      } else if (loopArmedRef.current && animationFrameRef.current === null) {
        // Only restart when armed and nothing is scheduled, so we never stack
        // rAF loops or start before the post-paint deferral completes.
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
