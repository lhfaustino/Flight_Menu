"use client";

import { useState } from "react";
import { grantAdminAccess, revokeAdminAccess, type AdminUser } from "@/app/actions/admin-users";
import { Button } from "@/components/ui/Button";
import { ShieldCheck, ShieldOff, UserCog } from "lucide-react";

export function AdminUsersPage({ initialUsers }: { initialUsers: AdminUser[] }) {
    const [users, setUsers] = useState(initialUsers);
    const [email, setEmail] = useState("");
    const [isSaving, setIsSaving] = useState(false);
    const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

    const handleGrant = async (targetEmail = email) => {
        setIsSaving(true);
        setMessage(null);

        try {
            const result = await grantAdminAccess(targetEmail);
            if (!result.success) {
                setMessage({ type: "error", text: result.error ?? "Não foi possível liberar admin." });
                return;
            }

            const normalizedEmail = targetEmail.trim().toLowerCase();
            setUsers((current) => {
                const exists = current.some((user) => user.email === normalizedEmail);
                const nextUsers = exists
                    ? current.map((user) => user.email === normalizedEmail ? { ...user, is_admin: true } : user)
                    : [{ id: null, email: normalizedEmail, full_name: "", is_admin: true, is_superadmin: false }, ...current];

                return sortUsers(nextUsers);
            });
            setEmail("");
            setMessage({ type: "success", text: "Acesso admin liberado." });
        } catch (error) {
            setMessage({ type: "error", text: error instanceof Error ? error.message : "Não foi possível liberar admin." });
        } finally {
            setIsSaving(false);
        }
    };

    const handleRevoke = async (targetEmail: string) => {
        if (!window.confirm(`Remover acesso admin de ${targetEmail}?`)) return;

        setIsSaving(true);
        setMessage(null);

        try {
            const result = await revokeAdminAccess(targetEmail);
            if (!result.success) {
                setMessage({ type: "error", text: result.error ?? "Não foi possível remover admin." });
                return;
            }

            setUsers((current) => current.map((user) => user.email === targetEmail ? { ...user, is_admin: false } : user));
            setMessage({ type: "success", text: "Acesso admin removido." });
        } catch (error) {
            setMessage({ type: "error", text: error instanceof Error ? error.message : "Não foi possível remover admin." });
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(320px,420px)]">
            <div className="rounded-lg border border-gray-200 bg-white shadow-sm">
                <div className="border-b border-gray-200 px-5 py-4">
                    <h2 className="text-lg font-semibold text-gray-900">Usuários</h2>
                    <p className="mt-1 text-sm text-gray-500">Libere ou remova acesso admin para usuários cadastrados.</p>
                </div>

                <div className="divide-y divide-gray-100">
                    {users.map((user) => (
                        <div key={user.email} className="flex flex-col gap-3 px-5 py-4 sm:flex-row sm:items-center">
                            <div className="flex min-w-0 flex-1 items-start gap-3">
                                <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-gray-50 text-gray-500">
                                    <UserCog className="size-5" />
                                </span>
                                <div className="min-w-0">
                                    <div className="flex flex-wrap items-center gap-2">
                                        <p className="font-semibold text-gray-900">{user.full_name || user.email}</p>
                                        <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${user.is_admin ? "bg-green-50 text-green-700" : "bg-gray-100 text-gray-600"}`}>
                                            {user.is_superadmin ? "Superadmin" : user.is_admin ? "Admin" : "Usuário"}
                                        </span>
                                    </div>
                                    <p className="mt-1 truncate text-sm text-gray-500">{user.email}</p>
                                </div>
                            </div>

                            <div className="flex shrink-0 flex-wrap gap-2">
                                {user.is_admin ? (
                                    <Button
                                        variant="secondary"
                                        size="sm"
                                        iconLeading={ShieldOff}
                                        isDisabled={isSaving || user.is_superadmin}
                                        onPress={() => handleRevoke(user.email)}
                                    >
                                        Remover admin
                                    </Button>
                                ) : (
                                    <Button
                                        variant="secondary"
                                        size="sm"
                                        iconLeading={ShieldCheck}
                                        isDisabled={isSaving}
                                        onPress={() => handleGrant(user.email)}
                                    >
                                        Tornar admin
                                    </Button>
                                )}
                            </div>
                        </div>
                    ))}
                </div>
            </div>

            <div className="rounded-lg border border-gray-200 bg-white p-5 shadow-sm">
                <h2 className="text-lg font-semibold text-gray-900">Adicionar por e-mail</h2>
                <p className="mt-1 text-sm text-gray-500">Use esta opção quando o usuário ainda não aparecer na lista.</p>

                <div className="mt-5 space-y-4">
                    <label className="block">
                        <span className="text-sm font-semibold text-gray-700">E-mail</span>
                        <input
                            type="email"
                            value={email}
                            onChange={(event) => setEmail(event.target.value)}
                            placeholder="usuario@email.com"
                            className="mt-1 h-10 w-full rounded-lg border border-gray-300 px-3 text-sm focus:border-brand-600 focus:outline-none focus:ring-4 focus:ring-brand-600/10"
                        />
                    </label>

                    {message && (
                        <div className={`rounded-lg px-3 py-2 text-sm ${message.type === "success" ? "bg-green-50 text-green-800" : "bg-red-50 text-red-800"}`}>
                            {message.text}
                        </div>
                    )}

                    <Button className="w-full" isDisabled={isSaving || !email.trim()} onPress={() => handleGrant()}>
                        {isSaving ? "Salvando..." : "Liberar admin"}
                    </Button>
                </div>
            </div>
        </div>
    );
}

function sortUsers(users: AdminUser[]) {
    return [...users].sort((first, second) => {
        if (first.is_superadmin !== second.is_superadmin) return first.is_superadmin ? -1 : 1;
        if (first.is_admin !== second.is_admin) return first.is_admin ? -1 : 1;
        return first.email.localeCompare(second.email);
    });
}
