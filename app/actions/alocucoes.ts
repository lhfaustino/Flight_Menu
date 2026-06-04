"use server";

import { revalidatePath } from "next/cache";
import { assertCurrentAdmin } from "@/app/actions/admin-users";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

export type AlocucaoRecord = {
    id: string;
    title: string;
    pt: string;
    en: string;
    es: string;
    sort_order: number;
    is_active: boolean;
    created_at?: string;
    updated_at?: string;
};

export type AlocucaoInput = {
    title: string;
    pt: string;
    en: string;
    es: string;
    sort_order?: number;
    is_active?: boolean;
};

const publicSelect = "id, title, body_pt, body_en, body_es, sort_order, is_active";
const adminSelect = "id, title, body_pt, body_en, body_es, sort_order, is_active, created_at, updated_at";

export async function getAlocucoes() {
    const supabase = await createClient();
    const { data, error } = await supabase
        .from("alocucoes")
        .select(publicSelect)
        .eq("is_active", true)
        .order("sort_order", { ascending: true })
        .order("title", { ascending: true });

    if (error) {
        console.error("Could not load alocucoes:", error);
        return [];
    }

    return (data ?? []).map(mapAlocucaoRow);
}

export async function getAdminAlocucoes() {
    await assertAdmin();

    const adminClient = createAdminClient();
    const { data, error } = await adminClient
        .from("alocucoes")
        .select(adminSelect)
        .order("sort_order", { ascending: true })
        .order("title", { ascending: true });

    if (error) throw new Error(error.message);
    return (data ?? []).map(mapAlocucaoRow);
}

export async function createAlocucao(input: AlocucaoInput) {
    const user = await assertAdmin();
    const adminClient = createAdminClient();
    const cleanInput = normalizeAlocucaoInput(input);

    const { data, error } = await adminClient
        .from("alocucoes")
        .insert({
            id: `alocucao-${Date.now()}`,
            title: cleanInput.title,
            body_pt: cleanInput.pt,
            body_en: cleanInput.en,
            body_es: cleanInput.es,
            sort_order: cleanInput.sort_order,
            is_active: input.is_active ?? true,
            created_by: user.id,
        })
        .select(adminSelect)
        .single();

    if (error) return { success: false, error: error.message };

    revalidateAlocucoes();
    return { success: true, speech: mapAlocucaoRow(data) };
}

export async function updateAlocucao(id: string, input: AlocucaoInput) {
    await assertAdmin();
    const adminClient = createAdminClient();
    const cleanInput = normalizeAlocucaoInput(input);

    const { data, error } = await adminClient
        .from("alocucoes")
        .update({
            title: cleanInput.title,
            body_pt: cleanInput.pt,
            body_en: cleanInput.en,
            body_es: cleanInput.es,
            sort_order: cleanInput.sort_order,
            is_active: input.is_active ?? true,
            updated_at: new Date().toISOString(),
        })
        .eq("id", id)
        .select(adminSelect)
        .single();

    if (error) return { success: false, error: error.message };

    revalidateAlocucoes();
    return { success: true, speech: mapAlocucaoRow(data) };
}

export async function deleteAlocucao(id: string) {
    await assertAdmin();
    const adminClient = createAdminClient();
    const { error } = await adminClient.from("alocucoes").delete().eq("id", id);

    if (error) return { success: false, error: error.message };

    revalidateAlocucoes();
    return { success: true };
}

async function assertAdmin() {
    return assertCurrentAdmin();
}

function normalizeAlocucaoInput(input: AlocucaoInput) {
    const title = input.title.trim();
    const pt = input.pt.trim();
    const en = input.en.trim();
    const es = input.es.trim();
    const sortOrder = Number.isFinite(Number(input.sort_order)) ? Number(input.sort_order) : 0;

    if (title.length < 2) throw new Error("O título deve ter pelo menos 2 caracteres.");
    if (!pt && !en && !es) throw new Error("Adicione o texto da alocução em pelo menos um idioma.");

    return { title, pt, en, es, sort_order: sortOrder };
}

function mapAlocucaoRow(row: any): AlocucaoRecord {
    return {
        id: row.id,
        title: row.title,
        pt: row.body_pt ?? "",
        en: row.body_en ?? "",
        es: row.body_es ?? "",
        sort_order: row.sort_order ?? 0,
        is_active: row.is_active ?? true,
        created_at: row.created_at,
        updated_at: row.updated_at,
    };
}

function revalidateAlocucoes() {
    revalidatePath("/alocucoes");
    revalidatePath("/alocucoes-admin");
}
