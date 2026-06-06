"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { UntitledUiLogo } from "@/components/ui/logos";
import { SocialIcon } from "@/components/ui/social-icons";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { createOrganization } from "@/app/actions/organizations";
import { useToast } from "@/components/ui/Toast";
import { AUTH_CONFIG } from "@/lib/constants";

export const SignUpPage = () => {
    const router = useRouter();
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const { addToast } = useToast();
    const [formData, setFormData] = useState({
        fullName: "",
        email: "",
        password: "",
    });

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        setFormData(prev => ({
            ...prev,
            [e.target.name]: e.target.value
        }));
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsLoading(true);
        setError(null);

        const supabase = createClient();

        try {
            // 1. Sign up user
            const { data: authData, error: signUpError } = await supabase.auth.signUp({
                email: formData.email,
                password: formData.password,
                options: {
                    data: {
                        full_name: formData.fullName,
                    },
                    emailRedirectTo: `${window.location.origin}/auth/callback`,
                },
            });

            if (signUpError) throw signUpError;

            if (authData.user) {
                if (!authData.session) {
                    const { error: signInError } = await supabase.auth.signInWithPassword({
                        email: formData.email,
                        password: formData.password,
                    });

                    if (signInError) {
                        throw new Error(
                            "Cadastro criado, mas o Supabase ainda esta exigindo confirmacao por e-mail. Desative a confirmacao de e-mail no Supabase Auth e tente entrar novamente."
                        );
                    }
                }

                // 2. Create a default organization for the new user
                // We do this via server action to ensure membership is created correctly
                const orgName = `Equipe de ${formData.fullName}`;
                const orgSlug = formData.fullName.toLowerCase().replace(/\s+/g, '-') + '-' + Math.random().toString(36).substring(2, 7);

                const orgResult = await createOrganization(orgName, orgSlug);
                if (!orgResult.success) throw new Error(orgResult.error);

                addToast({
                    title: "Conta criada!",
                    description: "Sua conta está pronta.",
                    type: "success",
                });

                router.push(AUTH_CONFIG.afterLoginPath);
            }
        } catch (err: any) {
            const errorMessage = err.message || "Algo deu errado. Tente novamente.";
            setError(errorMessage);
            addToast({
                title: "Falha no cadastro",
                description: errorMessage,
                type: "error",
            });
        } finally {
            setIsLoading(false);
        }
    };

    const handleSocialLogin = async (provider: 'google' | 'facebook' | 'twitter') => {
        const supabase = createClient();
        await supabase.auth.signInWithOAuth({
            provider,
            options: {
                redirectTo: `${window.location.origin}/auth/callback`,
            },
        });
    };

    return (
        <div className="flex min-h-screen bg-white">
            {/* Left Section - Form */}
            <div className="flex flex-1 flex-col justify-center px-4 py-12 sm:px-6 lg:flex-none lg:px-20 xl:px-24">
                <div className="mx-auto w-full max-w-sm lg:w-96">
                    <div>
                        <UntitledUiLogo className="h-8 w-auto text-brand-600" />
                        <h2 className="mt-6 text-3xl font-bold tracking-tight text-gray-900">Criar conta</h2>
                        <p className="mt-2 text-sm text-gray-600">
                            Já tem uma conta?{" "}
                            <a href="/login" className="font-medium text-brand-600 hover:text-brand-500">
                                Entrar
                            </a>
                        </p>
                    </div>

                    <div className="mt-8">
                        <div className="mt-6">
                            {error && (
                                <div className="mb-4 rounded-md bg-red-50 p-4">
                                    <p className="text-sm text-red-700">{error}</p>
                                </div>
                            )}

                            <form onSubmit={handleSubmit} method="POST" className="space-y-6">
                                <Input
                                    label="Nome completo"
                                    name="fullName"
                                    type="text"
                                    placeholder="Digite seu nome"
                                    value={formData.fullName}
                                    onChange={handleChange}
                                    required
                                />

                                <Input
                                    label="E-mail"
                                    name="email"
                                    type="email"
                                    placeholder="Digite seu e-mail"
                                    value={formData.email}
                                    onChange={handleChange}
                                    required
                                />

                                <Input
                                    label="Senha"
                                    name="password"
                                    type="password"
                                    placeholder="Crie uma senha"
                                    helperText="Deve ter pelo menos 8 caracteres."
                                    value={formData.password}
                                    onChange={handleChange}
                                    required
                                />

                                <div>
                                    <Button
                                        type="submit"
                                        className="w-full justify-center"
                                        isDisabled={isLoading}
                                    >
                                        {isLoading ? "Criando conta..." : "Começar"}
                                    </Button>
                                </div>
                            </form>
                        </div>

                        <div className="mt-6">
                            <div className="relative">
                                <div className="absolute inset-0 flex items-center">
                                    <div className="w-full border-t border-gray-200" />
                                </div>
                                <div className="relative flex justify-center text-sm">
                                    <span className="bg-white px-2 text-gray-500">Ou cadastre-se com</span>
                                </div>
                            </div>

                            <div className="mt-6 grid grid-cols-3 gap-3">
                                <div>
                                    <Button variant="secondary" className="w-full justify-center" onClick={() => handleSocialLogin('google')}>
                                        <SocialIcon type="google" className="h-5 w-5" />
                                        <span className="sr-only">Cadastrar com Google</span>
                                    </Button>
                                </div>
                                <div>
                                    <Button variant="secondary" className="w-full justify-center" onClick={() => handleSocialLogin('facebook')}>
                                        <SocialIcon type="facebook" className="h-5 w-5" />
                                        <span className="sr-only">Cadastrar com Facebook</span>
                                    </Button>
                                </div>
                                <div>
                                    <Button variant="secondary" className="w-full justify-center" onClick={() => handleSocialLogin('twitter')}>
                                        <SocialIcon type="twitter" className="h-5 w-5" />
                                        <span className="sr-only">Cadastrar com Twitter</span>
                                    </Button>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Right Section - Image/Branding */}
            <div className="relative hidden w-0 flex-1 lg:block">
                <img
                    className="absolute inset-0 h-full w-full object-cover"
                    src="https://images.unsplash.com/photo-1557804506-669a67965ba0?ixlib=rb-1.2.1&auto=format&fit=crop&w=1567&q=80"
                    alt="Imagem de fundo"
                />
                <div className="absolute inset-0 bg-gray-900/10 mix-blend-multiply" />
            </div>
        </div>
    );
};
