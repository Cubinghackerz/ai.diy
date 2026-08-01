/**
 * API Title Route — generate a short chat title with the user's selected model
 */

import type { ActionFunctionArgs, LoaderFunctionArgs } from "react-router";
import { generateText } from "ai";
import type { ProviderId } from "~/lib/types";
import { createChatModel } from "~/lib/server/model";
import { providerNeedsKey } from "~/lib/provider-credentials";
import { corsPreflight, withCors } from "~/lib/server/cors";

interface TitleRequestBody {
    message: string;
    model: string;
    provider: ProviderId;
    apiKey: string;
    baseUrl?: string;
}

function fallbackTitle(message: string): string {
    const cleaned = message.replace(/\s+/g, " ").trim();
    if (!cleaned) return "New Chat";
    return cleaned.length > 48 ? `${cleaned.slice(0, 45).trimEnd()}…` : cleaned;
}

function cleanTitle(raw: string, message: string): string {
    const line = raw
        .split("\n")[0]
        ?.replace(/^["'`]+|["'`]+$/g, "")
        .replace(/^(title|chat)\s*:\s*/i, "")
        .trim();
    if (!line) return fallbackTitle(message);
    return line.length > 60 ? `${line.slice(0, 57).trimEnd()}…` : line;
}

export function loader({ request }: LoaderFunctionArgs) {
    const preflight = corsPreflight(request);
    if (preflight) return preflight;
    return withCors(
        request,
        new Response("Method Not Allowed", { status: 405 }),
    );
}

export async function action({ request }: ActionFunctionArgs) {
    const preflight = corsPreflight(request);
    if (preflight) return preflight;

    if (request.method !== "POST") {
        return withCors(
            request,
            new Response("Method Not Allowed", { status: 405 }),
        );
    }

    let body: TitleRequestBody;
    try {
        body = await request.json();
    } catch {
        return withCors(
            request,
            Response.json({ error: "Invalid JSON body" }, { status: 400 }),
        );
    }

    const message = body.message?.trim() ?? "";
    if (!message) {
        return withCors(
            request,
            Response.json({ error: "Message required" }, { status: 400 }),
        );
    }

    if (!body.model) {
        return withCors(
            request,
            Response.json({ error: "Model required" }, { status: 400 }),
        );
    }

    if (
        providerNeedsKey(body.provider) &&
        !body.apiKey
    ) {
        return withCors(
            request,
            Response.json(
                { title: fallbackTitle(message), fallback: true },
                { status: 200 },
            ),
        );
    }

    try {
        const model = createChatModel(body);
        const { text } = await generateText({
            model,
            temperature: 0.3,
            maxOutputTokens: 24,
            system:
                "Generate a short chat title (3–6 words) for the user's first message. Return only the title text — no quotes, no punctuation at the end, no explanation.",
            prompt: message.slice(0, 500),
        });

        return withCors(request, Response.json({ title: cleanTitle(text, message) }));
    } catch (err) {
        console.error("[api/title]", err);
        return withCors(
            request,
            Response.json({
                title: fallbackTitle(message),
                fallback: true,
                error: err instanceof Error ? err.message : "Title generation failed",
            }),
        );
    }
}
