"use client";

import Link from "next/link";
import { CheckCircle2, Zap, BarChart3, Users, Globe, Shield } from "lucide-react";
import { Button } from "@/components/ui/Button";

export const LandingPage = () => {
    return (
        <div className="flex flex-col">
            {/* Hero Section */}
            <section className="relative bg-white pt-20 pb-20 md:pt-32 md:pb-32 overflow-hidden">
                <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 relative z-10">
                    <div className="text-center">
                        <h1 className="text-4xl font-extrabold tracking-tight text-gray-900 sm:text-6xl md:text-7xl">
                            Gerencie seus serviços de bordo e seus documentos de voo.
                        </h1>
                        <p className="mx-auto mt-6 max-w-2xl text-lg text-gray-500 md:text-xl">
                            O Trip Space mantém sua escala, meal plan e informações de serviço de bordo sempre alinhados.
                        </p>
                        <div className="mt-10 flex flex-wrap items-center justify-center gap-4">
                            <Link href="/signup">
                                <Button size="xl" className="h-14 px-8 text-lg">
                                Começar agora
                                </Button>
                            </Link>
                            <Link href="/auth">
                                <Button variant="secondary" size="xl" className="h-14 px-8 text-lg">
                                Entrar no app
                                </Button>
                            </Link>
                        </div>
                    </div>
                </div>

                {/* Decorative Background Element */}
                <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full h-[600px] opacity-[0.03] pointer-events-none">
                    <svg viewBox="0 0 1000 1000" xmlns="http://www.w3.org/2000/svg">
                        <path d="M500,1000 C223.857625,1000 0,776.142375 0,500 C0,223.857625 223.857625,0 500,0 C776.142375,0 1000,223.857625 1000,500 C1000,776.142375 776.142375,1000 500,1000 Z M500,900 C720.9139,900 900,720.9139 900,500 C900,279.0861 720.9139,100 500,100 C279.0861,100 100,279.0861 100,500 C100,720.9139 279.0861,900 500,900 Z" fill="currentColor" />
                    </svg>
                </div>
            </section>

            {/* Social Proof */}
            <section className="bg-gray-50 py-16">
                <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 text-center">
                    <p className="text-sm font-semibold uppercase tracking-wider text-gray-500 mb-8">
                        FEITO PARA TRIPULANTES QUE PRECISAM DE AGILIDADE
                    </p>
                    <div className="flex flex-wrap justify-center items-center gap-12 opacity-40 grayscale">
                        {/* Placeholder Logos */}
                        <div className="text-2xl font-bold italic text-gray-900">Bolt</div>
                        <div className="text-2xl font-bold italic text-gray-900">Linear</div>
                        <div className="text-2xl font-bold italic text-gray-900">Figma</div>
                        <div className="text-2xl font-bold italic text-gray-900">Stripe</div>
                        <div className="text-2xl font-bold italic text-gray-900">Vercel</div>
                    </div>
                </div>
            </section>

            {/* Features Section */}
            <section className="py-24 bg-white">
                <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
                    <div className="text-center mb-16">
                        <h2 className="text-brand-600 font-semibold mb-2">Recursos</h2>
                        <h3 className="text-3xl font-bold text-gray-900 sm:text-4xl">
                            Tudo que você precisa antes do voo
                        </h3>
                        <p className="mt-4 text-lg text-gray-500">
                            Consulte escala, serviços, links úteis e alocuções em uma interface rápida.
                        </p>
                    </div>

                    <div className="grid grid-cols-1 gap-12 md:grid-cols-3">
                        <FeatureCard
                            icon={Zap}
                            title="Rápido"
                            description="Acesse suas informações essenciais sem perder tempo."
                        />
                        <FeatureCard
                            icon={BarChart3}
                            title="Serviços atualizados"
                            description="Atualize os serviços dos voos quando o meal plan fixo mudar."
                        />
                        <FeatureCard
                            icon={Shield}
                            title="Acesso seguro"
                            description="Conta autenticada e áreas administrativas protegidas."
                        />
                        <FeatureCard
                            icon={Users}
                            title="Telegram"
                            description="Envie apenas os voos selecionados diretamente pelo Telegram."
                        />
                        <FeatureCard
                            icon={Globe}
                            title="Alocuções"
                            description="Biblioteca trilíngue com leitura em tela cheia."
                        />
                        <FeatureCard
                            icon={CheckCircle2}
                            title="Links úteis"
                            description="Acesse portais e documentos importantes em formato linktree."
                        />
                    </div>
                </div>
            </section>

            {/* Image/Highlight Section */}
            <section className="py-24 bg-gray-900 text-white overflow-hidden">
                <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
                    <div className="flex flex-col lg:flex-row items-center gap-16">
                        <div className="lg:w-1/2">
                            <h2 className="text-3xl font-bold sm:text-4xl mb-6">
                                Planejamento de bordo <br />
                                <span className="text-brand-400">na palma da mão.</span>
                            </h2>
                            <p className="text-lg text-gray-400 mb-8">
                                Mantenha sua escala sincronizada com o meal plan mais recente e veja rapidamente os serviços de cada voo.
                            </p>
                            <ul className="space-y-4">
                                <li className="flex items-center gap-3">
                                    <div className="rounded-full bg-brand-500/10 p-1">
                                        <CheckCircle2 className="h-5 w-5 text-brand-400" />
                                    </div>
                                    <span className="text-gray-300 font-medium">Atualização da escala pelo meal plan</span>
                                </li>
                                <li className="flex items-center gap-3">
                                    <div className="rounded-full bg-brand-500/10 p-1">
                                        <CheckCircle2 className="h-5 w-5 text-brand-400" />
                                    </div>
                                    <span className="text-gray-300 font-medium">Leitura de PDFs de escala e meal plan</span>
                                </li>
                                <li className="flex items-center gap-3">
                                    <div className="rounded-full bg-brand-500/10 p-1">
                                        <CheckCircle2 className="h-5 w-5 text-brand-400" />
                                    </div>
                                    <span className="text-gray-300 font-medium">Status claro para voos sem correspondência</span>
                                </li>
                            </ul>
                        </div>
                        <div className="lg:w-1/2 relative">
                            <div className="aspect-video rounded-2xl bg-gray-800 border-8 border-gray-700 shadow-2xl overflow-hidden">
                                <img
                                    src="https://images.unsplash.com/photo-1551288049-bbbda536339a?q=80&w=2670&auto=format&fit=crop"
                                    alt="Prévia do painel"
                                    className="w-full h-full object-cover"
                                />
                            </div>
                            {/* Accent elements */}
                            <div className="absolute -bottom-6 -right-6 h-32 w-32 bg-brand-600/20 blur-3xl pointer-events-none" />
                        </div>
                    </div>
                </div>
            </section>
        </div>
    );
};

const FeatureCard = ({ icon: Icon, title, description }: { icon: any, title: string, description: string }) => (
    <div className="flex flex-col p-6 rounded-2xl border border-gray-100 bg-white shadow-sm hover:shadow-md transition-shadow">
        <div className="size-12 rounded-lg bg-brand-50 flex items-center justify-center mb-6">
            <Icon className="h-6 w-6 text-brand-600" />
        </div>
        <h4 className="text-xl font-bold text-gray-900 mb-3">{title}</h4>
        <p className="text-gray-500">{description}</p>
    </div>
);
