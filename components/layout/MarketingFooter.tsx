"use client";

import Link from "next/link";
import { UntitledUiLogo } from "@/components/ui/logos";

export const MarketingFooter = () => {
    return (
        <footer className="bg-white border-t border-gray-100">
            <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
                <div className="grid grid-cols-2 gap-8 md:grid-cols-4">
                    <div>
                        <h3 className="text-sm font-semibold text-gray-900 tracking-wider uppercase">Produto</h3>
                        <ul className="mt-4 space-y-4">
                            <li><NavLink href="#">Visão geral</NavLink></li>
                            <li><NavLink href="#">Recursos</NavLink></li>
                            <li><NavLink href="/pricing">Preços</NavLink></li>
                            <li><NavLink href="#">Novidades</NavLink></li>
                        </ul>
                    </div>
                    <div>
                        <h3 className="text-sm font-semibold text-gray-900 tracking-wider uppercase">Empresa</h3>
                        <ul className="mt-4 space-y-4">
                            <li><NavLink href="#">Sobre</NavLink></li>
                            <li><NavLink href="#">Carreiras</NavLink></li>
                            <li><NavLink href="#">Blog</NavLink></li>
                            <li><NavLink href="/contact">Contato</NavLink></li>
                        </ul>
                    </div>
                    <div>
                        <h3 className="text-sm font-semibold text-gray-900 tracking-wider uppercase">Recursos</h3>
                        <ul className="mt-4 space-y-4">
                            <li><NavLink href="#">Documentação</NavLink></li>
                            <li><NavLink href="/support">Central de ajuda</NavLink></li>
                            <li><NavLink href="#">Guias</NavLink></li>
                            <li><NavLink href="#">Status da API</NavLink></li>
                        </ul>
                    </div>
                    <div>
                        <h3 className="text-sm font-semibold text-gray-900 tracking-wider uppercase">Legal</h3>
                        <ul className="mt-4 space-y-4">
                            <li><NavLink href="#">Privacidade</NavLink></li>
                            <li><NavLink href="#">Termos</NavLink></li>
                            <li><NavLink href="#">Cookies</NavLink></li>
                            <li><NavLink href="#">Licenças</NavLink></li>
                        </ul>
                    </div>
                </div>
                <div className="mt-12 border-t border-gray-100 pt-8 flex flex-col md:flex-row items-center justify-between gap-6">
                    <div className="flex items-center gap-2 text-gray-900">
                        <UntitledUiLogo className="h-8 w-auto text-gray-900" />
                    </div>
                    <p className="text-sm text-gray-500">
                        &copy; {new Date().getFullYear()} Trip Space. Todos os direitos reservados.
                    </p>
                </div>
            </div>
        </footer>
    );
};

const NavLink = ({ href, children }: { href: string; children: React.ReactNode }) => (
    <Link href={href} className="text-base text-gray-600 hover:text-gray-900 transition-colors">
        {children}
    </Link>
);
