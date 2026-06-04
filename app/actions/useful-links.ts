"use server";

import { revalidatePath } from "next/cache";
import { assertCurrentAdmin } from "@/app/actions/admin-users";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

export type UsefulLink = {
    id: string;
    title: string;
    href: string;
    sort_order: number;
    is_active: boolean;
    created_at?: string;
    updated_at?: string;
};

export type UsefulLinkInput = {
    title: string;
    href: string;
    sort_order?: number;
    is_active?: boolean;
};

export async function getUsefulLinks() {
    const supabase = await createClient();
    const { data, error } = await supabase
        .from("useful_links")
        .select("id, title, href, sort_order, is_active")
        .eq("is_active", true)
        .order("sort_order", { ascending: true })
        .order("title", { ascending: true });

    if (error) {
        console.error("Could not load useful links:", error);
        return [];
    }

    return data ?? [];
}

export async function getAdminUsefulLinks() {
    await assertAdmin();

    const adminClient = createAdminClient();
    const { data, error } = await adminClient
        .from("useful_links")
        .select("id, title, href, sort_order, is_active, created_at, updated_at")
        .order("sort_order", { ascending: true })
        .order("title", { ascending: true });

    if (error) throw new Error(error.message);
    return data ?? [];
}

export async function createUsefulLink(input: UsefulLinkInput) {
    const user = await assertAdmin();
    const adminClient = createAdminClient();
    const cleanInput = normalizeUsefulLinkInput(input);

    const { data, error } = await adminClient
        .from("useful_links")
        .insert({
            ...cleanInput,
            is_active: input.is_active ?? true,
            created_by: user.id,
        })
        .select("id, title, href, sort_order, is_active")
        .single();

    if (error) return { success: false, error: error.message };

    revalidateUsefulLinks();
    return { success: true, link: data };
}

export async function updateUsefulLink(id: string, input: UsefulLinkInput) {
    await assertAdmin();
    const adminClient = createAdminClient();
    const cleanInput = normalizeUsefulLinkInput(input);

    const { data, error } = await adminClient
        .from("useful_links")
        .update({
            ...cleanInput,
            is_active: input.is_active ?? true,
            updated_at: new Date().toISOString(),
        })
        .eq("id", id)
        .select("id, title, href, sort_order, is_active")
        .single();

    if (error) return { success: false, error: error.message };

    revalidateUsefulLinks();
    return { success: true, link: data };
}

export async function deleteUsefulLink(id: string) {
    await assertAdmin();
    const adminClient = createAdminClient();
    const { error } = await adminClient.from("useful_links").delete().eq("id", id);

    if (error) return { success: false, error: error.message };

    revalidateUsefulLinks();
    return { success: true };
}

async function assertAdmin() {
    return assertCurrentAdmin();
}

function normalizeUsefulLinkInput(input: UsefulLinkInput) {
    const title = input.title.trim();
    const href = normalizeHref(input.href);
    const sortOrder = Number.isFinite(Number(input.sort_order)) ? Number(input.sort_order) : 0;

    if (title.length < 2) {
        throw new Error("O título deve ter pelo menos 2 caracteres.");
    }

    new URL(href);

    return {
        title,
        href,
        sort_order: sortOrder,
    };
}

function normalizeHref(value: string) {
    const trimmed = value.trim();
    if (!trimmed) throw new Error("A URL do link é obrigatória.");
    if (/^https?:\/\//i.test(trimmed)) return trimmed;
    return `https://${trimmed}`;
}

function revalidateUsefulLinks() {
    revalidatePath("/links-uteis");
    revalidatePath("/links-uteis-admin");
}
