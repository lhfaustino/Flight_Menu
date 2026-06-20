"use server";

import { revalidatePath } from "next/cache";
import { BRAZILIAN_STATES, SOCIAL_TAGS } from "@/lib/social-options";
import { createClient } from "@/lib/supabase/server";

const SOCIAL_PHOTO_BUCKET = "social-posts";
const MAX_PHOTO_SIZE_BYTES = 5 * 1024 * 1024;
const ALLOWED_PHOTO_TYPES = ["image/jpeg", "image/png", "image/gif", "image/webp"];

type SocialActionResult = { success: true } | { success: false; error: string };

export async function createSocialPost(formData: FormData): Promise<SocialActionResult> {
  try {
    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) return { success: false, error: "Faca login para publicar." };

    const caption = String(formData.get("caption") ?? "").trim();
    const location = String(formData.get("location") ?? "").trim();
    const brazilianState = String(formData.get("brazilianState") ?? "").trim().toUpperCase();
    const tag = String(formData.get("tag") ?? "").trim();
    const coordinates = parseCoordinates(formData);
    const photos = formData.getAll("photos").filter((item): item is File => item instanceof File && item.size > 0);

    if ("error" in coordinates) return { success: false, error: coordinates.error };
    if (photos.length === 0) return { success: false, error: "Envie pelo menos uma foto." };
    if (!location) return { success: false, error: "Informe o local da foto." };
    if (!BRAZILIAN_STATES.some((state) => state.value === brazilianState)) {
      return { success: false, error: "Selecione um estado brasileiro." };
    }
    if (!SOCIAL_TAGS.includes(tag as any)) return { success: false, error: "Selecione uma tag." };

    for (const photo of photos) {
      if (!ALLOWED_PHOTO_TYPES.includes(photo.type)) {
        return { success: false, error: "As fotos devem ser JPG, PNG, GIF ou WebP." };
      }
      if (photo.size > MAX_PHOTO_SIZE_BYTES) {
        return { success: false, error: "Cada foto deve ter no maximo 5MB." };
      }
    }

    const authorName =
      String(user.user_metadata?.full_name ?? user.user_metadata?.username ?? user.email ?? "Tripulante").trim() || "Tripulante";
    const authorAvatarUrl = String(user.user_metadata?.avatar_url ?? "").trim() || null;

    const { data: post, error: postError } = await supabase
      .from("social_posts")
      .insert({
        user_id: user.id,
        author_name: authorName,
        author_avatar_url: authorAvatarUrl,
        caption,
        location,
        latitude: coordinates.value?.latitude ?? null,
        longitude: coordinates.value?.longitude ?? null,
        brazilian_state: brazilianState,
        tag,
      })
      .select("id")
      .single();

    if (postError || !post) throw postError ?? new Error("Nao foi possivel criar a publicacao.");

    const photoRows = [];
    for (const [index, photo] of photos.entries()) {
      const extension = photo.name.split(".").pop()?.toLowerCase() || "jpg";
      const path = `${user.id}/${post.id}/${Date.now()}-${index}.${extension}`;
      const { error: uploadError } = await supabase.storage.from(SOCIAL_PHOTO_BUCKET).upload(path, photo, {
        cacheControl: "3600",
        contentType: photo.type,
      });

      if (uploadError) throw uploadError;

      const { data: publicUrlData } = supabase.storage.from(SOCIAL_PHOTO_BUCKET).getPublicUrl(path);
      photoRows.push({
        post_id: post.id,
        storage_path: path,
        public_url: publicUrlData.publicUrl,
        sort_order: index,
      });
    }

    const { error: photosError } = await supabase.from("social_post_photos").insert(photoRows);
    if (photosError) throw photosError;

    revalidatePath("/social");
    return { success: true };
  } catch (error) {
    console.error("Could not create social post:", error);
    return { success: false, error: getErrorMessage(error, "Nao foi possivel publicar agora.") };
  }
}

export async function toggleSocialPostLike(postId: string): Promise<SocialActionResult> {
  try {
    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) return { success: false, error: "Faca login para curtir." };

    const { data: existingLike, error: existingError } = await supabase
      .from("social_post_likes")
      .select("id")
      .eq("post_id", postId)
      .eq("user_id", user.id)
      .maybeSingle();

    if (existingError) throw existingError;

    if (existingLike) {
      const { error } = await supabase.from("social_post_likes").delete().eq("id", existingLike.id);
      if (error) throw error;
    } else {
      const { error } = await supabase.from("social_post_likes").insert({ post_id: postId, user_id: user.id });
      if (error) throw error;
    }

    revalidatePath("/social");
    return { success: true };
  } catch (error) {
    console.error("Could not toggle social like:", error);
    return { success: false, error: getErrorMessage(error, "Nao foi possivel atualizar a curtida.") };
  }
}

export async function updateSocialPost(postId: string, formData: FormData): Promise<SocialActionResult> {
  try {
    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) return { success: false, error: "Faca login para editar." };

    const caption = String(formData.get("caption") ?? "").trim();
    const location = String(formData.get("location") ?? "").trim();
    const brazilianState = String(formData.get("brazilianState") ?? "").trim().toUpperCase();
    const tag = String(formData.get("tag") ?? "").trim();
    const coordinates = parseCoordinates(formData);

    if ("error" in coordinates) return { success: false, error: coordinates.error };
    if (!location) return { success: false, error: "Informe o local da foto." };
    if (!BRAZILIAN_STATES.some((state) => state.value === brazilianState)) {
      return { success: false, error: "Selecione um estado brasileiro." };
    }
    if (!SOCIAL_TAGS.includes(tag as any)) return { success: false, error: "Selecione uma tag." };

    const { data, error } = await supabase
      .from("social_posts")
      .update({
        caption,
        location,
        latitude: coordinates.value?.latitude ?? null,
        longitude: coordinates.value?.longitude ?? null,
        brazilian_state: brazilianState,
        tag,
        updated_at: new Date().toISOString(),
      })
      .eq("id", postId)
      .eq("user_id", user.id)
      .select("id")
      .maybeSingle();

    if (error) throw error;
    if (!data) return { success: false, error: "Voce so pode editar publicacoes criadas por voce." };

    revalidatePath("/social");
    return { success: true };
  } catch (error) {
    console.error("Could not update social post:", error);
    return { success: false, error: getErrorMessage(error, "Nao foi possivel editar a publicacao.") };
  }
}

export async function deleteSocialPost(postId: string): Promise<SocialActionResult> {
  try {
    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) return { success: false, error: "Faca login para excluir." };

    const { data: post, error: postError } = await supabase
      .from("social_posts")
      .select("id")
      .eq("id", postId)
      .eq("user_id", user.id)
      .maybeSingle();

    if (postError) throw postError;
    if (!post) return { success: false, error: "Voce so pode excluir publicacoes criadas por voce." };

    const { data: photos, error: photosError } = await supabase
      .from("social_post_photos")
      .select("storage_path")
      .eq("post_id", postId);

    if (photosError) throw photosError;

    const { error: deleteError } = await supabase.from("social_posts").delete().eq("id", postId).eq("user_id", user.id);
    if (deleteError) throw deleteError;

    const paths = photos?.map((photo) => photo.storage_path).filter(Boolean) ?? [];
    if (paths.length > 0) {
      const { error: storageError } = await supabase.storage.from(SOCIAL_PHOTO_BUCKET).remove(paths);
      if (storageError) {
        console.warn("Social post deleted, but photo storage cleanup failed:", storageError);
      }
    }

    revalidatePath("/social");
    return { success: true };
  } catch (error) {
    console.error("Could not delete social post:", error);
    return { success: false, error: getErrorMessage(error, "Nao foi possivel excluir a publicacao.") };
  }
}

export async function createSocialComment(postId: string, content: string): Promise<SocialActionResult> {
  try {
    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) return { success: false, error: "Faca login para comentar." };

    const cleanContent = content.trim();
    if (cleanContent.length < 1) return { success: false, error: "Escreva um comentario." };
    if (cleanContent.length > 500) return { success: false, error: "O comentario deve ter no maximo 500 caracteres." };

    const authorName =
      String(user.user_metadata?.full_name ?? user.user_metadata?.username ?? user.email ?? "Tripulante").trim() || "Tripulante";
    const authorAvatarUrl = String(user.user_metadata?.avatar_url ?? "").trim() || null;

    const { error } = await supabase.from("social_post_comments").insert({
      post_id: postId,
      user_id: user.id,
      author_name: authorName,
      author_avatar_url: authorAvatarUrl,
      content: cleanContent,
    });

    if (error) throw error;

    revalidatePath("/social");
    return { success: true };
  } catch (error) {
    console.error("Could not create social comment:", error);
    return { success: false, error: getErrorMessage(error, "Nao foi possivel comentar agora.") };
  }
}

function getErrorMessage(error: unknown, fallback: string) {
  if (error instanceof Error && error.message) return error.message;
  if (typeof error === "object" && error !== null && "message" in error) {
    const message = String((error as { message?: unknown }).message ?? "").trim();
    if (message) return message;
  }

  return fallback;
}

function parseCoordinates(
  formData: FormData,
): { value: { latitude: number; longitude: number } | null } | { error: string } {
  const rawLatitude = String(formData.get("latitude") ?? "").trim();
  const rawLongitude = String(formData.get("longitude") ?? "").trim();

  if (!rawLatitude && !rawLongitude) return { value: null };
  if (!rawLatitude || !rawLongitude) return { error: "Informe latitude e longitude validas." };

  const latitude = Number(rawLatitude);
  const longitude = Number(rawLongitude);

  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
    return { error: "Informe latitude e longitude validas." };
  }

  if (latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180) {
    return { error: "As coordenadas informadas estao fora do intervalo permitido." };
  }

  return {
    value: {
      latitude: Number(latitude.toFixed(6)),
      longitude: Number(longitude.toFixed(6)),
    },
  };
}
