import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { processCateringPdfBuffer } from "@/lib/flight-menu-processing";

const MAX_PDF_BYTES = 10 * 1024 * 1024;

type InboundEmailPayload = {
    to?: string;
    recipient?: string;
    from?: string;
    sender?: string;
    subject?: string;
    text?: string;
    html?: string;
    body?: string;
    userEmail?: string;
    userId?: string;
};

export async function POST(request: Request) {
    const authResult = validateInboundSecret(request);
    if (!authResult.success) {
        return NextResponse.json({ success: false, error: authResult.error }, { status: 401 });
    }

    try {
        const payload = await parseInboundPayload(request);
        const supabase = createAdminClient();
        const user = await resolveTargetUser(supabase, payload);

        if (!user?.id) {
            return NextResponse.json(
                {
                    success: false,
                    error: "Could not match inbound email to a user. Send userEmail, userId, or a recipient matching profiles.email.",
                },
                { status: 404 }
            );
        }

        const bodyText = [payload.text, payload.html, payload.body].filter(Boolean).join("\n");
        const pdfUrl = findPdfUrl(bodyText);

        if (!pdfUrl) {
            await recordInboundAttempt(supabase, {
                userId: user.id,
                payload,
                status: "failed",
                error: "No PDF link found in email body.",
            });

            return NextResponse.json({ success: false, error: "No PDF link found in email body." }, { status: 422 });
        }

        const pdfBuffer = await downloadPdf(pdfUrl);
        const result = await processCateringPdfBuffer({
            supabase,
            userId: user.id,
            pdfBuffer,
            sourceName: payload.subject || "Inbound email",
        });

        await recordInboundAttempt(supabase, {
            userId: user.id,
            payload,
            pdfUrl,
            status: "processed",
            result,
        });

        return NextResponse.json({
            success: true,
            userId: user.id,
            pdfUrl,
            message: result.message,
            rulesInserted: result.rulesInserted,
            rulesUpdated: result.rulesUpdated,
            flightLegsUpdated: result.flightLegsUpdated,
        });
    } catch (error) {
        return NextResponse.json(
            {
                success: false,
                error: error instanceof Error ? error.message : "Unknown inbound processing error.",
            },
            { status: 500 }
        );
    }
}

function validateInboundSecret(request: Request) {
    const expectedSecret = process.env.INBOUND_EMAIL_SECRET;

    if (!expectedSecret) {
        return { success: false, error: "INBOUND_EMAIL_SECRET is not configured." };
    }

    const url = new URL(request.url);
    const receivedSecret =
        request.headers.get("x-inbound-secret") ||
        request.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ||
        url.searchParams.get("secret");

    if (receivedSecret !== expectedSecret) {
        return { success: false, error: "Invalid inbound secret." };
    }

    return { success: true };
}

async function parseInboundPayload(request: Request): Promise<InboundEmailPayload> {
    const contentType = request.headers.get("content-type") || "";

    if (contentType.includes("application/json")) {
        return request.json();
    }

    if (contentType.includes("multipart/form-data") || contentType.includes("application/x-www-form-urlencoded")) {
        const formData = await request.formData();
        return {
            to: getFormValue(formData, "to"),
            recipient: getFormValue(formData, "recipient") || getFormValue(formData, "envelope"),
            from: getFormValue(formData, "from"),
            sender: getFormValue(formData, "sender"),
            subject: getFormValue(formData, "subject"),
            text: getFormValue(formData, "text") || getFormValue(formData, "body-plain") || getFormValue(formData, "stripped-text"),
            html: getFormValue(formData, "html") || getFormValue(formData, "body-html") || getFormValue(formData, "stripped-html"),
            body: getFormValue(formData, "body"),
            userEmail: getFormValue(formData, "userEmail"),
            userId: getFormValue(formData, "userId"),
        };
    }

    return { text: await request.text() };
}

async function resolveTargetUser(supabase: ReturnType<typeof createAdminClient>, payload: InboundEmailPayload) {
    if (payload.userId) {
        const { data } = await supabase.from("profiles").select("id, email").eq("id", payload.userId).maybeSingle();
        return data;
    }

    const email = extractEmail(payload.userEmail || payload.to || payload.recipient || "");
    if (!email) return null;

    const { data } = await supabase.from("profiles").select("id, email").ilike("email", email).maybeSingle();
    return data;
}

async function downloadPdf(pdfUrl: string) {
    const response = await fetch(pdfUrl, {
        headers: {
            accept: "application/pdf,*/*;q=0.8",
        },
    });

    if (!response.ok) {
        throw new Error(`Could not download PDF: ${response.status} ${response.statusText}`);
    }

    const contentLength = Number(response.headers.get("content-length") || "0");
    if (contentLength > MAX_PDF_BYTES) {
        throw new Error("PDF is too large. Maximum size is 10MB.");
    }

    const arrayBuffer = await response.arrayBuffer();
    if (arrayBuffer.byteLength > MAX_PDF_BYTES) {
        throw new Error("PDF is too large. Maximum size is 10MB.");
    }

    return Buffer.from(arrayBuffer);
}

async function recordInboundAttempt(
    supabase: ReturnType<typeof createAdminClient>,
    {
        userId,
        payload,
        pdfUrl,
        status,
        error,
        result,
    }: {
        userId: string;
        payload: InboundEmailPayload;
        pdfUrl?: string;
        status: "processed" | "failed";
        error?: string;
        result?: Awaited<ReturnType<typeof processCateringPdfBuffer>>;
    }
) {
    await supabase.from("meal_plan_sources").insert({
        user_id: userId,
        source_type: "email_link",
        email_from: payload.from || payload.sender || null,
        email_to: payload.to || payload.recipient || payload.userEmail || null,
        last_email_subject: payload.subject || null,
        last_pdf_url: pdfUrl || null,
        status,
        last_error: error || null,
        rows_parsed: result?.entries.length ?? 0,
        flight_legs_updated: result?.flightLegsUpdated ?? 0,
        last_processed_at: new Date().toISOString(),
    });
}

function findPdfUrl(value: string) {
    const decoded = decodeHtmlEntities(value);
    const candidates = decoded.match(/https?:\/\/[^\s"'<>]+/gi) ?? [];

    return candidates
        .map((candidate) => candidate.replace(/[),.;]+$/, ""))
        .find((candidate) => {
            const normalized = decodeURIComponent(candidate).toLowerCase();
            return normalized.includes(".pdf") || normalized.includes("pdf");
        });
}

function extractEmail(value: string) {
    return value.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i)?.[0]?.toLowerCase() ?? "";
}

function getFormValue(formData: FormData, key: string) {
    const value = formData.get(key);
    return typeof value === "string" ? value : undefined;
}

function decodeHtmlEntities(value: string) {
    return value
        .replace(/&amp;/g, "&")
        .replace(/&quot;/g, '"')
        .replace(/&#x27;/g, "'")
        .replace(/&#39;/g, "'")
        .replace(/&lt;/g, "<")
        .replace(/&gt;/g, ">");
}
