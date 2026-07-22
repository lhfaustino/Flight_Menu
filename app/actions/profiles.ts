"use server";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { revalidatePath } from "next/cache";
import { withErrorHandling } from "@/lib/supabase/errors";

/**
 * Interface for Profile Updates
 */
export interface ProfileUpdateParams {
    full_name?: string | null;
    username?: string | null;
    avatar_url?: string | null;
    email?: string;
    bio?: string | null;
    telegram_chat_id?: string | null;
    timezone?: string | null;
    company?: "LATAM" | "GOL" | "AZUL";
    base?: "SAO" | "GIG" | "FOR" | "BSB" | "POA";
}

const AVATAR_BUCKET = "avatars";
const MAX_AVATAR_SIZE_BYTES = 1024 * 1024;
const ALLOWED_AVATAR_TYPES = ["image/jpeg", "image/png", "image/gif", "image/webp"];

const normalizeUsername = (value: string) =>
    value.toLowerCase().replace(/[^a-z0-9_]/g, "").slice(0, 24);

const USERNAME_LENGTH_ERROR = "Use 3 a 24 caracteres no nome de Usu\u00e1rio.";
const USERNAME_TAKEN_ERROR = "Este nome de Usu\u00e1rio j\u00e1 existe.";
const COMPANY_OPTIONS = ["LATAM", "GOL", "AZUL"] as const;
const BASE_OPTIONS = ["SAO", "GIG", "FOR", "BSB", "POA"] as const;

/**
 * Fetches the current user's profile from the database.
 * Uses the authenticated session to identify the user.
 * 
 * @returns {Promise<ApiResponse<any>>}
 */
export async function getMyProfile() {
    return withErrorHandling(async () => {
        const supabase = await createClient();

        // Get user from session (Security: never accept user_id from client)
        const { data: { user }, error: authError } = await supabase.auth.getUser();

        if (authError || !user) throw new Error("Não autorizado");

        const { data, error } = await supabase
            .from("profiles")
            .select("*")
            .eq("id", user.id)
            .maybeSingle();

        if (error) throw error;
        return data ?? {
            id: user.id,
            email: user.email ?? "",
            full_name: user.user_metadata?.full_name ?? "",
            username: user.user_metadata?.username ?? "",
            avatar_url: user.user_metadata?.avatar_url ?? "",
            bio: "",
            telegram_chat_id: "",
            timezone: "America/Sao_Paulo",
            company: "GOL",
            base: "SAO",
        };
    }, { action: "getMyProfile" });
}

/**
 * Updates the current user's profile.
 * Validates inputs and uses RLS to ensure security.
 * 
 * @param {ProfileUpdateParams} updates - The fields to update.
 * @returns {Promise<ApiResponse<any>>}
 */
export async function updateMyProfile(updates: ProfileUpdateParams) {
    return withErrorHandling(async () => {
        const supabase = await createClient();

        // 1. Auth Validation
        const { data: { user }, error: authError } = await supabase.auth.getUser();
        if (authError || !user) throw new Error("Não autorizado");

        // 2. Input Validation (Fail Fast)
        const fullName = updates.full_name?.trim() ?? "";
        const email = updates.email?.trim().toLowerCase() ?? user.email ?? "";
        const username = normalizeUsername(updates.username?.trim() ?? "");
        const bio = updates.bio?.trim() ?? "";
        const avatarUrl = updates.avatar_url === undefined ? undefined : updates.avatar_url?.trim() || null;
        const telegramChatId = updates.telegram_chat_id?.trim() ?? "";
        const timezone = updates.timezone?.trim() || "America/Sao_Paulo";
        const company = updates.company;
        const base = updates.base;

        if (fullName.length < 2) {
            throw new Error("O nome completo deve ter pelo menos 2 caracteres.");
        }

        if (!email || !email.includes("@")) {
            throw new Error("Digite um e-mail válido.");
        }

        if (username && (username.length < 3 || username.length > 24)) {
            throw new Error(USERNAME_LENGTH_ERROR);
        }

        if (company !== undefined && !COMPANY_OPTIONS.some(option => option === company)) {
            throw new Error("Escolha uma companhia v\u00e1lida.");
        }

        if (base !== undefined && !BASE_OPTIONS.some(option => option === base)) {
            throw new Error("Escolha uma base v\u00e1lida.");
        }

        if (username) {
            const adminClient = createAdminClient();
            const { data: usernameOwner, error: usernameError } = await adminClient
                .from("profiles")
                .select("id")
                .eq("username", username)
                .neq("id", user.id)
                .maybeSingle();

            if (usernameError) throw usernameError;
            if (usernameOwner) {
                throw new Error(USERNAME_TAKEN_ERROR);
            }
        }

        if (email !== user.email) {
            const { error: emailError } = await supabase.auth.updateUser({ email });
            if (emailError) throw emailError;
        }

        const profileUpdates: ProfileUpdateParams = {
            full_name: fullName,
            username: username || null,
            email,
            bio,
            telegram_chat_id: telegramChatId || null,
            timezone,
        };

        if (company !== undefined) {
            profileUpdates.company = company;
        }

        if (base !== undefined) {
            profileUpdates.base = base;
        }

        if (avatarUrl !== undefined) {
            profileUpdates.avatar_url = avatarUrl;
        }

        // 3. Database Update
        const { data, error } = await supabase
            .from("profiles")
            .upsert({
                id: user.id,
                ...profileUpdates,
                updated_at: new Date().toISOString(),
            })
            .select()
            .single();

        if (error) throw error;

        const { error: metadataError } = await supabase.auth.updateUser({
            data: {
                full_name: data.full_name,
                username: data.username ?? "",
                avatar_url: data.avatar_url ?? "",
                company: data.company,
                base: data.base,
            },
        });

        if (metadataError) throw metadataError;

        // 4. Cache Revalidation
        revalidatePath("/settings");

        return data;
    }, { action: "updateMyProfile", updates });
}

export async function uploadMyProfileAvatar(formData: FormData) {
    return withErrorHandling(async () => {
        const supabase = await createClient();

        const { data: { user }, error: authError } = await supabase.auth.getUser();
        if (authError || !user) throw new Error("Não autorizado");

        const file = formData.get("avatar");
        if (!(file instanceof File)) {
            throw new Error("Escolha uma imagem para enviar.");
        }

        if (!ALLOWED_AVATAR_TYPES.includes(file.type)) {
            throw new Error("A foto deve ser JPG, PNG, GIF ou WebP.");
        }

        if (file.size > MAX_AVATAR_SIZE_BYTES) {
            throw new Error("A foto deve ter no máximo 1MB.");
        }

        const extension = file.name.split(".").pop()?.toLowerCase() || "jpg";
        const path = `${user.id}/avatar-${Date.now()}.${extension}`;
        const { error: uploadError } = await supabase.storage
            .from(AVATAR_BUCKET)
            .upload(path, file, {
                cacheControl: "3600",
                contentType: file.type,
                upsert: true,
            });

        if (uploadError) throw uploadError;

        const { data: publicUrlData } = supabase.storage
            .from(AVATAR_BUCKET)
            .getPublicUrl(path);

        const avatarUrl = publicUrlData.publicUrl;

        const { data, error } = await supabase
            .from("profiles")
            .upsert({
                id: user.id,
                email: user.email ?? "",
                full_name: user.user_metadata?.full_name ?? "",
                avatar_url: avatarUrl,
                updated_at: new Date().toISOString(),
            })
            .select()
            .single();

        if (error) throw error;

        const { error: metadataError } = await supabase.auth.updateUser({
            data: {
                full_name: data.full_name ?? user.user_metadata?.full_name ?? "",
                avatar_url: avatarUrl,
            },
        });

        if (metadataError) throw metadataError;

        revalidatePath("/settings");

        return data;
    }, { action: "uploadMyProfileAvatar" });
}

export async function deleteMyProfileAvatar() {
    return withErrorHandling(async () => {
        const supabase = await createClient();

        const { data: { user }, error: authError } = await supabase.auth.getUser();
        if (authError || !user) throw new Error("Não autorizado");

        const { data, error } = await supabase
            .from("profiles")
            .update({
                avatar_url: null,
                updated_at: new Date().toISOString(),
            })
            .eq("id", user.id)
            .select()
            .single();

        if (error) throw error;

        const { error: metadataError } = await supabase.auth.updateUser({
            data: {
                full_name: data.full_name ?? user.user_metadata?.full_name ?? "",
                avatar_url: "",
            },
        });

        if (metadataError) throw metadataError;

        revalidatePath("/settings");

        return data;
    }, { action: "deleteMyProfileAvatar" });
}
