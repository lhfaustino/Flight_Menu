import { redirect } from "next/navigation";
import { getAdminAlocucoes } from "@/app/actions/alocucoes";
import { AlocucoesAdminPage } from "@/components/features/admin/AlocucoesAdminPage";
import { isAdminEmail } from "@/lib/admin-access";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function Page() {
    const supabase = await createClient();
    const {
        data: { user },
    } = await supabase.auth.getUser();

    if (!user || !isAdminEmail(user.email)) {
        redirect("/roster-upload");
    }

    const speeches = await getAdminAlocucoes();

    return (
        <div className="min-h-screen bg-gray-50 py-12">
            <div className="mx-auto max-w-7xl px-4">
                <div className="mb-8">
                    <p className="text-sm font-semibold uppercase tracking-wide text-brand-600">Admin</p>
                    <h1 className="mt-2 text-3xl font-bold text-gray-900">Alocuções</h1>
                    <p className="mt-2 max-w-2xl text-gray-600">
                        Cadastre, edite ou remova as alocuções exibidas para os usuários.
                    </p>
                </div>

                <AlocucoesAdminPage initialSpeeches={speeches} />
            </div>
        </div>
    );
}
