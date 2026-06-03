import { redirect } from "next/navigation";
import { getAdminUsefulLinks } from "@/app/actions/useful-links";
import { UsefulLinksAdminPage } from "@/components/features/admin/UsefulLinksAdminPage";
import { isAdminEmail } from "@/lib/admin-access";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function LinksUteisAdminPage() {
    const supabase = await createClient();
    const {
        data: { user },
    } = await supabase.auth.getUser();

    if (!user || !isAdminEmail(user.email)) {
        redirect("/roster-upload");
    }

    const links = await getAdminUsefulLinks();

    return (
        <div className="min-h-screen bg-gray-50 py-12">
            <div className="mx-auto max-w-6xl px-4">
                <div className="mb-8">
                    <p className="text-sm font-semibold uppercase tracking-wide text-brand-600">Admin</p>
                    <h1 className="mt-2 text-3xl font-bold text-gray-900">Links Úteis</h1>
                    <p className="mt-2 max-w-2xl text-gray-600">
                        Cadastre, edite ou remova os links exibidos para os usuários.
                    </p>
                </div>

                <UsefulLinksAdminPage initialLinks={links} />
            </div>
        </div>
    );
}
