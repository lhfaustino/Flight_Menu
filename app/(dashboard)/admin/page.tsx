import { redirect } from "next/navigation";
import { getAdminAlocucoes } from "@/app/actions/alocucoes";
import { getAdminUsers, getCurrentAdminAccess } from "@/app/actions/admin-users";
import { getAdminUsefulLinks } from "@/app/actions/useful-links";
import { AdminSettingsPage } from "@/components/features/admin/AdminSettingsPage";
import { ADMIN_EMAIL } from "@/lib/admin-access";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

export default async function Page() {
    const access = await getCurrentAdminAccess();

    if (!access.isAdmin) {
        redirect("/roster-upload");
    }

    const adminClient = createAdminClient();
    const { data: masterProfile } = await adminClient
        .from("profiles")
        .select("id")
        .eq("email", ADMIN_EMAIL)
        .maybeSingle();

    const masterUserId = masterProfile?.id ?? access.id;

    const [{ count }, { data: latestRule }, links, speeches, users] = await Promise.all([
        adminClient
            .from("catering_rules")
            .select("id", { count: "exact", head: true })
            .eq("user_id", masterUserId),
        adminClient
            .from("catering_rules")
            .select("updated_at, created_at")
            .eq("user_id", masterUserId)
            .order("updated_at", { ascending: false })
            .limit(1)
            .maybeSingle(),
        getAdminUsefulLinks(),
        getAdminAlocucoes(),
        access.isSuperAdmin ? getAdminUsers() : Promise.resolve([]),
    ]);

    return (
        <AdminSettingsPage
            initialLinks={links}
            initialSpeeches={speeches}
            initialUsers={users}
            isSuperAdmin={access.isSuperAdmin}
            mealPlanStats={{
                count: count ?? 0,
                lastUpdated: latestRule?.updated_at ?? latestRule?.created_at ?? null,
            }}
        />
    );
}
