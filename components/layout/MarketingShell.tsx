"use client";

import type { ReactNode } from "react";
import { BrandLogo } from "@/components/ui/BrandLogo";
import { Button } from "@/components/ui/Button";
import { cx } from "@/lib/utils";

interface MarketingShellProps {
    children: ReactNode;
    currentView: string;
    onViewChange: (view: any) => void;
}

export const MarketingShell = ({ children, currentView, onViewChange }: MarketingShellProps) => {
    const navItems = [
        { label: "Início", view: "landing" },
        { label: "Contato", view: "contact" },
    ];

    return (
        <div className="flex min-h-screen flex-col bg-white">
            {/* Navigation */}
            <header className="sticky top-0 z-40 w-full border-b border-gray-100 bg-white/80 backdrop-blur-md">
                <div className="mx-auto flex h-20 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
                    <div className="flex items-center gap-8">
                        <BrandLogo size="md" />
                        <nav className="hidden md:flex items-center gap-6">
                            {navItems.map((item) => (
                                <button
                                    key={item.view}
                                    onClick={() => onViewChange(item.view)}
                                    className={cx(
                                        "text-sm font-semibold transition-colors hover:text-brand-600",
                                        currentView === item.view ? "text-brand-600" : "text-gray-600"
                                    )}
                                >
                                    {item.label}
                                </button>
                            ))}
                        </nav>
                    </div>
                    <div className="flex items-center gap-3">
                        <button
                            onClick={() => onViewChange("login")}
                            className="text-sm font-semibold text-gray-600 hover:text-gray-900 px-4 py-2"
                        >
                            Entrar
                        </button>
                        <Button size="md" onClick={() => onViewChange("signup")}>
                            Cadastrar
                        </Button>
                    </div>
                </div>
            </header>

            {/* Main Content */}
            <main className="flex-1">
                {children}
            </main>

            {/* Footer */}
            <footer className="border-t border-gray-100 bg-gray-50 py-8">
                <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
                    <div className="flex flex-col items-center justify-between gap-6 text-sm text-gray-500 md:flex-row">
                        <BrandLogo size="md" />
                        <span>© 2026 Trip Space. Todos os direitos reservados.</span>
                    </div>
                </div>
            </footer>
        </div>
    );
};
