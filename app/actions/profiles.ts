"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { withErrorHandling } from "@/lib/supabase/errors";

/**
 * Interface for Profile Updates
 */
export interface ProfileUpdateParams {
    full_name?: string | null;
    avatar_url?: string | null;
    email?: string;
    bio?: string | null;
}

const AVATAR_BUCKET = "avatars";
const MAX_AVATAR_SIZE_BYTES = 1024 * 1024;
const ALLOWED_AVATAR_TYPES = ["image/jpeg", "image/png", "image/gif", "image/webp"];

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

        if (authError || !user) throw new Error("Unauthorized");

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
            avatar_url: user.user_metadata?.avatar_url ?? "",
            bio: "",
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
        if (authError || !user) throw new Error("Unauthorized");

        // 2. Input Validation (Fail Fast)
        const fullName = updates.full_name?.trim() ?? "";
        const email = updates.email?.trim().toLowerCase() ?? user.email ?? "";
        const bio = updates.bio?.trim() ?? "";
        const avatarUrl = updates.avatar_url === undefined ? undefined : updates.avatar_url?.trim() || null;

        if (fullName.length < 2) {
            throw new Error("Full name must be at least 2 characters.");
        }

        if (!email || !email.includes("@")) {
            throw new Error("Please enter a valid email address.");
        }

        if (email !== user.email) {
            const { error: emailError } = await supabase.auth.updateUser({ email });
            if (emailError) throw emailError;
        }

        const profileUpdates: ProfileUpdateParams = {
            full_name: fullName,
            email,
            bio,
        };

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
                avatar_url: data.avatar_url ?? "",
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
        if (authError || !user) throw new Error("Unauthorized");

        const file = formData.get("avatar");
        if (!(file instanceof File)) {
            throw new Error("Please choose an image to upload.");
        }

        if (!ALLOWED_AVATAR_TYPES.includes(file.type)) {
            throw new Error("Avatar must be a JPG, PNG, GIF, or WebP image.");
        }

        if (file.size > MAX_AVATAR_SIZE_BYTES) {
            throw new Error("Avatar must be 1MB or smaller.");
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
        if (authError || !user) throw new Error("Unauthorized");

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
