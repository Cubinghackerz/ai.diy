/**
 * Verifies the client-side AWS SigV4 implementation against AWS's reference
 * implementation (botocore S3SigV4Auth), run with a fixed clock:
 *
 *   GET  /test.txt                       -> df548e2c...  (host;x-amz-content-sha256;x-amz-date)
 *   PUT  /test%24file.text (JSON body)   -> 5df0cf30...  (content-type;host;x-amz-content-sha256;x-amz-date)
 *   GET  list-type=2&max-keys=100&prefix=ai-diy-backups -> 8e9ef584...
 *
 * Shared inputs: access key AKIAIOSFODNN7EXAMPLE, secret
 * wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY, region us-east-1, date 2013-05-24.
 *
 * Usage: node scripts/s3-sign-smoke.mjs
 */

import { buildS3Auth } from "../app/lib/cloud-storage/s3.ts";

let failures = 0;
function check(name, actual, expected) {
    const ok = actual === expected;
    if (ok) {
        console.log(`ok - ${name}`);
    } else {
        failures++;
        console.error(`FAIL - ${name}`);
        console.error(`  expected: ${expected}`);
        console.error(`  actual:   ${actual}`);
    }
}

const date = new Date("2013-05-24T00:00:00Z");
const accessKeyId = "AKIAIOSFODNN7EXAMPLE";
const secretAccessKey = "wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY";
const region = "us-east-1";

const sha256Hex = async (data) => {
    const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(data));
    return Array.from(new Uint8Array(digest))
        .map((b) => b.toString(16).padStart(2, "0"))
        .join("");
};

// ─── GET object (headers signed exactly like our s3Request) ───
const getPayloadHash =
    "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855";
const get = await buildS3Auth({
    method: "GET",
    url: new URL("https://examplebucket.s3.amazonaws.com/test.txt"),
    headers: {
        host: "examplebucket.s3.amazonaws.com",
        "x-amz-content-sha256": getPayloadHash,
        "x-amz-date": "20130524T000000Z",
    },
    payloadHash: getPayloadHash,
    region,
    accessKeyId,
    secretAccessKey,
    date,
});
check("GET signature (botocore-verified)", get.authorization.split("Signature=")[1], "df548e2ce037944d03f3e68682813b093763996d597cf890ca3d9037fd231eb4");

// ─── PUT object with JSON content-type ─────────────────────────
const body = "Welcome to Amazon S3.";
const putPayloadHash = await sha256Hex(body);
const put = await buildS3Auth({
    method: "PUT",
    url: new URL("https://examplebucket.s3.amazonaws.com/test%24file.text"),
    headers: {
        host: "examplebucket.s3.amazonaws.com",
        "x-amz-content-sha256": putPayloadHash,
        "x-amz-date": "20130524T000000Z",
        "content-type": "application/json",
    },
    payloadHash: putPayloadHash,
    region,
    accessKeyId,
    secretAccessKey,
    date,
});
check("PUT signature (botocore-verified)", put.authorization.split("Signature=")[1], "5df0cf30a70135b176c3a81ee385d3adb93879a6122d8ca840102a1455d1aa52");

// ─── ListObjectsV2-style GET with query parameters ────────────
const list = await buildS3Auth({
    method: "GET",
    url: new URL(
        "https://examplebucket.s3.amazonaws.com/?list-type=2&max-keys=100&prefix=ai-diy-backups",
    ),
    headers: {
        host: "examplebucket.s3.amazonaws.com",
        "x-amz-content-sha256": getPayloadHash,
        "x-amz-date": "20130524T000000Z",
    },
    payloadHash: getPayloadHash,
    region,
    accessKeyId,
    secretAccessKey,
    date,
});
check("LIST signature (botocore-verified)", list.authorization.split("Signature=")[1], "8e9ef584db74251956aee3132c5c4712c16122e2ec62dd4a8d542b453277182d");

console.log(failures === 0 ? "\nAll SigV4 checks passed." : `\n${failures} checks FAILED.`);
process.exit(failures === 0 ? 0 : 1);
