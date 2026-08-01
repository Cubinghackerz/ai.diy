/**
 * Amazon Bedrock Provider Adapter
 *
 * Model discovery only — chat streaming for Bedrock goes through the AI SDK
 * route (createAmazonBedrock) in api.chat.ts. Credentials are passed as
 * structured JSON in the apiKey field:
 *   { "accessKeyId": "...", "secretAccessKey": "...", "region": "us-east-1" }
 * or a plain bearer token for Bedrock's Bearer-token authentication.
 *
 * Uses SigV4-signed ListFoundationModels so invalid keys fail loudly.
 */

import { createHash, createHmac } from "node:crypto";
import type { ChatRequest, StreamCallbacks, LLMProvider } from "./types";
import { parseProviderCredentials } from "~/lib/provider-credentials";

const EMPTY_PAYLOAD_SHA256 = createHash("sha256").update("").digest("hex");

function hmac(key: Buffer | string, data: string): Buffer {
    return createHmac("sha256", key).update(data).digest();
}

export class BedrockProvider implements LLMProvider {
    id = "bedrock" as const;

    async streamChat(_request: ChatRequest, _callbacks: StreamCallbacks): Promise<void> {
        throw new Error("Bedrock chat streaming is handled by the AI SDK route.");
    }

    async listModels(
        apiKey: string,
        baseUrl?: string,
    ): Promise<{ id: string; name: string }[]> {
        const creds = parseProviderCredentials("bedrock", apiKey);
        const region = creds.region ?? "us-east-1";

        // Bearer-token authentication path (no SigV4 signing needed).
        // ListFoundationModels is a control-plane API, so the runtime
        // baseUrl must not be used here.
        if (creds.apiKey && !creds.accessKeyId) {
            const res = await fetch(
                `https://bedrock.${region}.amazonaws.com/models`,
                { headers: { Authorization: `Bearer ${creds.apiKey}` } },
            );
            return parseListResponse(res, region);
        }

        const accessKeyId = creds.accessKeyId ?? "";
        const secretAccessKey = creds.secretAccessKey ?? "";
        if (!accessKeyId || !secretAccessKey) {
            throw new Error(
                "Bedrock needs accessKeyId + secretAccessKey (or a bearer apiKey). Paste JSON credentials.",
            );
        }

        const host = `bedrock.${region}.amazonaws.com`;
        const now = new Date();
        const amzDate = now.toISOString().replace(/[:-]|\.\d{3}/g, "");
        const dateStamp = amzDate.slice(0, 8);
        const service = "bedrock";
        const payloadHash = EMPTY_PAYLOAD_SHA256;

        const canonicalHeaders =
            `host:${host}\nx-amz-content-sha256:${payloadHash}\nx-amz-date:${amzDate}\n`;
        const signedHeaders = "host;x-amz-content-sha256;x-amz-date";
        const canonicalRequest = `GET\n/models\n\n${canonicalHeaders}\n${signedHeaders}\n${payloadHash}`;

        const scope = `${dateStamp}/${region}/${service}/aws4_request`;
        const stringToSign = `AWS4-HMAC-SHA256\n${amzDate}\n${scope}\n${createHash("sha256")
            .update(canonicalRequest)
            .digest("hex")}`;

        const kDate = hmac(`AWS4${secretAccessKey}`, dateStamp);
        const kRegion = hmac(kDate, region);
        const kService = hmac(kRegion, service);
        const kSigning = hmac(kService, "aws4_request");
        const signature = createHmac("sha256", kSigning)
            .update(stringToSign)
            .digest("hex");

        const authorization =
            `AWS4-HMAC-SHA256 Credential=${accessKeyId}/${scope}, ` +
            `SignedHeaders=${signedHeaders}, Signature=${signature}`;

        const res = await fetch(`https://${host}/models`, {
            headers: {
                Authorization: authorization,
                "X-Amz-Date": amzDate,
                "X-Amz-Content-Sha256": payloadHash,
            },
        });
        return parseListResponse(res, region);
    }
}

async function parseListResponse(
    res: Response,
    region: string,
): Promise<{ id: string; name: string }[]> {
    if (!res.ok) {
        const detail = (await res.text()).slice(0, 240);
        if (res.status === 401 || res.status === 403) {
            throw new Error("Invalid AWS credentials for Bedrock.");
        }
        throw new Error(
            `Bedrock models API failed (HTTP ${res.status}${detail ? `: ${detail}` : ""})`,
        );
    }
    const data = (await res.json()) as {
        modelSummaries?: Array<{ modelId: string; modelName?: string }>;
    };
    return (data.modelSummaries ?? [])
        .map((m) => ({ id: m.modelId, name: m.modelName || m.modelId }))
        .sort((a, b) => a.id.localeCompare(b.id));
}
