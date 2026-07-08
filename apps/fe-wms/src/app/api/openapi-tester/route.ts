import { createHash } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";

type TesterRequest = {
    baseUrl?: string;
    appId?: string;
    secretKey?: string;
    version?: string;
    action?: string;
    requestMode?: "standard" | "legacySimpleReport";
    signMode?: "withSecret" | "withoutSecret";
    body?: unknown;
};

function jsonError(message: string, status = 400) {
    return NextResponse.json({ success: false, message }, { status });
}

function normalizeBusinessBody(body: unknown): string {
    if (body === undefined || body === null || body === "") {
        return "{}";
    }

    if (typeof body === "string") {
        const trimmed = body.trim();
        if (!trimmed) {
            return "{}";
        }

        try {
            return JSON.stringify(JSON.parse(trimmed));
        } catch {
            return trimmed;
        }
    }

    return JSON.stringify(body);
}

function normalizeBodyObject(body: unknown): Record<string, unknown> {
    if (body === undefined || body === null || body === "") {
        return {};
    }

    if (typeof body === "string") {
        const trimmed = body.trim();
        if (!trimmed) {
            return {};
        }

        const parsed = JSON.parse(trimmed) as unknown;
        if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
            return parsed as Record<string, unknown>;
        }

        throw new Error("Legacy report body must be a JSON object.");
    }

    if (body && typeof body === "object" && !Array.isArray(body)) {
        return body as Record<string, unknown>;
    }

    throw new Error("Legacy report body must be a JSON object.");
}

function normalizeEndpoint(baseUrl: string): string {
    const trimmed = baseUrl.trim().replace(/\/+$/, "");
    const parsed = new URL(trimmed);

    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
        throw new Error("baseUrl must start with http:// or https://");
    }

    if (parsed.pathname.replace(/\/+$/, "").endsWith("/openapi/action")) {
        return trimmed;
    }

    return `${trimmed}/openapi/action`;
}

export async function POST(request: NextRequest) {
    let input: TesterRequest;

    try {
        input = await request.json();
    } catch {
        return jsonError("Request body must be valid JSON.");
    }

    const baseUrl = input.baseUrl?.trim();
    const appId = input.appId?.trim();
    const secretKey = input.secretKey?.trim();
    const version = input.version?.trim() || "11.7.1";
    const action = input.action?.trim();
    const requestMode = input.requestMode === "legacySimpleReport" ? "legacySimpleReport" : "standard";
    const signMode = input.signMode === "withoutSecret" ? "withoutSecret" : "withSecret";

    if (!baseUrl) return jsonError("Missing baseUrl.");
    if (!appId) return jsonError("Missing appId.");
    if (!secretKey) return jsonError("Missing secretKey.");
    if (!action) return jsonError("Missing action.");

    let endpoint: string;

    try {
        endpoint = normalizeEndpoint(baseUrl);
    } catch (error) {
        return jsonError(error instanceof Error ? error.message : "Invalid baseUrl.");
    }

    const timestamp = Date.now().toString();
    const businessBody = normalizeBusinessBody(input.body);
    const signSource =
        signMode === "withSecret"
            ? `${appId}${action}${version}${timestamp}${businessBody}${secretKey}`
            : `${appId}${action}${version}${timestamp}${businessBody}`;
    const sign = createHash("md5").update(signSource, "utf8").digest("hex").toUpperCase();

    let signedPayload: Record<string, unknown> = {
        appId,
        action,
        version,
        timestamp,
        sign,
        body: businessBody,
    };

    if (requestMode === "legacySimpleReport") {
        let bodyObject: Record<string, unknown>;

        try {
            bodyObject = normalizeBodyObject(input.body);
        } catch (error) {
            return jsonError(error instanceof Error ? error.message : "Invalid legacy report body.");
        }

        const { auth, ...reportParams } = bodyObject;
        const authSource = `${appId}${action}${version}${Object.values(reportParams).join("")}${secretKey}`;
        const fallbackAuth = createHash("md5").update(authSource, "utf8").digest("hex").toUpperCase();

        signedPayload = {
            action,
            appid: appId,
            version,
            ...reportParams,
            auth: typeof auth === "string" && auth.trim() ? auth.trim() : fallbackAuth,
        };
    }

    const startedAt = Date.now();

    try {
        const upstream = await fetch(endpoint, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                Accept: "application/json, text/plain, */*",
            },
            body: JSON.stringify(signedPayload),
            cache: "no-store",
        });

        const responseText = await upstream.text();
        let responseBody: unknown = responseText;

        try {
            responseBody = responseText ? JSON.parse(responseText) : null;
        } catch {
            responseBody = responseText;
        }

        return NextResponse.json({
            success: upstream.ok,
            status: upstream.status,
            statusText: upstream.statusText,
            durationMs: Date.now() - startedAt,
            endpoint,
            requestMode,
            signMode,
            signedPayload,
            response: responseBody,
        });
    } catch (error) {
        return NextResponse.json(
            {
                success: false,
                message: error instanceof Error ? error.message : "Request failed.",
                endpoint,
                requestMode,
                signMode,
                signedPayload,
            },
            { status: 502 },
        );
    }
}
