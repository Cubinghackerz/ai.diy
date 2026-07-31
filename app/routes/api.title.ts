/**
 * API Title Route — generate a short chat title with the user's selected model
 */

import type { ActionFunctionArgs } from "react-router";
import { generateText } from "ai";
import { createOpenAI } from "@ai-sdk/openai";
import { createAnthropic } from "@ai-sdk/anthropic";
import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { createXai } from "@ai-sdk/xai";
import type { ProviderId } from "~/lib/types";

interface TitleRequestBody {
    message: string;
    model: string;
    provider: ProviderId;
    apiKey: string;
    baseUrl?: string;
}

function getModelInstance(body: TitleRequestBody) {
    const { provider, apiKey, baseUrl, model } = body;
    switch (provider) {
        case "openai":
            return createOpenAI({ apiKey, baseURL: baseUrl || undefined }).chat(
                model,
            );
        case "anthropic":
            return createAnthropic({ apiKey, baseURL: baseUrl || undefined })(
                model,
            );
        case "gemini":
            return createGoogleGenerativeAI({ apiKey })(model);
        case "groq":
            return createOpenAI({
                apiKey,
                baseURL: baseUrl || "https://api.groq.com/openai/v1",
            }).chat(model);
        case "xai":
            return createXai({
                apiKey,
                baseURL: baseUrl || "https://api.x.ai/v1",
            }).chat(model);
        case "openrouter":
            return createOpenAI({
                apiKey,
                baseURL: baseUrl || "https://openrouter.ai/api/v1",
            }).chat(model);
        case "ollama":
            return createOpenAI({
                apiKey: apiKey || "ollama",
                baseURL: baseUrl || "http://localhost:11434/v1",
            }).chat(model);
        case "custom":
            return createOpenAI({
                apiKey: apiKey || "custom",
                baseURL: baseUrl || "http://localhost:1234/v1",
            }).chat(model);
        default:
            throw new Error(`Unsupported provider: ${provider}`);
    }
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

export async function action({ request }: ActionFunctionArgs) {
    if (request.method !== "POST") {
        return new Response("Method Not Allowed", { status: 405 });
    }

    let body: TitleRequestBody;
    try {
        body = await request.json();
    } catch {
        return Response.json({ error: "Invalid JSON body" }, { status: 400 });
    }

    const message = body.message?.trim() ?? "";
    if (!message) {
        return Response.json({ error: "Message required" }, { status: 400 });
    }

    if (!body.model) {
        return Response.json({ error: "Model required" }, { status: 400 });
    }

    if (
        !body.apiKey &&
        body.provider !== "ollama" &&
        body.provider !== "custom"
    ) {
        return Response.json(
            { title: fallbackTitle(message), fallback: true },
            { status: 200 },
        );
    }

    try {
        const model = getModelInstance(body);
        const { text } = await generateText({
            model,
            temperature: 0.3,
            maxOutputTokens: 24,
            system:
                "Generate a short chat title (3–6 words) for the user's first message. Return only the title text — no quotes, no punctuation at the end, no explanation.",
            prompt: message.slice(0, 500),
        });

        return Response.json({ title: cleanTitle(text, message) });
    } catch (err) {
        console.error("[api/title]", err);
        return Response.json({
            title: fallbackTitle(message),
            fallback: true,
            error: err instanceof Error ? err.message : "Title generation failed",
        });
    }
}
