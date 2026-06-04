import { redirect } from "next/navigation";
import { getAdminUsers, getCurrentAdminAccess } from "@/app/actions/admin-users";
import { AdminUsersPage } from "@/components/features/admin/AdminUsersPage";

export const dynamic = "force-dynamic";

export default async function Page() {
    const access = await getCurrentAdminAccess();

    if (!access.isSuperAdmin) {
        redirect("/roster-upload");
    }

    const users = await getAdminUsers();

    return (
        <div className="min-h-screen bg-gray-50 py-12">
            <div className="mx-auto max-w-6xl px-4">
                <div className="mb-8">
                    <p className="text-sm font-semibold uppercase tracking-wide text-brand-600">Admin</p>
                    <h1 className="mt-2 text-3xl font-bold text-gray-900">Administradores</h1>
                    <p className="mt-2 max-w-2xl text-gray-600">
                        O superadmin pode liberar ou remover acesso admin para outros usuários.
                    </p>
                </div>

                <AdminUsersPage initialUsers={users} />
            </div>
        </div>
    );
}
