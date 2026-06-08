"use client";

import { useState } from "react";
import { createUsefulLink, deleteUsefulLink, updateUsefulLink, type UsefulLink } from "@/app/actions/useful-links";
import { Button } from "@/components/ui/Button";
import { Dialog, Modal, ModalOverlay } from "@/components/ui/Modal";
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

const text = {
    active: "Ativo",
    inactive: "Inativo",
    registered: "Links cadastrados",
    totalLinks: (count: number) => `${count} links no total.`,
    newLink: "Novo link",
    editLink: "Editar link",
    title: "T\u00edtulo",
    link: "Link",
    order: "Ordem",
    save: "Salvar",
    add: "Adicionar",
    saving: "Salvando...",
    cancel: "Cancelar",
    edit: "Editar",
    deactivate: "Desativar",
    activate: "Ativar",
    remove: "Remover",
    empty: "Nenhum link cadastrado.",
    saveError: "N\u00e3o foi poss\u00edvel salvar o link.",
    changeError: "N\u00e3o foi poss\u00edvel alterar o link.",
    removeError: "N\u00e3o foi poss\u00edvel remover o link.",
    updated: "Link atualizado.",
    created: "Link criado.",
    activated: "Link ativado.",
    deactivated: "Link desativado.",
    removed: "Link removido.",
};

export function UsefulLinksAdminPage({ initialLinks }: { initialLinks: UsefulLink[] }) {
    const [links, setLinks] = useState(initialLinks);
    const [form, setForm] = useState<LinkFormState>(emptyForm);
    const [editingId, setEditingId] = useState<string | null>(null);
    const [isEditorOpen, setIsEditorOpen] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

    const closeEditor = (clearMessage = true) => {
        setIsEditorOpen(false);
        setEditingId(null);
        setForm(emptyForm);
        if (clearMessage) setMessage(null);
    };

    const handleCreate = () => {
        setEditingId(null);
        setForm(emptyForm);
        setMessage(null);
        setIsEditorOpen(true);
    };

    const handleSubmit = async () => {
        setIsSaving(true);
        setMessage(null);

        try {
            const result = editingId
                ? await updateUsefulLink(editingId, form)
                : await createUsefulLink(form);

            if (!result.success) {
                setMessage({ type: "error", text: result.error ?? text.saveError });
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

            const successMessage = editingId ? text.updated : text.created;
            closeEditor(false);
            setMessage({ type: "success", text: successMessage });
        } catch (error) {
            setMessage({
                type: "error",
                text: error instanceof Error ? error.message : text.saveError,
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
        setIsEditorOpen(true);
    };

    const handleToggleActive = async (link: UsefulLink) => {
        const result = await updateUsefulLink(link.id, {
            title: link.title,
            href: link.href,
            sort_order: link.sort_order,
            is_active: !link.is_active,
        });

        if (!result.success || !result.link) {
            setMessage({ type: "error", text: result.error ?? text.changeError });
            return;
        }

        setLinks((currentLinks) =>
            currentLinks.map((currentLink) => (currentLink.id === link.id ? { ...currentLink, ...result.link } : currentLink))
        );
        setMessage({ type: "success", text: result.link.is_active ? text.activated : text.deactivated });
    };

    const handleDelete = async (link: UsefulLink) => {
        if (!window.confirm(`Remover "${link.title}"?`)) return;

        const result = await deleteUsefulLink(link.id);
        if (!result.success) {
            setMessage({ type: "error", text: result.error ?? text.removeError });
            return;
        }

        setLinks((currentLinks) => currentLinks.filter((currentLink) => currentLink.id !== link.id));
        setMessage({ type: "success", text: text.removed });
    };

    return (
        <div className="space-y-6">
            <div className="rounded-lg border border-gray-200 bg-white shadow-sm">
                <div className="flex flex-col gap-3 border-b border-gray-200 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                        <h2 className="text-lg font-semibold text-gray-900">{text.registered}</h2>
                        <p className="mt-1 text-sm text-gray-500">{text.totalLinks(links.length)}</p>
                    </div>
                    <Button className="w-full sm:w-auto" iconLeading={Plus} onPress={handleCreate}>
                        {text.newLink}
                    </Button>
                </div>

                {message && !isEditorOpen && (
                    <div className={`mx-5 mt-4 rounded-lg px-3 py-2 text-sm ${message.type === "success" ? "bg-green-50 text-green-800" : "bg-red-50 text-red-800"}`}>
                        {message.text}
                    </div>
                )}

                <div className="divide-y divide-gray-100">
                    {links.map((link) => (
                        <div key={link.id} className="px-5 py-4">
                            <div className="flex min-w-0 flex-1 items-start gap-3">
                                <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-gray-50 text-gray-500">
                                    <Link2 className="size-5" />
                                </span>
                                <div className="min-w-0 flex-1">
                                    <div className="flex flex-wrap items-center gap-2">
                                        <p className="min-w-0 break-words font-semibold text-gray-900">{link.title}</p>
                                        <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${link.is_active ? "bg-green-50 text-green-700" : "bg-gray-100 text-gray-600"}`}>
                                            {link.is_active ? text.active : text.inactive}
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

                            <div className="mt-3 flex flex-wrap gap-2 pl-[52px]">
                                <Button variant="secondary" size="sm" iconLeading={Pencil} onPress={() => handleEdit(link)}>
                                    {text.edit}
                                </Button>
                                <Button variant="secondary" size="sm" onPress={() => handleToggleActive(link)}>
                                    {link.is_active ? text.deactivate : text.activate}
                                </Button>
                                <Button variant="destructive" size="sm" iconLeading={Trash2} onPress={() => handleDelete(link)}>
                                    {text.remove}
                                </Button>
                            </div>
                        </div>
                    ))}

                    {links.length === 0 && (
                        <div className="px-5 py-10 text-center text-sm text-gray-500">
                            {text.empty}
                        </div>
                    )}
                </div>
            </div>

            <ModalOverlay
                isOpen={isEditorOpen}
                onOpenChange={(isOpen) => {
                    if (!isOpen && !isSaving) closeEditor();
                }}
                isDismissable={!isSaving}
                className="items-stretch justify-stretch p-0 sm:items-stretch sm:justify-stretch sm:p-0"
            >
                <Modal className="h-dvh max-h-dvh w-screen max-w-none rounded-none border-none bg-white shadow-none sm:max-w-none">
                    <Dialog className="flex h-full flex-col outline-none">
                        <div className="flex flex-col gap-3 border-b border-gray-200 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
                            <h2 className="text-xl font-semibold text-gray-900">{editingId ? text.editLink : text.newLink}</h2>
                            <div className="flex flex-col gap-2 sm:flex-row">
                                <Button variant="secondary" isDisabled={isSaving} onPress={() => closeEditor()}>
                                    {text.cancel}
                                </Button>
                                <Button iconLeading={Plus} isDisabled={isSaving} onPress={handleSubmit}>
                                    {isSaving ? text.saving : editingId ? text.save : text.add}
                                </Button>
                            </div>
                        </div>

                        <div className="flex-1 overflow-y-auto px-5 py-5">
                            <div className="mx-auto grid max-w-4xl gap-5 lg:grid-cols-[minmax(0,1fr)_220px]">
                                <div className="space-y-4">
                                    <TextInput label={text.title} value={form.title} onChange={(value) => setForm({ ...form, title: value })} />
                                    <TextInput label={text.link} value={form.href} onChange={(value) => setForm({ ...form, href: value })} />
                                </div>

                                <div className="space-y-4">
                                    <TextInput label={text.order} type="number" value={String(form.sort_order)} onChange={(value) => setForm({ ...form, sort_order: Number(value) })} />

                                    <label className="flex items-center gap-2 text-sm font-medium text-gray-700">
                                        <input
                                            type="checkbox"
                                            checked={form.is_active}
                                            onChange={(event) => setForm({ ...form, is_active: event.target.checked })}
                                            className="size-4 rounded border-gray-300 text-brand-600"
                                        />
                                        {text.active}
                                    </label>

                                    {message && isEditorOpen && (
                                        <div className={`rounded-lg px-3 py-2 text-sm ${message.type === "success" ? "bg-green-50 text-green-800" : "bg-red-50 text-red-800"}`}>
                                            {message.text}
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    </Dialog>
                </Modal>
            </ModalOverlay>
        </div>
    );
}

function TextInput({ label, value, onChange, type = "text" }: { label: string; value: string; onChange: (value: string) => void; type?: string }) {
    return (
        <label className="block">
            <span className="text-sm font-semibold text-gray-700">{label}</span>
            <input
                type={type}
                value={value}
                onChange={(event) => onChange(event.target.value)}
                className="mt-1 h-10 w-full rounded-lg border border-gray-300 px-3 text-sm focus:border-brand-600 focus:outline-none focus:ring-4 focus:ring-brand-600/10"
            />
        </label>
    );
}

function sortLinks(first: UsefulLink, second: UsefulLink) {
    if (first.sort_order !== second.sort_order) return first.sort_order - second.sort_order;
    return first.title.localeCompare(second.title);
}
