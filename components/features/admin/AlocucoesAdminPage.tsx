"use client";

import { useState } from "react";
import { createAlocucao, deleteAlocucao, updateAlocucao, type AlocucaoRecord } from "@/app/actions/alocucoes";
import { Button } from "@/components/ui/Button";
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

export function AlocucoesAdminPage({ initialSpeeches }: { initialSpeeches: AlocucaoRecord[] }) {
    const [speeches, setSpeeches] = useState(initialSpeeches);
    const [form, setForm] = useState<FormState>(emptyForm);
    const [editingId, setEditingId] = useState<string | null>(null);
    const [isSaving, setIsSaving] = useState(false);
    const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

    const handleSubmit = async () => {
        setIsSaving(true);
        setMessage(null);

        try {
            const result = editingId
                ? await updateAlocucao(editingId, form)
                : await createAlocucao(form);

            if (!result.success || !result.speech) {
                setMessage({ type: "error", text: result.error ?? "Não foi possível salvar a alocução." });
                return;
            }

            if (editingId) {
                setSpeeches((current) => current.map((speech) => speech.id === editingId ? result.speech : speech).sort(sortSpeeches));
            } else {
                setSpeeches((current) => [...current, result.speech].sort(sortSpeeches));
            }

            setForm(emptyForm);
            setEditingId(null);
            setMessage({ type: "success", text: editingId ? "Alocução atualizada." : "Alocução criada." });
        } catch (error) {
            setMessage({
                type: "error",
                text: error instanceof Error ? error.message : "Não foi possível salvar a alocução.",
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
            setMessage({ type: "error", text: result.error ?? "Não foi possível alterar a alocução." });
            return;
        }

        setSpeeches((current) => current.map((item) => item.id === speech.id ? result.speech : item));
        setMessage({ type: "success", text: result.speech.is_active ? "Alocução ativada." : "Alocução desativada." });
    };

    const handleDelete = async (speech: AlocucaoRecord) => {
        if (!window.confirm(`Remover "${speech.title}"?`)) return;

        const result = await deleteAlocucao(speech.id);
        if (!result.success) {
            setMessage({ type: "error", text: result.error ?? "Não foi possível remover a alocução." });
            return;
        }

        setSpeeches((current) => current.filter((item) => item.id !== speech.id));
        setMessage({ type: "success", text: "Alocução removida." });
    };

    return (
        <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(380px,520px)]">
            <div className="rounded-lg border border-gray-200 bg-white shadow-sm">
                <div className="border-b border-gray-200 px-5 py-4">
                    <h2 className="text-lg font-semibold text-gray-900">Alocuções cadastradas</h2>
                    <p className="mt-1 text-sm text-gray-500">{speeches.length} itens no total.</p>
                </div>

                <div className="divide-y divide-gray-100">
                    {speeches.map((speech) => (
                        <div key={speech.id} className="flex flex-col gap-3 px-5 py-4 lg:flex-row lg:items-center">
                            <div className="flex min-w-0 flex-1 items-start gap-3">
                                <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-gray-50 text-gray-500">
                                    <Megaphone className="size-5" />
                                </span>
                                <div className="min-w-0">
                                    <div className="flex flex-wrap items-center gap-2">
                                        <p className="font-semibold text-gray-900">{speech.title}</p>
                                        <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${speech.is_active ? "bg-green-50 text-green-700" : "bg-gray-100 text-gray-600"}`}>
                                            {speech.is_active ? "Ativa" : "Inativa"}
                                        </span>
                                    </div>
                                    <p className="mt-1 line-clamp-2 text-sm text-gray-500">{speech.pt || speech.en || speech.es}</p>
                                </div>
                            </div>

                            <div className="flex shrink-0 flex-wrap gap-2">
                                <Button variant="secondary" size="sm" iconLeading={Pencil} onPress={() => handleEdit(speech)}>
                                    Editar
                                </Button>
                                <Button variant="secondary" size="sm" onPress={() => handleToggleActive(speech)}>
                                    {speech.is_active ? "Desativar" : "Ativar"}
                                </Button>
                                <Button variant="destructive" size="sm" iconLeading={Trash2} onPress={() => handleDelete(speech)}>
                                    Remover
                                </Button>
                            </div>
                        </div>
                    ))}
                </div>
            </div>

            <div className="rounded-lg border border-gray-200 bg-white p-5 shadow-sm">
                <div className="mb-5">
                    <h2 className="text-lg font-semibold text-gray-900">{editingId ? "Editar alocução" : "Nova alocução"}</h2>
                </div>

                <div className="space-y-4">
                    <TextInput label="Título" value={form.title} onChange={(value) => setForm({ ...form, title: value })} />
                    <TextInput label="Ordem" type="number" value={String(form.sort_order)} onChange={(value) => setForm({ ...form, sort_order: Number(value) })} />
                    <TextArea label="Português" value={form.pt} onChange={(value) => setForm({ ...form, pt: value })} />
                    <TextArea label="Inglês" value={form.en} onChange={(value) => setForm({ ...form, en: value })} />
                    <TextArea label="Espanhol" value={form.es} onChange={(value) => setForm({ ...form, es: value })} />

                    <label className="flex items-center gap-2 text-sm font-medium text-gray-700">
                        <input
                            type="checkbox"
                            checked={form.is_active}
                            onChange={(event) => setForm({ ...form, is_active: event.target.checked })}
                            className="size-4 rounded border-gray-300 text-brand-600"
                        />
                        Ativa
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
                            <Button
                                variant="secondary"
                                className="w-full"
                                isDisabled={isSaving}
                                onPress={() => {
                                    setEditingId(null);
                                    setForm(emptyForm);
                                    setMessage(null);
                                }}
                            >
                                Cancelar
                            </Button>
                        )}
                    </div>
                </div>
            </div>
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
                className="mt-1 w-full resize-y rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-brand-600 focus:outline-none focus:ring-4 focus:ring-brand-600/10"
            />
        </label>
    );
}

function sortSpeeches(first: AlocucaoRecord, second: AlocucaoRecord) {
    if (first.sort_order !== second.sort_order) return first.sort_order - second.sort_order;
    return first.title.localeCompare(second.title);
}
