"use client";

import { useState } from "react";
import { createUsefulLink, deleteUsefulLink, updateUsefulLink, type UsefulLink } from "@/app/actions/useful-links";
import { Button } from "@/components/ui/Button";
import { ExternalLink, Link2, Pencil, Plus, Trash2 } from "lucide-react";

type LinkFormState = {
    title: string;
    href: string;
    sort_order: number;
    is_active: boolean;
};

const emptyForm: LinkFormState = {
    title: "",
    href: "",
    sort_order: 0,
    is_active: true,
};

export function UsefulLinksAdminPage({ initialLinks }: { initialLinks: UsefulLink[] }) {
    const [links, setLinks] = useState(initialLinks);
    const [form, setForm] = useState<LinkFormState>(emptyForm);
    const [editingId, setEditingId] = useState<string | null>(null);
    const [isSaving, setIsSaving] = useState(false);
    const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

    const handleSubmit = async () => {
        setIsSaving(true);
        setMessage(null);

        try {
            const result = editingId
                ? await updateUsefulLink(editingId, form)
                : await createUsefulLink(form);

            if (!result.success) {
                setMessage({ type: "error", text: result.error ?? "Não foi possível salvar o link." });
                return;
            }

            if (editingId) {
                setLinks((currentLinks) =>
                    currentLinks
                        .map((link) => (link.id === editingId && result.link ? { ...link, ...result.link } : link))
                        .sort(sortLinks)
                );
            } else if (result.link) {
                setLinks((currentLinks) => [...currentLinks, result.link as UsefulLink].sort(sortLinks));
            }

            setForm(emptyForm);
            setEditingId(null);
            setMessage({ type: "success", text: editingId ? "Link atualizado." : "Link criado." });
        } catch (error) {
            setMessage({
                type: "error",
                text: error instanceof Error ? error.message : "Não foi possível salvar o link.",
            });
        } finally {
            setIsSaving(false);
        }
    };

    const handleEdit = (link: UsefulLink) => {
        setEditingId(link.id);
        setForm({
            title: link.title,
            href: link.href,
            sort_order: link.sort_order,
            is_active: link.is_active,
        });
        setMessage(null);
    };

    const handleCancelEdit = () => {
        setEditingId(null);
        setForm(emptyForm);
        setMessage(null);
    };

    const handleToggleActive = async (link: UsefulLink) => {
        const result = await updateUsefulLink(link.id, {
            title: link.title,
            href: link.href,
            sort_order: link.sort_order,
            is_active: !link.is_active,
        });

        if (!result.success || !result.link) {
            setMessage({ type: "error", text: result.error ?? "Não foi possível alterar o link." });
            return;
        }

        setLinks((currentLinks) =>
            currentLinks.map((currentLink) => (currentLink.id === link.id ? { ...currentLink, ...result.link } : currentLink))
        );
        setMessage({ type: "success", text: result.link.is_active ? "Link ativado." : "Link desativado." });
    };

    const handleDelete = async (link: UsefulLink) => {
        if (!window.confirm(`Remover "${link.title}"?`)) return;

        const result = await deleteUsefulLink(link.id);
        if (!result.success) {
            setMessage({ type: "error", text: result.error ?? "Não foi possível remover o link." });
            return;
        }

        setLinks((currentLinks) => currentLinks.filter((currentLink) => currentLink.id !== link.id));
        setMessage({ type: "success", text: "Link removido." });
    };

    return (
        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(320px,420px)]">
            <div className="rounded-lg border border-gray-200 bg-white shadow-sm">
                <div className="border-b border-gray-200 px-5 py-4">
                    <h2 className="text-lg font-semibold text-gray-900">Links cadastrados</h2>
                    <p className="mt-1 text-sm text-gray-500">{links.length} links no total.</p>
                </div>

                <div className="divide-y divide-gray-100">
                    {links.map((link) => (
                        <div key={link.id} className="flex flex-col gap-3 px-5 py-4 sm:flex-row sm:items-center">
                            <div className="flex min-w-0 flex-1 items-start gap-3">
                                <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-gray-50 text-gray-500">
                                    <Link2 className="size-5" />
                                </span>
                                <div className="min-w-0">
                                    <div className="flex flex-wrap items-center gap-2">
                                        <p className="font-semibold text-gray-900">{link.title}</p>
                                        <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${link.is_active ? "bg-green-50 text-green-700" : "bg-gray-100 text-gray-600"}`}>
                                            {link.is_active ? "Ativo" : "Inativo"}
                                        </span>
                                    </div>
                                    <a
                                        href={link.href}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="mt-1 flex max-w-full items-center gap-1 truncate text-sm text-gray-500 hover:text-brand-600"
                                    >
                                        <span className="truncate">{link.href}</span>
                                        <ExternalLink className="size-3 shrink-0" />
                                    </a>
                                </div>
                            </div>

                            <div className="flex shrink-0 flex-wrap gap-2">
                                <Button variant="secondary" size="sm" iconLeading={Pencil} onPress={() => handleEdit(link)}>
                                    Editar
                                </Button>
                                <Button variant="secondary" size="sm" onPress={() => handleToggleActive(link)}>
                                    {link.is_active ? "Desativar" : "Ativar"}
                                </Button>
                                <Button variant="destructive" size="sm" iconLeading={Trash2} onPress={() => handleDelete(link)}>
                                    Remover
                                </Button>
                            </div>
                        </div>
                    ))}

                    {links.length === 0 && (
                        <div className="px-5 py-10 text-center text-sm text-gray-500">
                            Nenhum link cadastrado.
                        </div>
                    )}
                </div>
            </div>

            <div className="rounded-lg border border-gray-200 bg-white p-5 shadow-sm">
                <div className="mb-5">
                    <h2 className="text-lg font-semibold text-gray-900">{editingId ? "Editar link" : "Novo link"}</h2>
                </div>

                <div className="space-y-4">
                    <label className="block">
                        <span className="text-sm font-semibold text-gray-700">Título</span>
                        <input
                            value={form.title}
                            onChange={(event) => setForm({ ...form, title: event.target.value })}
                            className="mt-1 h-10 w-full rounded-lg border border-gray-300 px-3 text-sm focus:border-brand-600 focus:outline-none focus:ring-4 focus:ring-brand-600/10"
                        />
                    </label>

                    <label className="block">
                        <span className="text-sm font-semibold text-gray-700">Link</span>
                        <input
                            value={form.href}
                            onChange={(event) => setForm({ ...form, href: event.target.value })}
                            className="mt-1 h-10 w-full rounded-lg border border-gray-300 px-3 text-sm focus:border-brand-600 focus:outline-none focus:ring-4 focus:ring-brand-600/10"
                        />
                    </label>

                    <label className="block">
                        <span className="text-sm font-semibold text-gray-700">Ordem</span>
                        <input
                            type="number"
                            value={form.sort_order}
                            onChange={(event) => setForm({ ...form, sort_order: Number(event.target.value) })}
                            className="mt-1 h-10 w-full rounded-lg border border-gray-300 px-3 text-sm focus:border-brand-600 focus:outline-none focus:ring-4 focus:ring-brand-600/10"
                        />
                    </label>

                    <label className="flex items-center gap-2 text-sm font-medium text-gray-700">
                        <input
                            type="checkbox"
                            checked={form.is_active}
                            onChange={(event) => setForm({ ...form, is_active: event.target.checked })}
                            className="size-4 rounded border-gray-300 text-brand-600"
                        />
                        Ativo
                    </label>

                    {message && (
                        <div className={`rounded-lg px-3 py-2 text-sm ${message.type === "success" ? "bg-green-50 text-green-800" : "bg-red-50 text-red-800"}`}>
                            {message.text}
                        </div>
                    )}

                    <div className="flex flex-col gap-2 sm:flex-row">
                        <Button className="w-full" iconLeading={Plus} isDisabled={isSaving} onPress={handleSubmit}>
                            {isSaving ? "Salvando..." : editingId ? "Salvar" : "Adicionar"}
                        </Button>
                        {editingId && (
                            <Button variant="secondary" className="w-full" isDisabled={isSaving} onPress={handleCancelEdit}>
                                Cancelar
                            </Button>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}

function sortLinks(first: UsefulLink, second: UsefulLink) {
    if (first.sort_order !== second.sort_order) return first.sort_order - second.sort_order;
    return first.title.localeCompare(second.title);
}
