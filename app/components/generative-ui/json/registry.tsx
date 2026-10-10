"use client";

import { defineRegistry } from "@json-render/react";
import { useId, useState, Children, type KeyboardEvent, type ReactNode } from "react";
import {
    ArrowDown,
    ArrowUp,
    Minus,
    Warning,
    CheckCircle,
    Info,
    XCircle,
    CaretDown,
} from "@phosphor-icons/react";
import { useThreadBusy } from "../busy";
import { usePythonImage } from "../python-image";
import { RichIcon } from "../rich-icons";
import { jsonCatalog } from "./catalog";
import "./json.css";

const CHART_W = 320;
const CHART_H = 140;

function finite(values: number[]) {
    return values.map((value) => (Number.isFinite(value) ? value : 0));
}

function BarChart({ labels, values, unit }: { labels: string[]; values: number[]; unit?: string }) {
    const data = finite(values).slice(0, labels.length);
    const max = Math.max(1, ...data.map(Math.abs));
    return (
        <div className="jr-bars" role="img" aria-label="Bar chart">
            {data.map((value, index) => (
                <div className="jr-bar-row" key={`${labels[index]}-${index}`}>
                    <span className="jr-bar-label">{labels[index]}</span>
                    <span className="jr-bar-track">
                        <span
                            className="jr-bar-fill"
                            style={{ width: `${Math.max(2, (Math.abs(value) / max) * 100)}%` }}
                        />
                    </span>
                    <span className="jr-bar-value">
                        {value}
                        {unit ? ` ${unit}` : ""}
                    </span>
                </div>
            ))}
        </div>
    );
}

function LineChart({
    labels,
    values,
    unit,
}: {
    labels: string[];
    values: number[];
    unit?: string;
}) {
    const data = finite(values).slice(0, labels.length);
    if (data.length < 2) return <BarChart labels={labels} values={values} unit={unit} />;
    const min = Math.min(...data);
    const max = Math.max(...data);
    const span = max - min || 1;
    const pad = 8;
    const points = data.map((value, index) => {
        const x = pad + (index / (data.length - 1)) * (CHART_W - pad * 2);
        const y = CHART_H - pad - ((value - min) / span) * (CHART_H - pad * 2);
        return [x, y] as const;
    });
    const path = points
        .map(([x, y], index) => `${index === 0 ? "M" : "L"}${x.toFixed(1)},${y.toFixed(1)}`)
        .join(" ");
    return (
        <div className="jr-line">
            <svg
                viewBox={`0 0 ${CHART_W} ${CHART_H}`}
                role="img"
                aria-label="Line chart"
                preserveAspectRatio="none"
            >
                <path
                    d={`${path} L${points.at(-1)![0]},${CHART_H - pad} L${points[0][0]},${CHART_H - pad} Z`}
                    className="jr-line-area"
                />
                <path d={path} className="jr-line-stroke" />
                {points.map(([x, y], index) => (
                    <circle key={index} cx={x} cy={y} r={3} className="jr-line-dot" />
                ))}
            </svg>
            <div className="jr-line-axis">
                <span>{labels[0]}</span>
                <span>
                    {min} – {max}
                    {unit ? ` ${unit}` : ""}
                </span>
                <span>{labels[data.length - 1]}</span>
            </div>
        </div>
    );
}

const TONE_ICON = {
    neutral: Info,
    info: Info,
    success: CheckCircle,
    warning: Warning,
    danger: XCircle,
} as const;

function FigureBlock({ filename, caption }: { filename: string; caption?: string }) {
    const url = usePythonImage(filename);
    return (
        <figure className="jr-figure">
            {url ? (
                <img src={url} alt={caption ?? filename} decoding="async" />
            ) : (
                <div className="jr-figure-empty" role="status">
                    {filename} is not available in this chat&apos;s files
                </div>
            )}
            {caption ? <figcaption>{caption}</figcaption> : null}
        </figure>
    );
}

function AskButton({ label, onPress }: { label: string; onPress: () => void }) {
    const busy = useThreadBusy();
    return (
        <button type="button" className="jr-button" disabled={busy} onClick={onPress}>
            {label}
        </button>
    );
}

function TabsBlock({ labels, children }: { labels: string[]; children: ReactNode }) {
    const id = useId();
    const [active, setActive] = useState(0);
    const panels = Children.toArray(children);
    const current = Math.min(active, labels.length - 1);
    const onKeyDown = (event: KeyboardEvent) => {
        const step = event.key === "ArrowRight" ? 1 : event.key === "ArrowLeft" ? -1 : 0;
        if (!step) return;
        event.preventDefault();
        const next = (current + step + labels.length) % labels.length;
        setActive(next);
        document.getElementById(`${id}-tab-${next}`)?.focus();
    };
    return (
        <div className="jr-tabs">
            <div className="jr-tablist" role="tablist">
                {labels.map((label, index) => (
                    <button
                        key={`${label}-${index}`}
                        id={`${id}-tab-${index}`}
                        type="button"
                        role="tab"
                        aria-selected={index === current}
                        aria-controls={`${id}-panel-${index}`}
                        tabIndex={index === current ? 0 : -1}
                        onClick={() => setActive(index)}
                        onKeyDown={onKeyDown}
                    >
                        {label}
                    </button>
                ))}
            </div>
            <div
                id={`${id}-panel-${current}`}
                className="jr-tabpanel"
                role="tabpanel"
                aria-labelledby={`${id}-tab-${current}`}
            >
                {panels[current] ?? null}
            </div>
        </div>
    );
}

function DisclosureBlock({
    title,
    open,
    children,
}: {
    title: string;
    open?: boolean;
    children: ReactNode;
}) {
    const [expanded, setExpanded] = useState(open === true);
    return (
        <div className="jr-disclosure" data-open={expanded}>
            <button type="button" aria-expanded={expanded} onClick={() => setExpanded(!expanded)}>
                <span>{title}</span>
                <CaretDown size={14} weight="bold" aria-hidden />
            </button>
            {expanded ? <div className="jr-disclosure-body">{children}</div> : null}
        </div>
    );
}

export const { registry } = defineRegistry(jsonCatalog, {
    components: {
        Stack: ({ props, children }) => (
            <div
                className="jr-stack"
                data-direction={props.direction ?? "vertical"}
                data-gap={props.gap ?? "md"}
            >
                {children}
            </div>
        ),
        Card: ({ props, children }) => (
            <section className="jr-card">
                {props.title || props.subtitle ? (
                    <header>
                        {props.icon ? (
                            <span className="jr-card-icon">
                                <RichIcon name={props.icon} size={18} />
                            </span>
                        ) : null}
                        <div>
                            {props.title ? <h3>{props.title}</h3> : null}
                            {props.subtitle ? <p>{props.subtitle}</p> : null}
                        </div>
                    </header>
                ) : null}
                {children}
            </section>
        ),
        Tabs: ({ props, children }) => <TabsBlock labels={props.labels}>{children}</TabsBlock>,
        Disclosure: ({ props, children }) => (
            <DisclosureBlock title={props.title} open={props.open}>
                {children}
            </DisclosureBlock>
        ),
        Heading: ({ props }) => {
            const Tag = props.level === "1" ? "h2" : props.level === "3" ? "h4" : "h3";
            return (
                <Tag className="jr-heading" data-level={props.level ?? "2"}>
                    {props.text}
                </Tag>
            );
        },
        Text: ({ props }) => (
            <p className="jr-text" data-muted={props.muted === true}>
                {props.text}
            </p>
        ),
        Badge: ({ props }) => (
            <span className="jr-badge" data-tone={props.tone ?? "neutral"}>
                {props.text}
            </span>
        ),
        Callout: ({ props }) => {
            const tone = props.tone ?? "info";
            const Glyph = TONE_ICON[tone];
            return (
                <div className="jr-callout" data-tone={tone} role="note">
                    <Glyph size={18} weight="duotone" aria-hidden />
                    <div>
                        {props.title ? <strong>{props.title}</strong> : null}
                        <p>{props.text}</p>
                    </div>
                </div>
            );
        },
        Metric: ({ props }) => {
            const Trend =
                props.trend === "up" ? ArrowUp : props.trend === "down" ? ArrowDown : Minus;
            return (
                <div className="jr-metric">
                    <span className="jr-metric-label">
                        {props.icon ? <RichIcon name={props.icon} size={14} /> : null}
                        {props.label}
                    </span>
                    <strong>{props.value}</strong>
                    {props.change ? (
                        <span className="jr-metric-change" data-trend={props.trend ?? "flat"}>
                            <Trend size={12} weight="bold" aria-hidden />
                            {props.change}
                        </span>
                    ) : null}
                </div>
            );
        },
        Table: ({ props }) => (
            <div className="jr-table-wrap">
                <table className="jr-table">
                    {props.caption ? <caption>{props.caption}</caption> : null}
                    <thead>
                        <tr>
                            {props.columns.map((column, index) => (
                                <th key={`${column}-${index}`}>{column}</th>
                            ))}
                        </tr>
                    </thead>
                    <tbody>
                        {props.rows.map((row, rowIndex) => (
                            <tr key={rowIndex}>
                                {props.columns.map((_, columnIndex) => (
                                    <td key={columnIndex}>{row[columnIndex] ?? ""}</td>
                                ))}
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        ),
        BarChart: ({ props }) => (
            <div className="jr-chart">
                {props.title ? <h4>{props.title}</h4> : null}
                <BarChart labels={props.labels} values={props.values} unit={props.unit} />
            </div>
        ),
        LineChart: ({ props }) => (
            <div className="jr-chart">
                {props.title ? <h4>{props.title}</h4> : null}
                <LineChart labels={props.labels} values={props.values} unit={props.unit} />
            </div>
        ),
        Progress: ({ props }) => (
            <div className="jr-progress">
                <div>
                    <span>{props.label}</span>
                    <span>{Math.round(props.value)}%</span>
                </div>
                <span
                    className="jr-bar-track"
                    role="progressbar"
                    aria-label={props.label}
                    aria-valuenow={Math.round(props.value)}
                    aria-valuemin={0}
                    aria-valuemax={100}
                >
                    <span
                        className="jr-bar-fill"
                        style={{ width: `${Math.min(100, Math.max(0, props.value))}%` }}
                    />
                </span>
            </div>
        ),
        List: ({ props }) => {
            const Tag = props.ordered ? "ol" : "ul";
            return (
                <Tag className="jr-list">
                    {props.items.map((item, index) => (
                        <li key={`${item}-${index}`}>{item}</li>
                    ))}
                </Tag>
            );
        },
        Figure: ({ props }) => <FigureBlock filename={props.filename} caption={props.caption} />,
        Button: ({ props, emit }) => (
            <AskButton label={props.label} onPress={() => emit("press")} />
        ),
    },
    // Replaced at render time by the thread-aware handler; see JsonRenderContent.
    actions: { ask: async () => {} },
});
