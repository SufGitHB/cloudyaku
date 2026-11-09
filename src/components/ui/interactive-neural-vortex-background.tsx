import { useEffect, useRef } from "react";

import { cn } from "@/lib/utils";

const VERTEX_SHADER = `
  precision mediump float;
  attribute vec2 a_position;
  varying vec2 vUv;
  void main() {
    vUv = .5 * (a_position + 1.);
    gl_Position = vec4(a_position, 0.0, 1.0);
  }
`;

const FRAGMENT_SHADER = `
  precision mediump float;
  varying vec2 vUv;
  uniform float u_time;
  uniform float u_ratio;
  uniform vec2 u_pointer_position;
  uniform float u_scroll_progress;

  vec2 rotate(vec2 uv, float th) {
    return mat2(cos(th), sin(th), -sin(th), cos(th)) * uv;
  }

  float neuro_shape(vec2 uv, float t, float p) {
    vec2 sine_acc = vec2(0.);
    vec2 res = vec2(0.);
    float scale = 8.;
    for (int j = 0; j < 15; j++) {
      uv = rotate(uv, 1.);
      sine_acc = rotate(sine_acc, 1.);
      vec2 layer = uv * scale + float(j) + sine_acc - t;
      sine_acc += sin(layer) + 2.4 * p;
      res += (.5 + .5 * cos(layer)) / scale;
      scale *= (1.2);
    }
    return res.x + res.y;
  }

  void main() {
    vec2 uv = .5 * vUv;
    uv.x *= u_ratio;
    vec2 pointer = vUv - u_pointer_position;
    pointer.x *= u_ratio;
    float p = clamp(length(pointer), 0., 1.);
    p = .5 * pow(1. - p, 2.);
    float t = .001 * u_time;
    vec3 color = vec3(0.);
    float noise = neuro_shape(uv, t, p);
    noise = 1.2 * pow(noise, 3.);
    noise += pow(noise, 10.);
    noise = max(.0, noise - .5);
    noise *= (1. - length(vUv - .5));
    color = vec3(0.5, 0.15, 0.65);
    color = mix(color, vec3(0.02, 0.7, 0.9), 0.32 + 0.16 * sin(2.0 * u_scroll_progress + 1.2));
    color += vec3(0.15, 0.0, 0.6) * sin(2.0 * u_scroll_progress + 1.5);
    color = color * noise;
    gl_FragColor = vec4(color, noise);
  }
`;

const compileShader = (
  gl: WebGLRenderingContext,
  source: string,
  type: number,
) => {
  const shader = gl.createShader(type);
  if (!shader) return null;
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    console.error("Shader error:", gl.getShaderInfoLog(shader));
    gl.deleteShader(shader);
    return null;
  }
  return shader;
};

type InteractiveNeuralVortexProps = {
  className?: string;
};

/** Full-viewport WebGL background that reacts to the pointer and to scrolling. */
const InteractiveNeuralVortex = ({
  className,
}: InteractiveNeuralVortexProps) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const gl = canvas?.getContext("webgl");
    // Without WebGL the page simply keeps its normal background.
    if (!canvas || !gl) return;

    const vertexShader = compileShader(gl, VERTEX_SHADER, gl.VERTEX_SHADER);
    const fragmentShader = compileShader(
      gl,
      FRAGMENT_SHADER,
      gl.FRAGMENT_SHADER,
    );
    const program = gl.createProgram();
    if (!vertexShader || !fragmentShader || !program) return;

    gl.attachShader(program, vertexShader);
    gl.attachShader(program, fragmentShader);
    gl.linkProgram(program);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
      console.error("Program link error:", gl.getProgramInfoLog(program));
      return;
    }
    gl.useProgram(program);

    const vertexBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, vertexBuffer);
    gl.bufferData(
      gl.ARRAY_BUFFER,
      new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]),
      gl.STATIC_DRAW,
    );
    const positionLocation = gl.getAttribLocation(program, "a_position");
    gl.enableVertexAttribArray(positionLocation);
    gl.vertexAttribPointer(positionLocation, 2, gl.FLOAT, false, 0, 0);

    const uTime = gl.getUniformLocation(program, "u_time");
    const uRatio = gl.getUniformLocation(program, "u_ratio");
    const uPointerPosition = gl.getUniformLocation(
      program,
      "u_pointer_position",
    );
    const uScrollProgress = gl.getUniformLocation(
      program,
      "u_scroll_progress",
    );

    const pointer = { x: 0, y: 0, targetX: 0, targetY: 0 };
    const reduceMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;
    let frameId = 0;

    const draw = () => {
      pointer.x += (pointer.targetX - pointer.x) * 0.2;
      pointer.y += (pointer.targetY - pointer.y) * 0.2;

      gl.uniform1f(uTime, performance.now());
      gl.uniform2f(
        uPointerPosition,
        pointer.x / window.innerWidth,
        1 - pointer.y / window.innerHeight,
      );
      gl.uniform1f(uScrollProgress, window.scrollY / (2 * window.innerHeight));
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    };

    const resize = () => {
      const pixelRatio = Math.min(window.devicePixelRatio, 2);
      canvas.width = window.innerWidth * pixelRatio;
      canvas.height = window.innerHeight * pixelRatio;
      gl.viewport(0, 0, canvas.width, canvas.height);
      gl.uniform1f(uRatio, canvas.width / canvas.height);
      // Resizing clears the canvas, so a still frame has to be redrawn.
      if (reduceMotion) draw();
    };

    const loop = () => {
      draw();
      frameId = requestAnimationFrame(loop);
    };

    const handlePointerMove = (event: PointerEvent) => {
      pointer.targetX = event.clientX;
      pointer.targetY = event.clientY;
    };

    const handleTouchMove = (event: TouchEvent) => {
      const touch = event.touches[0];
      if (!touch) return;
      pointer.targetX = touch.clientX;
      pointer.targetY = touch.clientY;
    };

    resize();
    window.addEventListener("resize", resize);

    if (!reduceMotion) {
      window.addEventListener("pointermove", handlePointerMove);
      window.addEventListener("touchmove", handleTouchMove, { passive: true });
      loop();
    }

    return () => {
      cancelAnimationFrame(frameId);
      window.removeEventListener("resize", resize);
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("touchmove", handleTouchMove);
      gl.deleteBuffer(vertexBuffer);
      gl.deleteProgram(program);
      gl.deleteShader(vertexShader);
      gl.deleteShader(fragmentShader);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      aria-hidden
      data-slot="neural-vortex-background"
      className={cn(
        "pointer-events-none fixed inset-0 h-full w-full opacity-95",
        className,
      )}
    />
  );
};

export default InteractiveNeuralVortex;
