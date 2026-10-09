"use client";

import "maplibre-gl/dist/maplibre-gl.css";
import { loadMapWorkerUrl } from "./maplibre-worker";
import { useEffect, useRef, useState } from "react";

// OpenFreeMap is keyless and serves CORS-enabled styles and tiles.
const STYLE_URL = "https://tiles.openfreemap.org/styles/positron";
const LOAD_TIMEOUT_MS = 12_000;
const ROUTE_SOURCE = "rich-route";

export type MapPoint = {
    index: number;
    lat: number;
    lng: number;
    title: string;
    category?: string;
};

type MapLike = {
    remove(): void;
    on(type: string, listener: (event?: unknown) => void): void;
    once(type: string, listener: (event?: unknown) => void): void;
    isStyleLoaded(): boolean;
    addSource(id: string, source: unknown): void;
    getSource(id: string): { setData(data: unknown): void } | undefined;
    addLayer(layer: unknown): void;
    fitBounds(bounds: unknown, options?: unknown): void;
    resize(): void;
};
type MarkerLike = { remove(): void };

export function MapView({
    points,
    selected,
    onSelect,
    showRoute,
    expanded,
    onFail,
}: {
    points: MapPoint[];
    selected: number | null;
    onSelect: (index: number) => void;
    showRoute: boolean;
    expanded: boolean;
    onFail: () => void;
}) {
    const container = useRef<HTMLDivElement>(null);
    const mapRef = useRef<MapLike | null>(null);
    const libRef = useRef<typeof import("maplibre-gl") | null>(null);
    const markers = useRef<{ marker: MarkerLike; element: HTMLElement; index: number }[]>([]);
    const [ready, setReady] = useState(false);
    const failRef = useRef(onFail);
    useEffect(() => {
        failRef.current = onFail;
    }, [onFail]);

    useEffect(() => {
        let cancelled = false;
        let timeout: ReturnType<typeof setTimeout> | undefined;
        (async () => {
            try {
                const [lib, workerUrl] = await Promise.all([
                    import("maplibre-gl"),
                    loadMapWorkerUrl(),
                ]);
                if (cancelled || !container.current) return;
                libRef.current = lib;
                lib.setWorkerUrl(workerUrl);
                const map = new lib.Map({
                    container: container.current,
                    style: STYLE_URL,
                    attributionControl: { compact: true },
                    cooperativeGestures: true,
                }) as unknown as MapLike;
                mapRef.current = map;
                timeout = setTimeout(() => {
                    if (!cancelled && !map.isStyleLoaded()) failRef.current();
                }, LOAD_TIMEOUT_MS);
                map.once("load", () => {
                    if (cancelled) return;
                    clearTimeout(timeout);
                    setReady(true);
                });
                // Only a style that cannot be fetched is fatal. Tile, sprite and glyph
                // errors are recoverable and must not hide an otherwise working map.
                map.on("error", (event) => {
                    const failedUrl = (event as { error?: { url?: unknown } } | undefined)?.error
                        ?.url;
                    if (!cancelled && failedUrl === STYLE_URL && !map.isStyleLoaded()) {
                        failRef.current();
                    }
                });
            } catch {
                if (!cancelled) failRef.current();
            }
        })();
        return () => {
            cancelled = true;
            clearTimeout(timeout);
            for (const { marker } of markers.current) marker.remove();
            markers.current = [];
            mapRef.current?.remove();
            mapRef.current = null;
            setReady(false);
        };
    }, []);

    useEffect(() => {
        const map = mapRef.current;
        const lib = libRef.current;
        if (!ready || !map || !lib) return;
        for (const { marker } of markers.current) marker.remove();
        markers.current = points.map((point) => {
            const element = document.createElement("button");
            element.type = "button";
            element.className = "rich-marker";
            element.textContent = String(point.index + 1);
            element.setAttribute("aria-label", point.title);
            element.addEventListener("click", () => onSelect(point.index));
            const marker = new lib.Marker({ element })
                .setLngLat([point.lng, point.lat])
                .addTo(map as unknown as import("maplibre-gl").Map);
            return { marker, element, index: point.index };
        });

        const line = {
            type: "Feature",
            properties: {},
            geometry: {
                type: "LineString",
                coordinates:
                    showRoute && points.length > 1 ? points.map((p) => [p.lng, p.lat]) : [],
            },
        };
        const source = map.getSource(ROUTE_SOURCE);
        if (source) source.setData(line);
        else {
            map.addSource(ROUTE_SOURCE, { type: "geojson", data: line });
            map.addLayer({
                id: ROUTE_SOURCE,
                type: "line",
                source: ROUTE_SOURCE,
                layout: { "line-cap": "round", "line-join": "round" },
                paint: { "line-color": "#6366f1", "line-width": 2.5, "line-dasharray": [2, 2] },
            });
        }

        if (points.length === 1) {
            map.fitBounds(
                [
                    points[0].lng - 0.02,
                    points[0].lat - 0.02,
                    points[0].lng + 0.02,
                    points[0].lat + 0.02,
                ],
                {
                    padding: 24,
                    duration: 0,
                },
            );
        } else if (points.length > 1) {
            const lngs = points.map((p) => p.lng);
            const lats = points.map((p) => p.lat);
            map.fitBounds(
                [Math.min(...lngs), Math.min(...lats), Math.max(...lngs), Math.max(...lats)],
                { padding: 40, duration: 0, maxZoom: 15 },
            );
        }
    }, [ready, points, showRoute, onSelect]);

    useEffect(() => {
        for (const { element, index } of markers.current) {
            element.dataset.selected = String(index === selected);
        }
    }, [selected, points, ready]);

    useEffect(() => {
        mapRef.current?.resize();
    }, [expanded]);

    return <div ref={container} className="rich-map-canvas" data-expanded={expanded} />;
}
