"use client";

import { useState } from "react";
import { createAlocucao, deleteAlocucao, updateAlocucao, type AlocucaoRecord } from "@/app/actions/alocucoes";
import { Button } from "@/components/ui/Button";
import { Dialog, Modal, ModalOverlay } from "@/components/ui/Modal";
import { Megaphone, Pencil, Plus, Trash2 } from "lucide-react";

type FormState = {
    title: string;
    pt: string;
    en: string;
    es: string;
    sort_order: number;
    is_active: boolean;
};

const emptyForm: FormState = {
    title: "",
    pt: "",
    en: "",
    es: "",
    sort_order: 0,
    is_active: true,
};

const text = {
    active: "Ativa",
    inactive: "Inativa",
    registered: "Alocu\u00e7\u00f5es cadastradas",
    totalItems: (count: number) => `${count} itens no total.`,
    newSpeech: "Nova alocu\u00e7\u00e3o",
    editSpeech: "Editar alocu\u00e7\u00e3o",
    title: "T\u00edtulo",
    order: "Ordem",
    portuguese: "Portugu\u00eas",
    english: "Ingl\u00eas",
    spanish: "Espanhol",
    save: "Salvar",
    add: "Adicionar",
    saving: "Salvando...",
    cancel: "Cancelar",
    edit: "Editar",
    deactivate: "Desativar",
    activate: "Ativar",
    remove: "Remover",
    saveError: "N\u00e3o foi poss\u00edvel salvar a alocu\u00e7\u00e3o.",
    changeError: "N\u00e3o foi poss\u00edvel alterar a alocu\u00e7\u00e3o.",
    removeError: "N\u00e3o foi poss\u00edvel remover a alocu\u00e7\u00e3o.",
    updated: "Alocu\u00e7\u00e3o atualizada.",
    created: "Alocu\u00e7\u00e3o criada.",
    activated: "Alocu\u00e7\u00e3o ativada.",
    deactivated: "Alocu\u00e7\u00e3o desativada.",
    removed: "Alocu\u00e7\u00e3o removida.",
};

export function AlocucoesAdminPage({ initialSpeeches }: { initialSpeeches: AlocucaoRecord[] }) {
    const [speeches, setSpeeches] = useState(initialSpeeches);
    const [form, setForm] = useState<FormState>(emptyForm);
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
                ? await updateAlocucao(editingId, form)
                : await createAlocucao(form);

            if (!result.success || !result.speech) {
                setMessage({ type: "error", text: result.error ?? text.saveError });
                return;
            }

            if (editingId) {
                setSpeeches((current) => current.map((speech) => speech.id === editingId ? result.speech : speech).sort(sortSpeeches));
            } else {
                setSpeeches((current) => [...current, result.speech].sort(sortSpeeches));
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

    const handleEdit = (speech: AlocucaoRecord) => {
        setEditingId(speech.id);
        setForm({
            title: speech.title,
            pt: speech.pt,
            en: speech.en,
            es: speech.es,
            sort_order: speech.sort_order,
            is_active: speech.is_active,
        });
        setMessage(null);
        setIsEditorOpen(true);
    };

    const handleToggleActive = async (speech: AlocucaoRecord) => {
        const result = await updateAlocucao(speech.id, {
            title: speech.title,
            pt: speech.pt,
            en: speech.en,
            es: speech.es,
            sort_order: speech.sort_order,
            is_active: !speech.is_active,
        });

        if (!result.success || !result.speech) {
            setMessage({ type: "error", text: result.error ?? text.changeError });
            return;
        }

        setSpeeches((current) => current.map((item) => item.id === speech.id ? result.speech : item));
        setMessage({ type: "success", text: result.speech.is_active ? text.activated : text.deactivated });
    };

    const handleDelete = async (speech: AlocucaoRecord) => {
        if (!window.confirm(`Remover "${speech.title}"?`)) return;

        const result = await deleteAlocucao(speech.id);
        if (!result.success) {
            setMessage({ type: "error", text: result.error ?? text.removeError });
            return;
        }

        setSpeeches((current) => current.filter((item) => item.id !== speech.id));
        setMessage({ type: "success", text: text.removed });
    };

    return (
        <div className="space-y-6">
            <div className="rounded-lg border border-gray-200 bg-white shadow-sm">
                <div className="flex flex-col gap-3 border-b border-gray-200 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                        <h2 className="text-lg font-semibold text-gray-900">{text.registered}</h2>
                        <p className="mt-1 text-sm text-gray-500">{text.totalItems(speeches.length)}</p>
                    </div>
                    <Button className="w-full sm:w-auto" iconLeading={Plus} onPress={handleCreate}>
                        {text.newSpeech}
                    </Button>
                </div>

                {message && !isEditorOpen && (
                    <div className={`mx-5 mt-4 rounded-lg px-3 py-2 text-sm ${message.type === "success" ? "bg-green-50 text-green-800" : "bg-red-50 text-red-800"}`}>
                        {message.text}
                    </div>
                )}

                <div className="divide-y divide-gray-100">
                    {speeches.map((speech) => (
                        <div key={speech.id} className="px-5 py-4">
                            <div className="flex min-w-0 flex-1 items-start gap-3">
                                <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-gray-50 text-gray-500">
                                    <Megaphone className="size-5" />
                                </span>
                                <div className="min-w-0 flex-1">
                                    <div className="flex flex-wrap items-center gap-2">
                                        <p className="min-w-0 break-words font-semibold text-gray-900">{speech.title}</p>
                                        <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${speech.is_active ? "bg-green-50 text-green-700" : "bg-gray-100 text-gray-600"}`}>
                                            {speech.is_active ? text.active : text.inactive}
                                        </span>
                                    </div>
                                    <p className="mt-1 line-clamp-2 text-sm text-gray-500">{speech.pt || speech.en || speech.es}</p>
                                </div>
                            </div>

                            <div className="mt-3 flex flex-wrap gap-2 pl-[52px]">
                                <Button variant="secondary" size="sm" iconLeading={Pencil} onPress={() => handleEdit(speech)}>
                                    {text.edit}
                                </Button>
                                <Button variant="secondary" size="sm" onPress={() => handleToggleActive(speech)}>
                                    {speech.is_active ? text.deactivate : text.activate}
                                </Button>
                                <Button variant="destructive" size="sm" iconLeading={Trash2} onPress={() => handleDelete(speech)}>
                                    {text.remove}
                                </Button>
                            </div>
                        </div>
                    ))}
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
                            <h2 className="text-xl font-semibold text-gray-900">{editingId ? text.editSpeech : text.newSpeech}</h2>
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
                            <div className="mx-auto grid max-w-6xl gap-5 lg:grid-cols-[minmax(0,1fr)_220px]">
                                <div className="space-y-4">
                                    <TextInput label={text.title} value={form.title} onChange={(value) => setForm({ ...form, title: value })} />
                                    <TextArea label={text.portuguese} value={form.pt} onChange={(value) => setForm({ ...form, pt: value })} />
                                    <TextArea label={text.english} value={form.en} onChange={(value) => setForm({ ...form, en: value })} />
                                    <TextArea label={text.spanish} value={form.es} onChange={(value) => setForm({ ...form, es: value })} />
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

function TextArea({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
    return (
        <label className="block">
            <span className="text-sm font-semibold text-gray-700">{label}</span>
            <textarea
                value={value}
                onChange={(event) => onChange(event.target.value)}
                rows={7}
                className="mt-1 min-h-40 w-full resize-y rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-brand-600 focus:outline-none focus:ring-4 focus:ring-brand-600/10"
            />
        </label>
    );
}

function sortSpeeches(first: AlocucaoRecord, second: AlocucaoRecord) {
    if (first.sort_order !== second.sort_order) return first.sort_order - second.sort_order;
    return first.title.localeCompare(second.title);
}
