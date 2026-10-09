"use client";

/**
 * Domain-neutral "rich" OpenUI components: photo galleries, timelines, maps
 * and suggestion lists that work for any topic (trips, projects, recipes,
 * study plans, research). Photos and coordinates come from keyless Wikipedia
 * lookups, and only when the External photos and maps setting is on.
 */

import {
    ArrowSquareOut,
    ArrowsIn,
    ArrowsOut,
    ChartLineUp,
    MapTrifold,
    Path,
    Plus,
} from "@phosphor-icons/react";
import { defineComponent, useIsStreaming, useTriggerAction } from "@openuidev/react-lang";
import { lazy, Suspense, useEffect, useMemo, useState, type ReactNode } from "react";
import { z } from "zod/v4";
import { useThreadBusy } from "./busy";
import { usePythonImage } from "./python-image";
import { useExternalMedia } from "./media";
import { RICH_ICON_NAMES, RichIcon, isRichIconName, type RichIconName } from "./rich-icons";
import { useRichSelection } from "./rich-selection";
import { isSafeActionUrl } from "./safe-openui";
import { fetchWikiSummary, type WikiSummary } from "./wikipedia";
import "./rich.css";

const MapView = lazy(() => import("./rich-map").then((m) => ({ default: m.MapView })));

const MAX_ITEMS = 24;
const MAX_GALLERY = 6;

type Item = {
    id?: string;
    title: string;
    label?: string;
    description?: string;
    icon?: RichIconName;
    category?: string;
    lat?: number;
    lng?: number;
    query?: string;
    link?: string;
};

export const RichItem = defineComponent({
    name: "RichItem",
    props: z.object({
        id: z.string().describe("Short unique id, e.g. 'i1'"),
        title: z.string(),
        label: z.string().optional().describe("Time, date, or duration shown beside the title"),
        description: z.string().optional(),
        icon: z.enum(RICH_ICON_NAMES).optional().describe("Pick the closest icon; never an emoji"),
        category: z.string().optional().describe("Short group name used for map filter chips"),
        lat: z.number().optional(),
        lng: z.number().optional(),
        query: z
            .string()
            .optional()
            .describe(
                "Exact English Wikipedia article title for a photo and, when lat/lng are omitted, coordinates",
            ),
        link: z.string().optional().describe("Absolute https URL for a 'Learn more' link"),
    }),
    description:
        "An entry used by RichGallery, RichTimeline, RichMap and RichSuggestions. Define each once and reference it from several of them. Output only fields you know; never invent coordinates.",
    component: () => null,
});

function readItems(value: unknown): Item[] {
    if (!Array.isArray(value)) return [];
    const items: Item[] = [];
    for (const node of value.slice(0, MAX_ITEMS)) {
        const props = (node as { props?: Record<string, unknown> } | null)?.props;
        if (!props || typeof props.title !== "string" || props.title.length === 0) continue;
        const text = (key: string) =>
            typeof props[key] === "string" && props[key] !== ""
                ? (props[key] as string)
                : undefined;
        const num = (key: string) =>
            typeof props[key] === "number" && Number.isFinite(props[key])
                ? (props[key] as number)
                : undefined;
        items.push({
            id: text("id"),
            title: props.title,
            label: text("label"),
            description: text("description"),
            icon: isRichIconName(props.icon) ? props.icon : undefined,
            category: text("category"),
            lat: num("lat"),
            lng: num("lng"),
            query: text("query"),
            link: text("link"),
        });
    }
    return items;
}

const scopeOf = (items: Item[]) => items.map((item) => item.id ?? item.title).join("|");
const keyOf = (item: Item, index: number) => `${item.id ?? item.title}-${index}`;

/** Looks up Wikipedia summaries once streaming has finished and media is allowed. */
function useWikiSummaries(queries: (string | undefined)[]): Map<string, WikiSummary | null> {
    const allowed = useExternalMedia();
    const streaming = useIsStreaming();
    const [results, setResults] = useState<Map<string, WikiSummary | null>>(new Map());
    const key = [...new Set(queries.filter((q): q is string => !!q))].join("\u0000");

    useEffect(() => {
        if (!allowed || streaming || !key) return;
        let cancelled = false;
        for (const query of key.split("\u0000")) {
            void fetchWikiSummary(query).then((summary) => {
                if (!cancelled) setResults((prev) => new Map(prev).set(query, summary));
            });
        }
        return () => {
            cancelled = true;
        };
    }, [allowed, streaming, key]);

    return results;
}

function SectionTitle({ icon, children }: { icon?: ReactNode; children: ReactNode }) {
    return (
        <h3 className="rich-section-title">
            {icon}
            <span>{children}</span>
        </h3>
    );
}

function ItemLink({ link }: { link?: string }) {
    if (!isSafeActionUrl(link)) return null;
    return (
        <a className="rich-link" href={link} target="_blank" rel="noopener noreferrer">
            Learn more
            <ArrowSquareOut size={12} weight="bold" aria-hidden />
        </a>
    );
}

function GalleryView({ props }: { props: { items?: unknown; caption?: string } }) {
    const items = useMemo(() => readItems(props.items).slice(0, MAX_GALLERY), [props.items]);
    const wiki = useWikiSummaries(items.map((item) => item.query));
    const allowed = useExternalMedia();
    if (items.length === 0) return null;
    return (
        <figure className="rich-gallery">
            <div className="rich-gallery-grid" data-count={items.length}>
                {items.map((item, index) => {
                    const image = item.query ? wiki.get(item.query)?.imageUrl : null;
                    return (
                        <div
                            className="rich-tile"
                            key={keyOf(item, index)}
                            data-featured={index === 0}
                        >
                            {allowed && image ? (
                                <img
                                    src={image}
                                    alt={item.title}
                                    loading="lazy"
                                    decoding="async"
                                    referrerPolicy="no-referrer"
                                />
                            ) : (
                                <span className="rich-tile-empty">
                                    <RichIcon name={item.icon} size={36} />
                                </span>
                            )}
                            <span className="rich-tile-title">{item.title}</span>
                        </div>
                    );
                })}
            </div>
            {props.caption ? <figcaption>{props.caption}</figcaption> : null}
        </figure>
    );
}

function TimelineView({ props }: { props: { items?: unknown; title?: string } }) {
    const items = useMemo(() => readItems(props.items), [props.items]);
    const [selected, select] = useRichSelection(scopeOf(items));
    if (items.length === 0) return null;
    return (
        <section className="rich-timeline">
            {props.title ? <SectionTitle>{props.title}</SectionTitle> : null}
            <ol className="rich-rail">
                {items.map((item, index) => (
                    <li key={keyOf(item, index)} data-selected={selected === index}>
                        <span className="rich-node" aria-hidden>
                            {item.icon ? (
                                <RichIcon name={item.icon} size={16} weight="bold" />
                            ) : (
                                index + 1
                            )}
                        </span>
                        <div className="rich-rail-card">
                            <button
                                type="button"
                                className="rich-timeline-row"
                                aria-current={selected === index ? "true" : undefined}
                                onClick={() => select(selected === index ? null : index)}
                            >
                                <span className="rich-timeline-head">
                                    <strong>{item.title}</strong>
                                    {item.label ? (
                                        <em className="rich-pill">{item.label}</em>
                                    ) : null}
                                </span>
                                {item.description ? (
                                    <span className="rich-desc">{item.description}</span>
                                ) : null}
                                {item.category ? (
                                    <span className="rich-category">{item.category}</span>
                                ) : null}
                            </button>
                            <ItemLink link={item.link} />
                        </div>
                    </li>
                ))}
            </ol>
        </section>
    );
}

type Resolved = { item: Item; index: number; lat: number; lng: number };

function MapSection({ props }: { props: { items?: unknown; title?: string; route?: boolean } }) {
    const items = useMemo(() => readItems(props.items), [props.items]);
    const allowed = useExternalMedia();
    const wiki = useWikiSummaries(
        items.map((item) => (item.lat === undefined ? item.query : undefined)),
    );
    const [selected, select] = useRichSelection(scopeOf(items));
    const [category, setCategory] = useState<string | null>(null);
    const [expanded, setExpanded] = useState(false);
    const [failed, setFailed] = useState(false);

    const resolved = useMemo<Resolved[]>(() => {
        const out: Resolved[] = [];
        items.forEach((item, index) => {
            let { lat, lng } = item;
            if (lat === undefined || lng === undefined) {
                const found = item.query ? wiki.get(item.query) : null;
                lat = found?.lat ?? undefined;
                lng = found?.lng ?? undefined;
            }
            if (
                lat !== undefined &&
                lng !== undefined &&
                Math.abs(lat) <= 90 &&
                Math.abs(lng) <= 180
            ) {
                out.push({ item, index, lat, lng });
            }
        });
        return out;
    }, [items, wiki]);

    const categories = useMemo(
        () => [
            ...new Set(
                resolved.map((entry) => entry.item.category).filter((c): c is string => !!c),
            ),
        ],
        [resolved],
    );
    const visible = useMemo(
        () => resolved.filter((entry) => category === null || entry.item.category === category),
        [resolved, category],
    );
    const points = useMemo(
        () =>
            visible.map(({ item, index, lat, lng }) => ({
                index,
                lat,
                lng,
                title: item.title,
                category: item.category,
            })),
        [visible],
    );

    if (items.length === 0) return null;
    const interactive = allowed && !failed;

    return (
        <section className="rich-map" data-expanded={expanded}>
            <div className="rich-map-head">
                <SectionTitle icon={<MapTrifold size={16} weight="duotone" aria-hidden />}>
                    {props.title ?? "Map"}
                </SectionTitle>
                {interactive && resolved.length > 0 ? (
                    <button
                        type="button"
                        className="rich-button"
                        onClick={() => setExpanded((value) => !value)}
                    >
                        {expanded ? (
                            <ArrowsIn size={14} aria-hidden />
                        ) : (
                            <ArrowsOut size={14} aria-hidden />
                        )}
                        {expanded ? "Collapse" : "Expand"}
                    </button>
                ) : null}
            </div>
            {interactive && categories.length > 1 ? (
                <div className="rich-chips" role="group" aria-label="Filter by category">
                    {[null, ...categories].map((name) => (
                        <button
                            key={name ?? "all"}
                            type="button"
                            aria-pressed={category === name}
                            onClick={() => setCategory(name)}
                        >
                            {name ?? "All"}
                        </button>
                    ))}
                </div>
            ) : null}
            {interactive && points.length > 0 ? (
                <Suspense fallback={<div className="rich-map-canvas" aria-busy />}>
                    <MapView
                        points={points}
                        selected={selected}
                        onSelect={select}
                        showRoute={props.route === true}
                        expanded={expanded}
                        onFail={() => setFailed(true)}
                    />
                </Suspense>
            ) : (
                <ol className="rich-map-list">
                    {items.map((item, index) => (
                        <li key={keyOf(item, index)}>
                            <span className="rich-node rich-node-small" aria-hidden>
                                {index + 1}
                            </span>
                            <strong>{item.title}</strong>
                            {item.lat !== undefined && item.lng !== undefined ? (
                                <span className="rich-coords">
                                    {item.lat.toFixed(4)}, {item.lng.toFixed(4)}
                                </span>
                            ) : null}
                        </li>
                    ))}
                </ol>
            )}
            {interactive && props.route === true && points.length > 1 ? (
                <p className="rich-note">
                    <Path size={13} aria-hidden /> Dashed line connects stops in order —
                    approximate, not a street route.
                </p>
            ) : null}
            {!allowed ? (
                <p className="rich-note">
                    Map hidden: External photos and maps is turned off in Settings → Tools.
                </p>
            ) : failed ? (
                <p className="rich-note">The map could not load, so places are listed instead.</p>
            ) : null}
        </section>
    );
}

function SuggestionsView({
    props,
}: {
    props: { items?: unknown; title?: string; actionLabel?: string };
}) {
    const items = useMemo(() => readItems(props.items), [props.items]);
    const triggerAction = useTriggerAction();
    const streaming = useIsStreaming();
    const busy = useThreadBusy();
    const actionLabel = props.actionLabel?.trim() || "Add";
    if (items.length === 0) return null;
    return (
        <section className="rich-suggestions" data-busy={busy}>
            <SectionTitle>{props.title ?? "You might also like"}</SectionTitle>
            <ul>
                {items.map((item, index) => (
                    <li key={keyOf(item, index)}>
                        <span className="rich-suggestion-icon" aria-hidden>
                            <RichIcon name={item.icon ?? "idea"} size={20} />
                        </span>
                        <span className="rich-suggestion-body">
                            <strong>{item.title}</strong>
                            {item.description ? <span>{item.description}</span> : null}
                        </span>
                        <button
                            type="button"
                            className="rich-button rich-button-primary"
                            disabled={streaming || busy}
                            onClick={() => triggerAction(`${actionLabel} ${item.title}`)}
                        >
                            <Plus size={13} weight="bold" aria-hidden />
                            {actionLabel}
                        </button>
                    </li>
                ))}
            </ul>
        </section>
    );
}

function FigureView({ props }: { props: { filename?: string; caption?: string; alt?: string } }) {
    const url = usePythonImage(props.filename);
    const streaming = useIsStreaming();
    if (!props.filename) return null;
    return (
        <figure className="rich-figure">
            {url ? (
                <img
                    src={url}
                    alt={props.alt ?? props.caption ?? props.filename}
                    decoding="async"
                />
            ) : (
                <div className="rich-figure-empty" role="status">
                    <ChartLineUp size={28} weight="duotone" aria-hidden />
                    <span>
                        {streaming
                            ? "Preparing figure…"
                            : `${props.filename} is not available in this chat's files`}
                    </span>
                </div>
            )}
            {props.caption ? <figcaption>{props.caption}</figcaption> : null}
        </figure>
    );
}

export const RichHeading = defineComponent({
    name: "RichHeading",
    props: z.object({ title: z.string(), subtitle: z.string().optional() }),
    description: "A title with an optional one-line subtitle at the top of a response or section.",
    component: ({ props }) => (
        <header className="rich-heading">
            <h2>{props.title}</h2>
            {props.subtitle ? <p>{props.subtitle}</p> : null}
        </header>
    ),
});

export const RichGallery = defineComponent({
    name: "RichGallery",
    props: z.object({ items: z.array(RichItem.ref), caption: z.string().optional() }),
    description:
        "A grid of up to 6 photos; the first is featured. Each RichItem needs a query (Wikipedia article title) to show a photo; items without one show an icon tile.",
    component: ({ props }) => <GalleryView props={props} />,
});

export const RichTimeline = defineComponent({
    name: "RichTimeline",
    props: z.object({ items: z.array(RichItem.ref), title: z.string().optional() }),
    description:
        "An ordered list of steps, stops, phases or events with a time label, title and description. Selecting an entry highlights it on a RichMap that uses the same items.",
    component: ({ props }) => <TimelineView props={props} />,
});

export const RichMap = defineComponent({
    name: "RichMap",
    props: z.object({
        items: z.array(RichItem.ref),
        title: z.string().optional(),
        route: z
            .boolean()
            .optional()
            .describe("Connect the items in order with an approximate dashed line"),
    }),
    description:
        "An interactive map with numbered markers for RichItems that have a place. Give lat/lng when you know them, otherwise a Wikipedia query. The route line is a straight approximation, not a street route.",
    component: ({ props }) => <MapSection props={props} />,
});

export const RichSuggestions = defineComponent({
    name: "RichSuggestions",
    props: z.object({
        items: z.array(RichItem.ref),
        title: z.string().optional(),
        actionLabel: z.string().optional().describe("Button text, default 'Add'"),
    }),
    description:
        "2-4 extra ideas the user may want to add. Each has a button that sends '<actionLabel> <title>' as the next user message, so write titles that stand alone.",
    component: ({ props }) => <SuggestionsView props={props} />,
});

export const RichFigure = defineComponent({
    name: "RichFigure",
    props: z.object({
        filename: z.string().describe("Image file already saved by run_python, e.g. 'sales.png'"),
        caption: z.string().optional(),
        alt: z.string().optional(),
    }),
    description:
        "Shows a chart or image that run_python already saved (matplotlib savefig PNG/SVG). Run Python first, then reference the exact filename here. Never put image data or URLs in props.",
    component: ({ props }) => <FigureView props={props} />,
});

export const RICH_COMPONENTS = [
    RichHeading,
    RichItem,
    RichGallery,
    RichTimeline,
    RichMap,
    RichSuggestions,
    RichFigure,
];
