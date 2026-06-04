"use client";

import { useState } from "react";
import { Search, Book, Zap, Shield, HelpCircle, ArrowRight, ChevronRight, MessageSquare, ExternalLink } from "lucide-react";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { Card, CardContent } from "@/components/ui/Card";
import { cx } from "@/lib/utils";

interface Article {
    id: string;
    title: string;
    description: string;
    category: "getting-started" | "account" | "features" | "security";
}

const categories = [
    { id: "getting-started", title: "Primeiros passos", icon: Zap, description: "Tudo que você precisa para começar a usar o app." },
    { id: "account", title: "Conta", icon: Shield, description: "Gerencie perfil, segurança e preferências." },
    { id: "features", title: "Recursos do app", icon: Book, description: "Guias sobre planilhas, Telegram, links e alocuções." },
    { id: "support", title: "Suporte e FAQ", icon: HelpCircle, description: "Encontre respostas para dúvidas frequentes." },
];

const articles: Article[] = [
    { id: "1", title: "Enviando sua planilha", description: "Veja como importar sua escala e consultar os voos do dia.", category: "getting-started" },
    { id: "2", title: "Conectando o Telegram", description: "Configure sua conta para enviar informações dos voos pelo bot.", category: "getting-started" },
    { id: "3", title: "Gerenciando seu perfil", description: "Atualize nome, foto e preferências da sua conta.", category: "account" },
    { id: "4", title: "Segurança da conta", description: "Mantenha sua conta protegida com boas práticas de senha.", category: "security" },
];

interface HelpCenterProps {
    onContactSupport?: () => void;
}

export const HelpCenter = ({ onContactSupport }: HelpCenterProps) => {
    const [search, setSearch] = useState("");
    const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
    const [selectedArticleId, setSelectedArticleId] = useState<string | null>(null);

    const selectedArticle = articles.find(a => a.id === selectedArticleId);

    const filteredArticles = articles.filter(a =>
        (selectedCategory ? a.category === selectedCategory : true) &&
        (a.title.toLowerCase().includes(search.toLowerCase()) || a.description.toLowerCase().includes(search.toLowerCase()))
    );

    return (
        <div className="space-y-12">
            {selectedArticle ? (
                <ArticleView article={selectedArticle} onBack={() => setSelectedArticleId(null)} />
            ) : (
                <>
                    {/* Hero Section */}
                    <div className="bg-brand-900 rounded-3xl p-12 text-center space-y-8 relative overflow-hidden">
                        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,_var(--color-brand-600)_0%,_transparent_50%)] opacity-40" />
                        <div className="relative z-10 space-y-4">
                            <h1 className="text-display-sm font-bold text-white">Como podemos ajudar?</h1>
                            <p className="text-brand-200 text-lg max-w-xl mx-auto">Busque respostas ou explore os tópicos de ajuda abaixo.</p>
                            <div className="max-w-2xl mx-auto relative group">
                                <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 group-focus-within:text-brand-500 transition-colors" />
                                <Input
                                    placeholder="Buscar artigos, guias e dúvidas..."
                                    className="h-14 pl-12 bg-white/95 border-none shadow-xl text-lg rounded-2xl focus:ring-4 focus:ring-brand-500/20"
                                    value={search}
                                    onChange={(e) => setSearch(e.target.value)}
                                />
                            </div>
                        </div>
                    </div>

                    {/* Main Content */}
                    <div className="grid grid-cols-1 lg:grid-cols-4 gap-12">
                        {/* Sidebar */}
                        <aside className="lg:col-span-1 space-y-8">
                            <div className="space-y-4">
                                <h3 className="text-sm font-bold text-gray-400 uppercase tracking-widest px-2">Base de conhecimento</h3>
                                <nav className="space-y-1">
                                    {categories.map((cat) => (
                                        <button
                                            key={cat.id}
                                            onClick={() => setSelectedCategory(cat.id === selectedCategory ? null : cat.id)}
                                            className={cx(
                                                "w-full flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all font-semibold text-sm",
                                                selectedCategory === cat.id
                                                    ? "bg-brand-50 text-brand-700 shadow-sm ring-1 ring-brand-100"
                                                    : "text-gray-600 hover:bg-gray-50 hover:text-gray-900"
                                            )}
                                        >
                                            <cat.icon className={cx("size-4", selectedCategory === cat.id ? "text-brand-600" : "text-gray-400")} />
                                            {cat.title}
                                        </button>
                                    ))}
                                </nav>
                            </div>

                            <Card className="bg-gray-900 text-white border-none overflow-hidden relative">
                                <div className="absolute top-0 right-0 p-4 opacity-10">
                                    <MessageSquare className="size-20" />
                                </div>
                                <CardContent className="p-6 space-y-4 relative z-10">
                                    <h4 className="font-bold text-lg leading-tight">Não encontrou o que procurava?</h4>
                                    <p className="text-gray-400 text-sm">Nossa equipe de suporte pode ajudar com suas dúvidas.</p>
                                    <Button
                                        className="w-full bg-white text-gray-900 hover:bg-gray-100 border-none transition-transform hover:-translate-y-1"
                                        onClick={onContactSupport}
                                    >
                                        Falar com suporte
                                    </Button>
                                </CardContent>
                            </Card>
                        </aside>

                        {/* Article List */}
                        <main className="lg:col-span-3 space-y-8">
                            {selectedCategory && (
                                <div className="flex items-center gap-2 text-sm">
                                    <button onClick={() => setSelectedCategory(null)} className="text-gray-400 hover:text-gray-900 transition-colors">Todos os artigos</button>
                                    <ChevronRight className="size-4 text-gray-300" />
                                    <span className="font-bold text-gray-900">{categories.find(c => c.id === selectedCategory)?.title}</span>
                                </div>
                            )}

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                {filteredArticles.length > 0 ? (
                                    filteredArticles.map((article) => (
                                        <ArticleCard key={article.id} article={article} onClick={() => setSelectedArticleId(article.id)} />
                                    ))
                                ) : (
                                    <div className="col-span-full py-20 text-center border-2 border-dashed border-gray-100 rounded-3xl">
                                        <Search className="size-12 text-gray-200 mx-auto mb-4" />
                                        <h3 className="text-lg font-bold text-gray-900">Nenhum resultado encontrado</h3>
                                        <p className="text-gray-500">Tente ajustar a busca ou os filtros.</p>
                                    </div>
                                )}
                            </div>

                            {/* Popular Resources */}
                            <div className="pt-12 border-t border-gray-100">
                                <div className="flex items-center justify-between mb-6">
                                    <h2 className="text-xl font-bold text-gray-900">Recursos populares</h2>
                                    <Button variant="tertiary" className="text-brand-700 font-bold group">
                                        Ver toda a documentação <ArrowRight className="size-4 ml-2 group-hover:translate-x-1 transition-transform" />
                                    </Button>
                                </div>
                                <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
                                    <ResourceLink title="Guia de uso" icon={ExternalLink} />
                                    <ResourceLink title="Atualizações" icon={ChevronRight} />
                                    <ResourceLink title="Tutoriais em vídeo" icon={ExternalLink} />
                                </div>
                            </div>
                        </main>
                    </div>
                </>
            )}
        </div>
    );
};

const ArticleView = ({ article, onBack }: { article: Article, onBack: () => void }) => (
    <div className="max-w-4xl mx-auto space-y-12 animate-in fade-in slide-in-from-bottom-4 duration-500">
        <div className="space-y-6">
            <button onClick={onBack} className="flex items-center gap-2 text-sm font-bold text-gray-500 hover:text-gray-900 transition-colors group">
                <ArrowRight className="size-4 rotate-180 group-hover:-translate-x-1 transition-transform" /> Voltar para a base de conhecimento
            </button>
            <div className="space-y-4">
                <div className="flex items-center gap-2 text-sm font-bold text-brand-700 uppercase tracking-widest">
                    <Book className="size-4" /> {article.category.replace("-", " ")}
                </div>
                <h1 className="text-display-md font-bold text-gray-900 leading-tight">{article.title}</h1>
                <p className="text-xl text-gray-500 leading-relaxed">{article.description}</p>
            </div>
        </div>

        <div className="prose prose-brand max-w-none">
            <div className="p-8 bg-gray-50 rounded-3xl border border-gray-100 space-y-6">
                <h3 className="text-xl font-bold text-gray-900">Neste artigo</h3>
                <ul className="space-y-3">
                    <li><a href="#" className="text-brand-700 font-semibold hover:underline">Pré-requisitos</a></li>
                    <li><a href="#" className="text-brand-700 font-semibold hover:underline">Configuração inicial</a></li>
                    <li><a href="#" className="text-brand-700 font-semibold hover:underline">Solução de problemas comuns</a></li>
                </ul>
            </div>

            <div className="py-12 space-y-8 text-gray-700 leading-7">
                <p>Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat.</p>
                <h2 className="text-2xl font-bold text-gray-900 pt-4">Passo 1: configuração inicial</h2>
                <p>Duis aute irure dolor in reprehenderit in voluptate velit esse cillum dolore eu fugiat nulla pariatur. Excepteur sint occaecat cupidatat non proident, sunt in culpa qui officia deserunt mollit anim id est laborum.</p>
                <div className="bg-brand-50 border-l-4 border-brand-600 p-6 rounded-r-2xl">
                    <p className="font-semibold text-brand-900 text-sm uppercase tracking-wide mb-2">Dica</p>
                    <p className="text-brand-800 italic">Mantenha seus dados atualizados antes de fazer alterações importantes.</p>
                </div>
                <p>Sed ut perspiciatis unde omnis iste natus error sit voluptatem accusantium doloremque laudantium, totam rem aperiam, eaque ipsa quae ab illo inventore veritatis et quasi architecto beatae vitae dicta sunt explicabo.</p>
            </div>
        </div>

        <div className="pt-12 border-t border-gray-100 flex flex-col sm:flex-row sm:items-center justify-between gap-8">
            <div className="space-y-1">
                <h4 className="font-bold text-gray-900">Este artigo foi útil?</h4>
                <p className="text-sm text-gray-500">Seu feedback ajuda a melhorar a documentação.</p>
            </div>
            <div className="flex items-center gap-3">
                <Button variant="secondary" className="px-6">Sim, obrigado!</Button>
                <Button variant="secondary" className="px-6 text-gray-500">Não muito</Button>
            </div>
        </div>
    </div>
);

const ArticleCard = ({ article, onClick }: { article: Article, onClick: () => void }) => (
    <Card className="group hover:border-brand-300 hover:shadow-lg transition-all cursor-pointer" onClick={onClick}>
        <CardContent className="p-6 space-y-3">
            <h4 className="font-bold text-gray-900 group-hover:text-brand-700 transition-colors">{article.title}</h4>
            <p className="text-sm text-gray-500 line-clamp-2 leading-relaxed">{article.description}</p>
            <div className="pt-2 flex items-center text-xs font-bold text-brand-700 uppercase tracking-widest opacity-0 group-hover:opacity-100 transition-all transform translate-x-[-10px] group-hover:translate-x-0">
                Ler artigo <ChevronRight className="size-3.5 ml-1" />
            </div>
        </CardContent>
    </Card>
);

const ResourceLink = ({ title, icon: Icon }: { title: string, icon: any }) => (
    <div className="p-4 rounded-xl border border-gray-100 hover:border-gray-200 hover:bg-gray-50 transition-all flex items-center justify-between group cursor-pointer">
        <span className="font-semibold text-gray-700 group-hover:text-gray-900">{title}</span>
        <Icon className="size-4 text-gray-400 group-hover:text-brand-600 transition-colors" />
    </div>
);
