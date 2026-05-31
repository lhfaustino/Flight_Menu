"use client";

import * as React from "react";
import { ArrowRight, ClipboardList, HelpCircle, Search, Settings } from "lucide-react";
import { Dialog, Modal, ModalOverlay } from "@/components/ui/Modal";

interface CommandItem {
    id: string;
    title: string;
    description?: string;
    icon: React.ElementType;
    category: "Pages";
    onClick: () => void;
}

interface CommandPaletteProps {
    onNavigate?: (view: string) => void;
}

export const CommandPalette = ({ onNavigate }: CommandPaletteProps) => {
    const [isOpen, setIsOpen] = React.useState(false);
    const [search, setSearch] = React.useState("");

    React.useEffect(() => {
        const handleKeyDown = (event: KeyboardEvent) => {
            if ((event.metaKey || event.ctrlKey) && event.key === "k") {
                event.preventDefault();
                setIsOpen(true);
            }
        };

        const handleOpen = (event: CustomEvent<{ search?: string }>) => {
            setIsOpen(true);
            if (event.detail?.search) setSearch(event.detail.search);
        };

        window.addEventListener("keydown", handleKeyDown);
        window.addEventListener("open-command-palette", handleOpen as EventListener);
        return () => {
            window.removeEventListener("keydown", handleKeyDown);
            window.removeEventListener("open-command-palette", handleOpen as EventListener);
        };
    }, []);

    const commands: CommandItem[] = [
        {
            id: "meal-plan",
            title: "Meal Plan",
            description: "Upload PDFs and view flight meal service",
            icon: ClipboardList,
            category: "Pages",
            onClick: () => onNavigate?.("meal-plan"),
        },
        {
            id: "settings",
            title: "Settings",
            description: "Profile and workspace settings",
            icon: Settings,
            category: "Pages",
            onClick: () => onNavigate?.("settings"),
        },
        {
            id: "support",
            title: "Support",
            description: "Get help and support",
            icon: HelpCircle,
            category: "Pages",
            onClick: () => onNavigate?.("support"),
        },
    ];

    const filteredCommands = commands.filter((command) =>
        command.title.toLowerCase().includes(search.toLowerCase()) ||
        command.description?.toLowerCase().includes(search.toLowerCase())
    );

    if (!isOpen) return null;

    return (
        <ModalOverlay isOpen={isOpen} onOpenChange={setIsOpen} isDismissable className="items-start pt-[10dvh]">
            <Modal className="max-w-2xl w-full p-0 overflow-hidden bg-white shadow-2xl border-none">
                <Dialog className="outline-hidden">
                    <div className="flex max-h-[60vh] flex-col">
                        <div className="flex items-center gap-3 border-b border-gray-100 p-4">
                            <Search className="size-5 text-gray-400" />
                            <input
                                autoFocus
                                placeholder="Search pages..."
                                className="flex-1 border-none bg-transparent text-lg text-gray-900 outline-hidden placeholder:text-gray-400"
                                value={search}
                                onChange={(event) => setSearch(event.target.value)}
                            />
                            <div className="flex items-center gap-1.5 rounded-md border border-gray-200 bg-gray-50 px-2 py-1">
                                <span className="text-[10px] font-bold uppercase tracking-widest text-gray-500">ESC</span>
                            </div>
                        </div>

                        <div className="flex-1 overflow-y-auto p-2">
                            {filteredCommands.length > 0 ? (
                                <div className="mb-4 last:mb-0">
                                    <h3 className="px-3 py-2 text-[10px] font-bold uppercase tracking-widest text-gray-400">
                                        Pages
                                    </h3>
                                    <div className="space-y-1">
                                        {filteredCommands.map((command) => (
                                            <button
                                                key={command.id}
                                                onClick={() => {
                                                    command.onClick();
                                                    setIsOpen(false);
                                                }}
                                                className="group flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left transition-colors hover:bg-gray-50"
                                            >
                                                <div className="flex size-9 items-center justify-center rounded-lg border border-gray-100 bg-gray-50 transition-colors group-hover:border-brand-200 group-hover:bg-white">
                                                    <command.icon className="size-5 text-gray-500 transition-colors group-hover:text-brand-600" />
                                                </div>
                                                <div className="min-w-0 flex-1">
                                                    <span className="font-semibold text-gray-900">{command.title}</span>
                                                    {command.description && (
                                                        <p className="truncate text-xs text-gray-500">{command.description}</p>
                                                    )}
                                                </div>
                                                <ArrowRight className="size-4 -translate-x-2 text-gray-300 opacity-0 transition-all group-hover:translate-x-0 group-hover:opacity-100" />
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            ) : (
                                <div className="py-12 text-center">
                                    <div className="mx-auto mb-4 flex size-12 items-center justify-center rounded-full bg-gray-50">
                                        <Search className="size-6 text-gray-300" />
                                    </div>
                                    <h4 className="font-bold text-gray-900">No results found</h4>
                                    <p className="text-sm text-gray-500">Try searching for something else.</p>
                                </div>
                            )}
                        </div>

                        <div className="flex items-center justify-between border-t border-gray-100 bg-gray-50 px-6 py-3 text-[10px] font-bold uppercase tracking-widest text-gray-400">
                            <span className="flex items-center gap-1.5">
                                <ArrowRight className="size-3 rotate-90" /> Select
                            </span>
                            <span>Flight Menu</span>
                        </div>
                    </div>
                </Dialog>
            </Modal>
        </ModalOverlay>
    );
};
