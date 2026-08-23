import type { ActionFunctionArgs, LoaderFunctionArgs } from "react-router";
import { generateText } from "ai";
import type { ProviderId } from "~/lib/types";
import { createChatModel } from "~/lib/server/model";
import { corsPreflight, withCors } from "~/lib/server/cors";
import { getChatGPTHandler } from "~/lib/server/chatgpt-auth";
import { getGrokBuildSession } from "~/lib/server/grok-build-auth";
import { getKimiSession } from "~/lib/server/kimi-auth";
import { providerNeedsKey } from "~/lib/provider-credentials";
import { formatProviderError } from "~/lib/provider-errors";

type HintMode = "command" | "explain" | "fix" | "summarize" | "create";

export function loader({ request }: LoaderFunctionArgs) {
    const preflight = corsPreflight(request);
    if (preflight) return preflight;
    return withCors(request, new Response("Method Not Allowed", { status: 405 }));
}

export async function action({ request }: ActionFunctionArgs) {
    const preflight = corsPreflight(request);
    if (preflight) return preflight;
    if (request.method !== "POST") {
        return withCors(request, new Response("Method Not Allowed", { status: 405 }));
    }

    let body: {
        provider: ProviderId;
        model: string;
        apiKey?: string;
        baseUrl?: string;
        mode?: HintMode;
        prompt?: string;
        path?: string | null;
    };
    try {
        body = await request.json();
    } catch {
        return withCors(request, Response.json({ error: "Invalid JSON body" }, { status: 400 }));
    }

    if (body.provider === "chatgpt") {
        const session = await getChatGPTHandler().getSession(request);
        if (session.status !== "authenticated") {
            return withCors(
                request,
                Response.json({ error: "Sign in with ChatGPT first." }, { status: 401 }),
            );
        }
    } else if (body.provider === "grok") {
        const session = await getGrokBuildSession(request);
        if (session.status !== "authenticated") {
            return withCors(
                request,
                Response.json({ error: "Sign in with SuperGrok first." }, { status: 401 }),
            );
        }
    } else if (body.provider === "kimi") {
        const session = await getKimiSession(request);
        if (session.status !== "authenticated") {
            return withCors(
                request,
                Response.json({ error: "Sign in with Kimi first." }, { status: 401 }),
            );
        }
    } else if (providerNeedsKey(body.provider) && !body.apiKey) {
        return withCors(request, Response.json({ error: "API key required" }, { status: 400 }));
    }

    const mode = body.mode ?? "command";
    const user = body.prompt?.trim() ?? "";
    if (!user) {
        return withCors(request, Response.json({ error: "Prompt required" }, { status: 400 }));
    }

    const system =
        mode === "command"
            ? "Reply with exactly one bash command for a Debian Linux VM. No explanation. No markdown fences."
            : mode === "create"
              ? "Create a single file's full contents. No surrounding commentary."
              : "Answer in at most 12 short lines. Do not plan multi-step work. Do not invent file contents you were not given.";

    try {
        const model = createChatModel({
            provider: body.provider,
            apiKey: body.apiKey ?? "",
            baseUrl: body.baseUrl,
            model: body.model,
            request,
        });
        const result = await generateText({
            model,
            system,
            prompt: body.path ? `${user}\n\nSelected path: ${body.path}` : user,
            maxOutputTokens: 400,
        });
        return withCors(request, Response.json({ text: result.text.trim() }));
    } catch (error) {
        return withCors(
            request,
            Response.json(
                {
                    error: formatProviderError(error, {
                        provider: body.provider,
                        context: "chat",
                    }),
                },
                { status: 502 },
            ),
        );
    }
}