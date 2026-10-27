"use client";

import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";

interface SparklesProps {
  className?: string;
  size?: number;
  minSize?: number | null;
  density?: number;
  speed?: number;
  opacity?: number;
  color?: string;
  background?: string;
}

// Canvas fillStyle cannot resolve CSS custom properties, so read the token here.
const resolveColor = (value: string) => {
  if (!value.startsWith("var(")) return value;
  const name = value.slice(4, -1).trim();
  return (
    getComputedStyle(document.documentElement).getPropertyValue(name).trim() ||
    "#FFFFFF"
  );
};

export const Sparkles = (props: SparklesProps) => {  const {
    className,
    size = 1.2,
    minSize = null,
    density = 800,
    speed = 1.5,
    opacity = 1,
    color = "#FFFFFF",
    background = "transparent",
  } = props;

  const [random, setRandom] = useState<number[]>([]);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const array = Array.from({ length: density }, () => Math.random());
    setRandom(array);
  }, [density]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let animationFrameId: number;
    const fillColor = resolveColor(color);
    let particles: Array<{
      x: number;
      y: number;
      vx: number;
      vy: number;
      size: number;
      opacity: number;
    }> = [];

    const resizeCanvas = () => {
      canvas.width = canvas.offsetWidth;
      canvas.height = canvas.offsetHeight;
    };

    resizeCanvas();
    window.addEventListener("resize", resizeCanvas);

    for (let i = 0; i < density; i++) {
      particles.push({
        x: Math.random() * canvas.width,
        y: Math.random() * canvas.height,
        vx: (Math.random() - 0.5) * speed,
        vy: (Math.random() - 0.5) * speed,
        size: Math.random() * size + (minSize || 0),
        opacity: Math.random() * opacity,
      });
    }

    const animate = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      particles.forEach((particle) => {
        particle.x += particle.vx;
        particle.y += particle.vy;

        if (particle.x < 0) particle.x = canvas.width;
        if (particle.x > canvas.width) particle.x = 0;
        if (particle.y < 0) particle.y = canvas.height;
        if (particle.y > canvas.height) particle.y = 0;

        ctx.beginPath();
        ctx.arc(particle.x, particle.y, particle.size, 0, Math.PI * 2);
        ctx.fillStyle = fillColor;
        ctx.globalAlpha = particle.opacity;
        ctx.fill();
      });

      animationFrameId = requestAnimationFrame(animate);
    };

    animate();

    return () => {
      window.removeEventListener("resize", resizeCanvas);
      cancelAnimationFrame(animationFrameId);
    };
  }, [random, size, minSize, density, speed, opacity, color]);

  return (
    <canvas
      ref={canvasRef}
      className={cn("absolute inset-0 h-full w-full", className)}
      style={{ background }}
    />
  );
};

export default Sparkles;
