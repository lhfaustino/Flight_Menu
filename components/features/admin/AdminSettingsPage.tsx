"use client";

import { useState } from "react";
import { CateringUploadCard } from "@/components/features/catering/CateringUploadCard";
import { AlocucoesAdminPage } from "@/components/features/admin/AlocucoesAdminPage";
import { UsefulLinksAdminPage } from "@/components/features/admin/UsefulLinksAdminPage";
import { AdminUsersPage } from "@/components/features/admin/AdminUsersPage";
import type { AlocucaoRecord } from "@/app/actions/alocucoes";
import type { AdminUser } from "@/app/actions/admin-users";
import type { UsefulLink } from "@/app/actions/useful-links";
import { Tabs } from "@/components/ui/Tabs";

type AdminTab = "meal-plan" | "alocucoes" | "links" | "admins";

type AdminSettingsPageProps = {
    initialLinks: UsefulLink[];
    initialSpeeches: AlocucaoRecord[];
    initialUsers: AdminUser[];
    isSuperAdmin: boolean;
    mealPlanStats: {
        count: number;
        lastUpdated: string | null;
    };
};

export function AdminSettingsPage({
    initialLinks,
    initialSpeeches,
    initialUsers,
    isSuperAdmin,
    mealPlanStats,
}: AdminSettingsPageProps) {
    const [currentTab, setCurrentTab] = useState<AdminTab>("meal-plan");

    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-2xl font-bold text-gray-900">Admin</h1>
                <p className="text-gray-500">Gerencie meal plan fixo, alocuções, links úteis e permissões.</p>
            </div>

            <Tabs selectedKey={currentTab} onSelectionChange={(key) => setCurrentTab(key as AdminTab)}>
                <Tabs.List type="underline">
                    <Tabs.Item id="meal-plan">Meal plan fixo</Tabs.Item>
                    <Tabs.Item id="alocucoes">Alocuções</Tabs.Item>
                    <Tabs.Item id="links">Links Úteis</Tabs.Item>
                    {isSuperAdmin && <Tabs.Item id="admins">Administradores</Tabs.Item>}
                </Tabs.List>
            </Tabs>

            <div className="mt-6">
                {currentTab === "meal-plan" && <MealPlanAdminTab stats={mealPlanStats} />}
                {currentTab === "alocucoes" && <AlocucoesAdminPage initialSpeeches={initialSpeeches} />}
                {currentTab === "links" && <UsefulLinksAdminPage initialLinks={initialLinks} />}
                {currentTab === "admins" && isSuperAdmin && <AdminUsersPage initialUsers={initialUsers} />}
            </div>
        </div>
    );
}

function MealPlanAdminTab({ stats }: { stats: AdminSettingsPageProps["mealPlanStats"] }) {
    return (
        <div className="mx-auto max-w-4xl">
            <div className="mb-6">
                <h2 className="text-lg font-semibold text-gray-900">Meal plan fixo</h2>
                <p className="mt-1 max-w-2xl text-sm text-gray-600">
                    Atualize aqui o PDF de alimentação usado por todos os usuários. Usuários comuns enviam apenas a escala.
                </p>
            </div>

            <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div className="rounded-lg border border-gray-200 bg-white p-5 shadow-sm">
                    <p className="text-sm font-medium text-gray-500">Regras salvas</p>
                    <p className="mt-2 text-3xl font-bold text-gray-900">{stats.count}</p>
                </div>
                <div className="rounded-lg border border-gray-200 bg-white p-5 shadow-sm">
                    <p className="text-sm font-medium text-gray-500">Última atualização</p>
                    <p className="mt-2 text-lg font-semibold text-gray-900">
                        {stats.lastUpdated ? new Date(stats.lastUpdated).toLocaleString("pt-BR") : "Nenhum PDF enviado"}
                    </p>
                </div>
            </div>

            <CateringUploadCard />
        </div>
    );
}
