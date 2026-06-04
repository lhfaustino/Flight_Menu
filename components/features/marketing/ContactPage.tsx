"use client";

import { Mail, MapPin, Phone, MessageSquare, Twitter, Github, Linkedin } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { TextArea } from "@/components/ui/Textarea";

export const ContactPage = () => {
    return (
        <div className="bg-white">
            <div className="mx-auto max-w-7xl px-4 py-24 sm:px-6 lg:px-8">
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-16">
                    {/* Left - Contact Info */}
                    <div>
                        <h2 className="text-brand-600 font-semibold mb-2">Contato</h2>
                        <h3 className="text-4xl font-bold text-gray-900 mb-6">Fale com nossa equipe</h3>
                        <p className="text-lg text-gray-500 mb-12">
                            Tem dúvidas sobre o Flight Menu? Envie uma mensagem e retornaremos em breve.
                        </p>

                        <div className="space-y-8">
                            <ContactItem
                                icon={Mail}
                                title="E-mail"
                                description="Nossa equipe está pronta para ajudar."
                                detail="suporte@flightmenu.com"
                            />
                            <ContactItem
                                icon={MessageSquare}
                                title="Chat"
                                description="Disponível de segunda a sexta."
                                detail="Iniciar conversa"
                                isLink
                            />
                            <ContactItem
                                icon={MapPin}
                                title="Escritório"
                                description="Atendimento remoto para usuários no Brasil."
                                detail="Brasil"
                            />
                            <ContactItem
                                icon={Phone}
                                title="Telefone"
                                description="Segunda a sexta, das 9h às 17h."
                                detail="+1 (555) 000-0000"
                            />
                        </div>

                        {/* Socials */}
                        <div className="mt-12">
                            <h4 className="text-sm font-semibold text-gray-900 uppercase tracking-wider mb-4 text-brand-600">Siga-nos</h4>
                            <div className="flex gap-4">
                                <SocialLink icon={Twitter} href="#" />
                                <SocialLink icon={Github} href="#" />
                                <SocialLink icon={Linkedin} href="#" />
                            </div>
                        </div>
                    </div>

                    {/* Right - Contact Form */}
                    <div className="bg-gray-50 p-8 rounded-2xl border border-gray-100 lg:p-12">
                        <form className="space-y-6">
                            <div className="grid gap-6 sm:grid-cols-2">
                                <Input label="Nome" placeholder="Nome" required />
                                <Input label="Sobrenome" placeholder="Sobrenome" required />
                            </div>
                            <Input label="E-mail" type="email" placeholder="voce@email.com" required />
                            <Input label="Telefone (opcional)" type="tel" placeholder="+55 11 99999-9999" />

                            <div className="space-y-1.5">
                                <label className="text-sm font-medium text-gray-700">Mensagem</label>
                                <TextArea
                                    placeholder="Deixe sua mensagem..."
                                    rows={5}
                                    isRequired
                                />
                            </div>

                            <Button size="lg" className="w-full justify-center h-12">
                                Enviar mensagem
                            </Button>
                        </form>
                    </div>
                </div>
            </div>
        </div>
    );
};

const ContactItem = ({ icon: Icon, title, description, detail, isLink }: { icon: any, title: string, description: string, detail: string, isLink?: boolean }) => (
    <div className="flex gap-4">
        <div className="flex-shrink-0 size-12 rounded-lg bg-brand-50 flex items-center justify-center">
            <Icon className="h-6 w-6 text-brand-600" />
        </div>
        <div>
            <h4 className="text-lg font-bold text-gray-900 mb-1">{title}</h4>
            <p className="text-sm text-gray-500 mb-2">{description}</p>
            {isLink ? (
                <a href="#" className="text-sm font-bold text-brand-600 hover:text-brand-700">{detail}</a>
            ) : (
                <p className="text-sm font-bold text-gray-900">{detail}</p>
            )}
        </div>
    </div>
);

const SocialLink = ({ icon: Icon, href }: { icon: any, href: string }) => (
    <a
        href={href}
        className="size-10 rounded-lg border border-gray-200 flex items-center justify-center text-gray-500 hover:text-brand-600 hover:border-brand-600 transition-colors"
    >
        <Icon className="h-5 w-5" />
    </a>
);
