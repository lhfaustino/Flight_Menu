"use server";

import { createAdminClient } from "@/lib/supabase/admin";
import { withErrorHandling } from "@/lib/supabase/errors";

const normalizeUsername = (value: string) =>
    value.toLowerCase().replace(/[^a-z0-9_]/g, "").slice(0, 24);

export async function resolveUsernameLoginEmail(identifier: string) {
    return withErrorHandling(async () => {
        const username = normalizeUsername(identifier.trim());

        if (username.length < 3) {
            return null;
        }

        const adminClient = createAdminClient();
        const { data, error } = await adminClient
            .from("profiles")
            .select("email")
            .eq("username", username)
            .maybeSingle();

        if (error) throw error;

        return data?.email ?? null;
    }, { action: "resolveUsernameLoginEmail" });
}
