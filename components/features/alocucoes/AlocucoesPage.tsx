"use client";

import { useEffect, useMemo, useState } from "react";
import { Dialog, Modal, ModalOverlay } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { GripVertical, Languages, Megaphone, X } from "lucide-react";

export type Alocucao = {
    id: string;
    title: string;
    pt: string;
    en: string;
    es: string;
};

type LanguageCode = "pt" | "en" | "es";

const languages: { code: LanguageCode; label: string; flag: string }[] = [
    { code: "pt", label: "Português", flag: "🇧🇷" },
    { code: "en", label: "English", flag: "🇺🇸" },
    { code: "es", label: "Español", flag: "🇪🇸" },
];

const storageKey = "flight-menu:alocucoes-order";

export function AlocucoesPage({ speeches }: { speeches: Alocucao[] }) {
    const [orderedIds, setOrderedIds] = useState<string[]>(() => speeches.map((speech) => speech.id));
    const [draggedId, setDraggedId] = useState<string | null>(null);
    const [selectedSpeech, setSelectedSpeech] = useState<Alocucao | null>(null);
    const [language, setLanguage] = useState<LanguageCode>("pt");

    useEffect(() => {
        const savedOrder = window.localStorage.getItem(storageKey);
        if (!savedOrder) return;

        try {
            const parsedOrder = JSON.parse(savedOrder);
            if (Array.isArray(parsedOrder)) {
                const availableIds = new Set(speeches.map((speech) => speech.id));
                const savedIds = parsedOrder.filter((id) => typeof id === "string" && availableIds.has(id));
                const missingIds = speeches.map((speech) => speech.id).filter((id) => !savedIds.includes(id));
                setOrderedIds([...savedIds, ...missingIds]);
            }
        } catch {
            window.localStorage.removeItem(storageKey);
        }
    }, [speeches]);

    useEffect(() => {
        window.localStorage.setItem(storageKey, JSON.stringify(orderedIds));
    }, [orderedIds]);

    const orderedSpeeches = useMemo(() => {
        const speechesById = new Map(speeches.map((speech) => [speech.id, speech]));
        return orderedIds.map((id) => speechesById.get(id)).filter(Boolean) as Alocucao[];
    }, [orderedIds, speeches]);

    const handleDrop = (targetId: string) => {
        if (!draggedId || draggedId === targetId) {
            setDraggedId(null);
            return;
        }

        setOrderedIds((currentIds) => {
            const nextIds = currentIds.filter((id) => id !== draggedId);
            const targetIndex = nextIds.indexOf(targetId);
            nextIds.splice(targetIndex, 0, draggedId);
            return nextIds;
        });
        setDraggedId(null);
    };

    const moveToTop = (speechId: string) => {
        setOrderedIds((currentIds) => [speechId, ...currentIds.filter((id) => id !== speechId)]);
    };

    const selectedBody = selectedSpeech ? selectedSpeech[language] : "";

    return (
        <>
            <div className="mx-auto max-w-3xl">
                <div className="mb-8">
                    <p className="text-sm font-semibold uppercase tracking-wide text-brand-600">Biblioteca</p>
                    <h1 className="mt-2 text-3xl font-bold text-gray-900">Alocuções</h1>
                    <p className="mt-2 text-gray-600">
                        Arraste as alocuções mais usadas para o topo e toque em uma delas para abrir a leitura em tela cheia.
                    </p>
                </div>

                <div className="space-y-3">
                    {orderedSpeeches.map((speech) => (
                        <div
                            key={speech.id}
                            draggable
                            onDragStart={() => setDraggedId(speech.id)}
                            onDragOver={(event) => event.preventDefault()}
                            onDrop={() => handleDrop(speech.id)}
                            onDragEnd={() => setDraggedId(null)}
                            className={`group flex items-center gap-3 rounded-lg border bg-white px-3 py-3 shadow-sm transition-colors ${
                                draggedId === speech.id ? "border-brand-300 bg-brand-50" : "border-gray-200 hover:border-brand-200 hover:bg-brand-50/40"
                            }`}
                        >
                            <button
                                type="button"
                                className="flex size-9 shrink-0 cursor-grab items-center justify-center rounded-lg text-gray-400 transition-colors hover:bg-gray-50 hover:text-gray-700"
                                aria-label={`Mover ${speech.title}`}
                            >
                                <GripVertical className="size-5" />
                            </button>

                            <button
                                type="button"
                                onClick={() => {
                                    setSelectedSpeech(speech);
                                    setLanguage("pt");
                                }}
                                className="flex min-w-0 flex-1 items-center gap-3 text-left"
                            >
                                <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-gray-50 text-gray-500 transition-colors group-hover:bg-white group-hover:text-brand-600">
                                    <Megaphone className="size-5" />
                                </span>
                                <span className="min-w-0">
                                    <span className="block font-semibold text-gray-900">{speech.title}</span>
                                    <span className="block truncate text-sm text-gray-500">{speech.pt}</span>
                                </span>
                            </button>

                            <Button variant="secondary" size="sm" onPress={() => moveToTop(speech.id)}>
                                Topo
                            </Button>
                        </div>
                    ))}
                </div>
            </div>

            <ModalOverlay
                isOpen={Boolean(selectedSpeech)}
                onOpenChange={(isOpen) => {
                    if (!isOpen) setSelectedSpeech(null);
                }}
                isDismissable
                className="items-stretch justify-stretch p-0 sm:p-0"
            >
                <Modal className="h-dvh max-h-dvh w-screen max-w-none rounded-none border-none bg-white shadow-none sm:max-w-none">
                    <Dialog className="flex h-full flex-col outline-none">
                        <div className="flex shrink-0 items-start justify-between gap-4 border-b border-gray-200 px-4 py-4 sm:px-8">
                            <div className="min-w-0">
                                <p className="text-sm font-semibold uppercase tracking-wide text-brand-600">Alocução</p>
                                <h2 className="mt-1 text-xl font-bold text-gray-900 sm:text-2xl">{selectedSpeech?.title}</h2>
                            </div>
                            <Button variant="secondary" size="sm" iconLeading={X} onPress={() => setSelectedSpeech(null)}>
                                Fechar
                            </Button>
                        </div>

                        <div className="shrink-0 border-b border-gray-200 bg-gray-50 px-4 py-3 sm:px-8">
                            <div className="flex flex-wrap items-center gap-2">
                                <Languages className="size-4 text-gray-500" />
                                {languages.map((item) => (
                                    <button
                                        key={item.code}
                                        type="button"
                                        onClick={() => setLanguage(item.code)}
                                        className={`inline-flex h-10 items-center gap-2 rounded-lg border px-3 text-sm font-semibold transition-colors ${
                                            language === item.code
                                                ? "border-brand-600 bg-brand-50 text-brand-700"
                                                : "border-gray-200 bg-white text-gray-700 hover:border-brand-200 hover:bg-brand-50/40"
                                        }`}
                                    >
                                        <span aria-hidden="true">{item.flag}</span>
                                        {item.label}
                                    </button>
                                ))}
                            </div>
                        </div>

                        <div className="flex-1 overflow-y-auto px-4 py-6 sm:px-8">
                            <div className="mx-auto max-w-4xl whitespace-pre-wrap text-lg leading-8 text-gray-800">
                                {selectedBody || "Sem texto cadastrado para este idioma."}
                            </div>
                        </div>
                    </Dialog>
                </Modal>
            </ModalOverlay>
        </>
    );
}
