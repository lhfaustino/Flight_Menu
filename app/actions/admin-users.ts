"use server";

import { revalidatePath } from "next/cache";
import { ADMIN_EMAIL, isSuperAdminEmail } from "@/lib/admin-access";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

export type AdminAccess = {
    id: string;
    isAdmin: boolean;
    isSuperAdmin: boolean;
    email: string;
};

export type AdminUser = {
    id: string | null;
    email: string;
    full_name: string;
    is_admin: boolean;
    is_superadmin: boolean;
};

export async function getCurrentAdminAccess(): Promise<AdminAccess> {
    const supabase = await createClient();
    const {
        data: { user },
    } = await supabase.auth.getUser();

    const email = user?.email?.toLowerCase() ?? "";
    const id = user?.id ?? "";
    if (!email) return { id: "", isAdmin: false, isSuperAdmin: false, email: "" };
    if (isSuperAdminEmail(email)) return { id, isAdmin: true, isSuperAdmin: true, email };

    try {
        const adminClient = createAdminClient();
        const { data } = await adminClient
            .from("app_admins")
            .select("role, is_active")
            .eq("email", email)
            .maybeSingle();

        const isActiveAdmin = Boolean(data?.is_active);
        return {
            isAdmin: isActiveAdmin,
            isSuperAdmin: isActiveAdmin && data?.role === "superadmin",
            id,
            email,
        };
    } catch {
        return { id, isAdmin: false, isSuperAdmin: false, email };
    }
}

export async function assertCurrentAdmin() {
    const access = await getCurrentAdminAccess();
    if (!access.isAdmin) {
        throw new Error("Somente administradores podem acessar esta área.");
    }
    return access;
}

export async function assertCurrentSuperAdmin() {
    const access = await getCurrentAdminAccess();
    if (!access.isSuperAdmin) {
        throw new Error("Somente o superadmin pode gerenciar administradores.");
    }
    return access;
}

export async function getAdminUsers(): Promise<AdminUser[]> {
    await assertCurrentSuperAdmin();
    const adminClient = createAdminClient();

    const [{ data: profiles, error: profilesError }, { data: admins, error: adminsError }] = await Promise.all([
        adminClient.from("profiles").select("id, email, full_name").order("email", { ascending: true }),
        adminClient.from("app_admins").select("email, role, is_active"),
    ]);

    if (profilesError) throw new Error(profilesError.message);
    if (adminsError) throw new Error(adminsError.message);

    const adminByEmail = new Map((admins ?? []).map((admin) => [String(admin.email).toLowerCase(), admin]));
    const profileRows = (profiles ?? [])
        .filter((profile) => profile.email)
        .map((profile) => {
            const email = String(profile.email).toLowerCase();
            const admin = adminByEmail.get(email);
            return {
                id: profile.id ?? null,
                email,
                full_name: profile.full_name ?? "",
                is_admin: isSuperAdminEmail(email) || Boolean(admin?.is_active),
                is_superadmin: isSuperAdminEmail(email) || (admin?.is_active && admin.role === "superadmin"),
            };
        });

    if (!profileRows.some((profile) => profile.email === ADMIN_EMAIL)) {
        profileRows.unshift({
            id: null,
            email: ADMIN_EMAIL,
            full_name: "Superadmin",
            is_admin: true,
            is_superadmin: true,
        });
    }

    return profileRows.sort((first, second) => {
        if (first.is_superadmin !== second.is_superadmin) return first.is_superadmin ? -1 : 1;
        if (first.is_admin !== second.is_admin) return first.is_admin ? -1 : 1;
        return first.email.localeCompare(second.email);
    });
}

export async function grantAdminAccess(email: string) {
    const superadmin = await assertCurrentSuperAdmin();
    const normalizedEmail = normalizeEmail(email);
    if (isSuperAdminEmail(normalizedEmail)) {
        return { success: false, error: "Este usuário já é superadmin." };
    }

    const adminClient = createAdminClient();
    const { error } = await adminClient.from("app_admins").upsert({
        email: normalizedEmail,
        role: "admin",
        is_active: true,
        created_by: superadmin.id || null,
        updated_at: new Date().toISOString(),
    });

    if (error) return { success: false, error: error.message };

    revalidateAdminPages();
    return { success: true };
}

export async function revokeAdminAccess(email: string) {
    await assertCurrentSuperAdmin();
    const normalizedEmail = normalizeEmail(email);
    if (isSuperAdminEmail(normalizedEmail)) {
        return { success: false, error: "Não é possível remover o superadmin." };
    }

    const adminClient = createAdminClient();
    const { error } = await adminClient
        .from("app_admins")
        .update({ is_active: false, updated_at: new Date().toISOString() })
        .eq("email", normalizedEmail);

    if (error) return { success: false, error: error.message };

    revalidateAdminPages();
    return { success: true };
}

function normalizeEmail(value: string) {
    const email = value.trim().toLowerCase();
    if (!email || !email.includes("@")) {
        throw new Error("Digite um e-mail válido.");
    }
    return email;
}

function revalidateAdminPages() {
    revalidatePath("/admins");
    revalidatePath("/meal-plan-admin");
    revalidatePath("/links-uteis-admin");
    revalidatePath("/alocucoes-admin");
}
