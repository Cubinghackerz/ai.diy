import React, { useEffect, useRef } from "react";
import { Mesh, Program, Renderer, Triangle } from "ogl";

export type FlowDirection = "inward" | "outward";

export interface LightTunnelProps {
    cableColor?: string;
    pulseColor?: string;
    tunnelColor?: string;
    tunnelOpacity?: number;
    speed?: number;
    flowDirection?: FlowDirection;
    pulseSpeed?: number;
    pulseLength?: number;
    pulseBlend?: number;
    pulseWidth?: number;
    cableCount?: number;
    thickness?: number;
    rimWidth?: number;
    waviness?: number;
    sway?: number;
    size?: number;
    centerX?: number;
    centerY?: number;
    glow?: number;
    fadeNear?: number;
    fadeFar?: number;
    brightness?: number;
    colorVariance?: boolean;
    grain?: boolean;
    grainIntensity?: number;
    opacity?: number;
    mouseInteraction?: boolean;
    mouseStrength?: number;
    className?: string;
}

const vertex = `#version 300 es
in vec2 position;
void main() {
  gl_Position = vec4(position, 0.0, 1.0);
}
`;

const fragment = `#version 300 es
precision highp float;
uniform vec2 iResolution;
uniform float iTime;
uniform float uSpeed;
uniform float uFlowDir;
uniform float uPulseSpeed;
uniform float uPulseLength;
uniform float uPulseBlend;
uniform float uPulseWidth;
uniform float uCableCount;
uniform float uThickness;
uniform float uRimWidth;
uniform float uWaviness;
uniform float uSway;
uniform float uSize;
uniform vec2 uCenter;
uniform vec2 uMouseOffset;
uniform float uGlow;
uniform float uFadeNear;
uniform float uFadeFar;
uniform float uBrightness;
uniform float uColorVariance;
uniform float uOpacity;
uniform vec3 uCableColor;
uniform vec3 uPulseColor;
uniform vec3 uTunnelColor;
uniform float uTunnelOpacity;
uniform float uGrain;
uniform float uGrainIntensity;
out vec4 fragColor;

void mainImage(out vec4 o, in vec2 fragCoord) {
  float size = uSize * 2.0;
  float speedBase = uSpeed * 4.0 * uFlowDir;
  float waviness = uWaviness * 0.15;
  float rotationOsc = uSway * 0.5;
  float baseThick = uThickness * 0.35 + 0.05;
  float borderWeight = uRimWidth * 0.15 + 0.01;
  float cablesCount = floor(uCableCount);

  vec2 res = iResolution.xy;
  vec2 uv = (fragCoord - 0.5 * res) / min(res.y, res.x);
  uv -= (uCenter + uMouseOffset);
  uv /= (size + 0.0001);

  float r = length(uv);
  float angle = atan(uv.y, uv.x);
  float depth = -log(r + 0.0001);
  float swing = sin(iTime * (uSpeed * 0.5 + 0.1)) * rotationOsc;
  float waveOffset = sin(depth * 1.2 + iTime * speedBase * 0.25) * waviness;
  float angleNormalized = (angle / 6.2831853) + 0.5;
  float finalAngle = fract(angleNormalized + waveOffset + swing);
  float cableID = floor(finalAngle * cablesCount);
  float gvX = fract(finalAngle * cablesCount) - 0.5;

  float rand = fract(sin(cableID * 12.9898) * 43758.5453);
  float randSpeed = (0.4 + rand * 0.6) * speedBase * uPulseSpeed;
  float cableThick = baseThick * (0.6 + rand * 0.4);
  vec3 cableCol = uCableColor * (1.0 + (rand - 0.5) * 0.4 * uColorVariance);
  cableCol = mix(cableCol, uPulseColor, rand * 0.25 * uColorVariance);

  float scroll = depth + (iTime * randSpeed);
  float pulseFact = fract(scroll);
  float distToCore = abs(gvX);
  float wireMask = smoothstep(cableThick, cableThick - 0.05, distToCore);
  float rimGlow = smoothstep(borderWeight, 0.0, abs(distToCore - cableThick));
  float pulseThick = cableThick * uPulseWidth;
  float pulseMask = smoothstep(pulseThick, pulseThick - 0.05 * uPulseWidth, distToCore);
  float pulseDist = abs(pulseFact - 0.5);
  float pulseCore = uPulseLength * (1.0 - uPulseBlend);
  float pulseLo = min(pulseCore, uPulseLength - max(fwidth(scroll), 1e-4));
  float dataPulse = 1.0 - smoothstep(pulseLo, uPulseLength, pulseDist);

  float aBody = wireMask * uTunnelOpacity;
  float aRim = rimGlow;
  float aPulse = clamp(dataPulse * pulseMask, 0.0, 1.0);
  vec3 fiberCol = uTunnelColor * aBody
    + cableCol * aRim * 1.3 * uGlow
    + uPulseColor * dataPulse * 3.0 * pulseMask;
  float distFade = smoothstep(0.0, uFadeNear, r) * smoothstep(uFadeFar, uFadeFar - 0.9, r);
  float inten = clamp(aBody + aRim + aPulse, 0.0, 1.0) * distFade;
  vec3 finalCol = fiberCol * uBrightness;
  float alpha = clamp(inten, 0.0, 1.0) * uOpacity;
  vec3 outRgb = finalCol * alpha;

  if (uGrain > 0.5) {
    float grain = (fract(sin(dot(gl_FragCoord.xy, vec2(12.9898, 78.233)) + iTime) * 43758.5453) - 0.5) * uGrainIntensity;
    outRgb = clamp(outRgb + grain, 0.0, 1.0);
    alpha = clamp(alpha + grain, 0.0, 1.0);
  }

  o = vec4(outRgb, alpha);
}

void main() {
  vec4 outputColor = vec4(0.0);
  mainImage(outputColor, gl_FragCoord.xy);
  fragColor = outputColor;
}
`;

type Uniform = { value: any };
type LightTunnelContext = {
    renderer: InstanceType<typeof Renderer>;
    program: InstanceType<typeof Program>;
    mesh: InstanceType<typeof Mesh>;
};

const contextMap = new WeakMap<HTMLDivElement, LightTunnelContext>();

function hexToRgb(hex: string): [number, number, number] {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    if (!result) return [1, 1, 1];
    return [
        parseInt(result[1], 16) / 255,
        parseInt(result[2], 16) / 255,
        parseInt(result[3], 16) / 255,
    ];
}

const LightTunnel: React.FC<LightTunnelProps> = ({
    cableColor = "#d7ff4f",
    pulseColor = "#ffb454",
    tunnelColor = "#d7ff4f",
    tunnelOpacity = 0,
    speed = 0.05,
    flowDirection = "outward",
    pulseSpeed = 1.6,
    pulseLength = 0.24,
    pulseBlend = 1,
    pulseWidth = 0.8,
    cableCount = 14,
    thickness = 0.28,
    rimWidth = 0.12,
    waviness = 0.2,
    sway = 0.24,
    size = 1,
    centerX = 0,
    centerY = 0,
    glow = 0.72,
    fadeNear = 0.5,
    fadeFar = 2,
    brightness = 0.7,
    colorVariance = true,
    grain = false,
    grainIntensity = 0.02,
    opacity = 1,
    mouseInteraction = false,
    mouseStrength = 0.06,
    className = "",
}) => {
    const containerRef = useRef<HTMLDivElement | null>(null);
    const mouseEnabledRef = useRef(mouseInteraction);
    const mouseStrengthRef = useRef(mouseStrength);

    useEffect(() => {
        const container = containerRef.current;
        if (!container) return;

        const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
        let renderer: InstanceType<typeof Renderer>;
        try {
            renderer = new Renderer({
                webgl: 2,
                alpha: true,
                premultipliedAlpha: true,
                antialias: false,
                dpr: Math.min(window.devicePixelRatio || 1, 1.25),
            });
        } catch {
            container.classList.add("light-tunnel-fallback");
            return;
        }

        const gl = renderer.gl;
        gl.clearColor(0, 0, 0, 0);
        const canvas = gl.canvas as HTMLCanvasElement;
        canvas.setAttribute("aria-hidden", "true");
        canvas.style.width = "100%";
        canvas.style.height = "100%";
        canvas.style.display = "block";
        canvas.style.pointerEvents = "none";
        container.appendChild(canvas);

        const geometry = new Triangle(gl);
        const program = new Program(gl, {
            vertex,
            fragment,
            uniforms: {
                iTime: { value: 0 },
                iResolution: { value: new Float32Array([1, 1]) },
                uSpeed: { value: speed },
                uFlowDir: { value: flowDirection === "outward" ? -1 : 1 },
                uPulseSpeed: { value: pulseSpeed },
                uPulseLength: { value: pulseLength },
                uPulseBlend: { value: pulseBlend },
                uPulseWidth: { value: pulseWidth },
                uCableCount: { value: cableCount },
                uThickness: { value: thickness },
                uRimWidth: { value: rimWidth },
                uWaviness: { value: waviness },
                uSway: { value: sway },
                uSize: { value: size },
                uCenter: { value: new Float32Array([centerX, centerY]) },
                uMouseOffset: { value: new Float32Array([0, 0]) },
                uGlow: { value: glow },
                uFadeNear: { value: fadeNear },
                uFadeFar: { value: fadeFar },
                uBrightness: { value: brightness },
                uColorVariance: { value: colorVariance ? 1 : 0 },
                uOpacity: { value: opacity },
                uCableColor: { value: new Float32Array(hexToRgb(cableColor)) },
                uPulseColor: { value: new Float32Array(hexToRgb(pulseColor)) },
                uTunnelColor: { value: new Float32Array(hexToRgb(tunnelColor)) },
                uTunnelOpacity: { value: tunnelOpacity },
                uGrain: { value: grain ? 1 : 0 },
                uGrainIntensity: { value: grainIntensity },
            },
        });
        const mesh = new Mesh(gl, { geometry, program });
        contextMap.set(container, { renderer, program, mesh });

        const setSize = () => {
            const rect = container.getBoundingClientRect();
            renderer.setSize(Math.max(1, Math.floor(rect.width)), Math.max(1, Math.floor(rect.height)));
            const resolution = (program.uniforms.iResolution as Uniform).value as Float32Array;
            resolution[0] = gl.drawingBufferWidth;
            resolution[1] = gl.drawingBufferHeight;
            renderer.render({ scene: mesh });
        };

        const resizeObserver = new ResizeObserver(setSize);
        resizeObserver.observe(container);
        setSize();

        let currentMouse: [number, number] = [0.5, 0.5];
        let targetMouse: [number, number] = [0.5, 0.5];
        const handlePointerMove = (event: PointerEvent) => {
            const rect = canvas.getBoundingClientRect();
            targetMouse = [
                (event.clientX - rect.left) / rect.width,
                1 - (event.clientY - rect.top) / rect.height,
            ];
        };
        const handlePointerLeave = () => {
            targetMouse = [0.5, 0.5];
        };

        if (mouseInteraction) {
            canvas.addEventListener("pointermove", handlePointerMove, { passive: true });
            canvas.addEventListener("pointerleave", handlePointerLeave, { passive: true });
        }

        let frame: number | null = null;
        let visible = true;
        let pageVisible = !document.hidden;
        const startedAt = performance.now();

        const renderFrame = (time: number) => {
            const uniformTime = (program.uniforms.iTime as Uniform).value as number;
            (program.uniforms.iTime as Uniform).value = reducedMotion
                ? uniformTime
                : (time - startedAt) * 0.001;

            if (mouseEnabledRef.current) {
                currentMouse[0] += 0.05 * (targetMouse[0] - currentMouse[0]);
                currentMouse[1] += 0.05 * (targetMouse[1] - currentMouse[1]);
            } else {
                currentMouse[0] += 0.05 * (0.5 - currentMouse[0]);
                currentMouse[1] += 0.05 * (0.5 - currentMouse[1]);
            }
            const offset = (program.uniforms.uMouseOffset as Uniform).value as Float32Array;
            offset[0] = (currentMouse[0] - 0.5) * mouseStrengthRef.current;
            offset[1] = (currentMouse[1] - 0.5) * mouseStrengthRef.current;
            renderer.render({ scene: mesh });
        };

        const start = () => {
            if (reducedMotion) {
                renderFrame(0);
                return;
            }
            if (visible && pageVisible && frame === null) {
                frame = requestAnimationFrame(function tick(time) {
                    frame = null;
                    if (!visible || !pageVisible) return;
                    renderFrame(time);
                    frame = requestAnimationFrame(tick);
                });
            }
        };
        const stop = () => {
            if (frame !== null) {
                cancelAnimationFrame(frame);
                frame = null;
            }
        };

        const intersectionObserver = new IntersectionObserver(
            ([entry]) => {
                visible = entry.isIntersecting;
                if (visible) start();
                else stop();
            },
            { rootMargin: "120px", threshold: 0 },
        );
        intersectionObserver.observe(container);

        const handleVisibility = () => {
            pageVisible = !document.hidden;
            if (pageVisible) start();
            else stop();
        };
        document.addEventListener("visibilitychange", handleVisibility, { passive: true });
        start();

        return () => {
            stop();
            resizeObserver.disconnect();
            intersectionObserver.disconnect();
            document.removeEventListener("visibilitychange", handleVisibility);
            if (mouseInteraction) {
                canvas.removeEventListener("pointermove", handlePointerMove);
                canvas.removeEventListener("pointerleave", handlePointerLeave);
            }
            contextMap.delete(container);
            try {
                container.removeChild(canvas);
            } catch {
                // The browser may already have removed the canvas during navigation.
            }
            gl.getExtension("WEBGL_lose_context")?.loseContext();
        };
    }, []);

    useEffect(() => {
        mouseEnabledRef.current = mouseInteraction;
        mouseStrengthRef.current = mouseStrength;
        const container = containerRef.current;
        if (!container) return;
        const context = contextMap.get(container);
        if (!context) return;
        const uniforms = context.program.uniforms as Record<string, Uniform>;
        uniforms.uSpeed.value = speed;
        uniforms.uFlowDir.value = flowDirection === "outward" ? -1 : 1;
        uniforms.uPulseSpeed.value = pulseSpeed;
        uniforms.uPulseLength.value = pulseLength;
        uniforms.uPulseBlend.value = pulseBlend;
        uniforms.uPulseWidth.value = pulseWidth;
        uniforms.uCableCount.value = cableCount;
        uniforms.uThickness.value = thickness;
        uniforms.uRimWidth.value = rimWidth;
        uniforms.uWaviness.value = waviness;
        uniforms.uSway.value = sway;
        uniforms.uSize.value = size;
        (uniforms.uCenter.value as Float32Array).set([centerX, centerY]);
        uniforms.uGlow.value = glow;
        uniforms.uFadeNear.value = fadeNear;
        uniforms.uFadeFar.value = fadeFar;
        uniforms.uBrightness.value = brightness;
        uniforms.uColorVariance.value = colorVariance ? 1 : 0;
        uniforms.uGrain.value = grain ? 1 : 0;
        uniforms.uGrainIntensity.value = grainIntensity;
        uniforms.uOpacity.value = opacity;
        (uniforms.uCableColor.value as Float32Array).set(hexToRgb(cableColor));
        (uniforms.uPulseColor.value as Float32Array).set(hexToRgb(pulseColor));
        (uniforms.uTunnelColor.value as Float32Array).set(hexToRgb(tunnelColor));
        uniforms.uTunnelOpacity.value = tunnelOpacity;
    }, [
        brightness,
        cableColor,
        cableCount,
        centerX,
        centerY,
        colorVariance,
        fadeFar,
        fadeNear,
        flowDirection,
        glow,
        grain,
        grainIntensity,
        mouseInteraction,
        mouseStrength,
        opacity,
        pulseBlend,
        pulseLength,
        pulseSpeed,
        pulseWidth,
        rimWidth,
        size,
        speed,
        sway,
        thickness,
        tunnelColor,
        tunnelOpacity,
        waviness,
    ]);

    return <div ref={containerRef} aria-hidden="true" className={`light-tunnel-fallback relative h-full w-full overflow-hidden ${className}`.trim()} />;
};

export default LightTunnel;
