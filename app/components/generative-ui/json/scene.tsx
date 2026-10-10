"use client";

/**
 * Scene3D renderer. The model supplies data only (primitive parts, colours and
 * a rotation); three.js is loaded on demand and nothing the model wrote runs as
 * code. Rendering is on demand (orbit drag, resize, rotation change), not a
 * continuous animation loop.
 */

import { useEffect, useMemo, useRef, useState } from "react";
import type * as ThreeNamespace from "three";
import type { SCENE_COLORS, SCENE_SHAPES } from "./catalog";

type Vec3 = [number, number, number];
export type ScenePart = {
    shape: (typeof SCENE_SHAPES)[number];
    size: Vec3;
    position?: Vec3;
    rotation?: Vec3;
    color?: (typeof SCENE_COLORS)[number];
};

type SceneProps = {
    parts: ScenePart[];
    rotation: Vec3;
    axes: boolean;
    height: "sm" | "md" | "lg";
    caption?: string;
};

const HEIGHTS = { sm: 220, md: 300, lg: 380 } as const;
const COLORS: Record<(typeof SCENE_COLORS)[number], number> = {
    blue: 0x6366f1,
    teal: 0x14b8a6,
    amber: 0xf59e0b,
    red: 0xef4444,
    green: 0x22c55e,
    purple: 0xa855f7,
    gray: 0x94a3b8,
    white: 0xf1f5f9,
};
const DEG = Math.PI / 180;

type Three = typeof ThreeNamespace;
type Runtime = {
    three: Three;
    model: ThreeNamespace.Group;
    parts: ThreeNamespace.Group;
    axes: ThreeNamespace.Group;
    camera: ThreeNamespace.PerspectiveCamera;
    controls: { target: ThreeNamespace.Vector3; update: () => void };
    render: () => void;
};

function disposeObject(root: ThreeNamespace.Object3D) {
    root.traverse((object) => {
        const mesh = object as ThreeNamespace.Mesh;
        mesh.geometry?.dispose();
        const material = mesh.material;
        if (Array.isArray(material)) material.forEach((item) => item.dispose());
        else material?.dispose();
    });
}

function numbers(vector: Vec3): Vec3 {
    return vector.map((value) => (Number.isFinite(value) ? value : 0)) as Vec3;
}

export default function SceneView({ parts, rotation, axes, height, caption }: SceneProps) {
    const host = useRef<HTMLDivElement>(null);
    const runtime = useRef<Runtime | null>(null);
    const [status, setStatus] = useState<"loading" | "ready" | "unsupported">("loading");
    const partsKey = useMemo(() => JSON.stringify(parts), [parts]);
    const rotationKey = numbers(rotation).join(",");
    const pixels = HEIGHTS[height];

    useEffect(() => {
        let disposed = false;
        let teardown = () => {};
        (async () => {
            try {
                const [three, controlsModule] = await Promise.all([
                    import("three"),
                    import("three/examples/jsm/controls/OrbitControls.js"),
                ]);
                const element = host.current;
                if (disposed || !element) return;
                const renderer = new three.WebGLRenderer({ antialias: true, alpha: true });
                renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
                const canvas = renderer.domElement;
                canvas.style.display = "block";
                element.appendChild(canvas);

                const scene = new three.Scene();
                const camera = new three.PerspectiveCamera(40, 1, 0.1, 500);
                scene.add(new three.AmbientLight(0xffffff, 1.1));
                const sun = new three.DirectionalLight(0xffffff, 1.6);
                sun.position.set(4, 6, 5);
                scene.add(sun);
                const grid = new three.GridHelper(12, 12, 0x64748b, 0x475569);
                (grid.material as ThreeNamespace.Material).transparent = true;
                (grid.material as ThreeNamespace.Material).opacity = 0.35;
                grid.position.y = -3;
                scene.add(grid);

                const model = new three.Group();
                model.rotation.order = "YXZ";
                const partsGroup = new three.Group();
                const axesGroup = new three.Group();
                model.add(partsGroup, axesGroup);
                scene.add(model);

                const controls = new controlsModule.OrbitControls(camera, canvas);
                controls.enableZoom = false;
                controls.enablePan = false;
                // Orbit horizontally without trapping vertical page scroll on touch screens.
                canvas.style.touchAction = "pan-y";

                const render = () => renderer.render(scene, camera);
                controls.addEventListener("change", render);
                const resize = () => {
                    const width = Math.max(element.clientWidth, 1);
                    renderer.setSize(width, pixels, false);
                    canvas.style.width = "100%";
                    canvas.style.height = `${pixels}px`;
                    camera.aspect = width / pixels;
                    camera.updateProjectionMatrix();
                    render();
                };
                const observer = new ResizeObserver(resize);
                observer.observe(element);

                runtime.current = {
                    three,
                    model,
                    parts: partsGroup,
                    axes: axesGroup,
                    camera,
                    controls,
                    render,
                };
                teardown = () => {
                    observer.disconnect();
                    controls.removeEventListener("change", render);
                    controls.dispose();
                    disposeObject(scene);
                    renderer.dispose();
                    canvas.remove();
                    runtime.current = null;
                };
                setStatus("ready");
                resize();
            } catch {
                // No WebGL (or the library failed to load): the text fallback below remains.
                if (!disposed) setStatus("unsupported");
            }
        })();
        return () => {
            disposed = true;
            teardown();
        };
    }, [pixels]);

    // Rebuild the parts when the spec changes (including while it streams in).
    useEffect(() => {
        const current = runtime.current;
        if (status !== "ready" || !current) return;
        const { three, parts: group, axes: axesGroup, camera, controls } = current;
        for (const child of [...group.children, ...axesGroup.children]) {
            disposeObject(child);
        }
        group.clear();
        axesGroup.clear();
        let radius = 1;
        for (const part of JSON.parse(partsKey) as ScenePart[]) {
            const geometry =
                part.shape === "box"
                    ? new three.BoxGeometry(1, 1, 1)
                    : part.shape === "sphere"
                      ? new three.SphereGeometry(0.5, 32, 20)
                      : part.shape === "cone"
                        ? new three.ConeGeometry(0.5, 1, 32)
                        : new three.CylinderGeometry(0.5, 0.5, 1, 32);
            const mesh = new three.Mesh(
                geometry,
                new three.MeshStandardMaterial({
                    color: COLORS[part.color ?? "blue"],
                    roughness: 0.55,
                    metalness: 0.1,
                }),
            );
            const [sx, sy, sz] = numbers(part.size);
            mesh.scale.set(sx || 0.01, sy || 0.01, sz || 0.01);
            const [px, py, pz] = numbers(part.position ?? [0, 0, 0]);
            mesh.position.set(px, py, pz);
            const [rx, ry, rz] = numbers(part.rotation ?? [0, 0, 0]);
            mesh.rotation.set(rx * DEG, ry * DEG, rz * DEG);
            group.add(mesh);
            radius = Math.max(radius, Math.hypot(px, py, pz) + Math.max(sx, sy, sz) / 2);
        }
        if (axes) {
            const length = radius * 1.4;
            for (const [color, end] of [
                [0xef4444, new three.Vector3(length, 0, 0)],
                [0x22c55e, new three.Vector3(0, length, 0)],
                [0x3b82f6, new three.Vector3(0, 0, length)],
            ] as const) {
                const line = new three.Line(
                    new three.BufferGeometry().setFromPoints([end.clone().negate(), end]),
                    new three.LineBasicMaterial({ color }),
                );
                axesGroup.add(line);
            }
        }
        camera.position.set(radius * 1.7, radius * 1.1, radius * 2.6);
        camera.far = radius * 40;
        camera.updateProjectionMatrix();
        controls.target.set(0, 0, 0);
        controls.update();
        current.render();
    }, [partsKey, axes, status]);

    // Whole-model rotation, bound to the card's state (for example sliders).
    useEffect(() => {
        const current = runtime.current;
        if (status !== "ready" || !current) return;
        const [x, y, z] = rotationKey.split(",").map(Number);
        current.model.rotation.set(x * DEG, y * DEG, z * DEG);
        current.render();
    }, [rotationKey, status]);

    return (
        <figure className="jr-scene" data-status={status} data-rotation={rotationKey}>
            <div
                ref={host}
                className="jr-scene-host"
                style={{ height: pixels }}
                role="img"
                aria-label={caption ?? "3D scene. Drag to look around."}
            />
            {status === "unsupported" ? (
                <p className="jr-scene-note">3D view needs WebGL, which is not available here.</p>
            ) : (
                <figcaption>{caption ? `${caption} · ` : ""}Drag to look around</figcaption>
            )}
        </figure>
    );
}
