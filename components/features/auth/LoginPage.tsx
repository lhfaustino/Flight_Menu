"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { BrandLogo } from "@/components/ui/BrandLogo";
import { SocialIcon } from "@/components/ui/social-icons";
import { Button } from "@/components/ui/Button";
import { Checkbox } from "@/components/ui/Checkbox";
import { Input } from "@/components/ui/Input";
import { useToast } from "@/components/ui/Toast";
import { AUTH_CONFIG } from "@/lib/constants";

export const LoginPage = () => {
    const router = useRouter();
    const [isLoading, setIsLoading] = useState(false);
    const [socialProvider, setSocialProvider] = useState<"google" | "apple" | null>(null);
    const [error, setError] = useState<string | null>(null);
    const { addToast } = useToast();
    const [formData, setFormData] = useState({
        email: "",
        password: "",
        remember: false,
    });

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const { name, value, type, checked } = e.target;
        setFormData(prev => ({
            ...prev,
            [name]: type === 'checkbox' ? checked : value
        }));
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsLoading(true);
        setError(null);

        const supabase = createClient();

        try {
            const { error: signInError } = await supabase.auth.signInWithPassword({
                email: formData.email,
                password: formData.password,
            });

            if (signInError) throw signInError;

            addToast({
                title: "Bem-vindo de volta!",
                description: "Login realizado com sucesso.",
                type: "success",
            });

            router.push(AUTH_CONFIG.afterLoginPath);
            router.refresh();
        } catch (err: any) {
            const errorMessage = err.message || "E-mail ou senha inválidos.";
            setError(errorMessage);
            addToast({
                title: "Falha no login",
                description: errorMessage,
                type: "error",
            });
        } finally {
            setIsLoading(false);
        }
    };

    const handleSocialLogin = async (provider: "google" | "apple") => {
        setError(null);
        setSocialProvider(provider);
        const supabase = createClient();

        const { error: oauthError } = await supabase.auth.signInWithOAuth({
            provider,
            options: {
                redirectTo: `${window.location.origin}/auth/callback`,
                queryParams: provider === "google"
                    ? {
                        access_type: "offline",
                        prompt: "consent",
                    }
                    : undefined,
            },
        });

        if (oauthError) {
            const errorMessage = oauthError.message || "Não foi possível iniciar o login social.";
            setError(errorMessage);
            setSocialProvider(null);
            addToast({
                title: "Falha no login social",
                description: errorMessage,
                type: "error",
            });
        }
    };

    return (
        <div className="flex min-h-screen bg-white">
            {/* Left Section - Form */}
            <div className="flex flex-1 flex-col justify-center px-4 py-12 sm:px-6 lg:flex-none lg:px-20 xl:px-24">
                <div className="mx-auto w-full max-w-sm lg:w-96">
                    <div>
                        <BrandLogo href="/" size="md" />
                        <h2 className="mt-6 text-3xl font-bold tracking-tight text-gray-900">Entre na sua conta</h2>
                        <p className="mt-2 text-sm text-gray-600">
                            Ou{" "}
                            <a href="/signup" className="font-medium text-brand-600 hover:text-brand-500">
                                crie sua conta
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
                                    placeholder="••••••••"
                                    value={formData.password}
                                    onChange={handleChange}
                                    required
                                />

                                <div className="flex items-center justify-between">
                                    <Checkbox
                                        size="sm"
                                        name="remember"
                                        isSelected={formData.remember}
                                        onChange={(isSelected) => setFormData(prev => ({ ...prev, remember: isSelected }))}
                                        label="Lembrar por 30 dias"
                                    />
                                </div>

                                <div>
                                    <Button
                                        type="submit"
                                        className="w-full justify-center"
                                        isDisabled={isLoading}
                                    >
                                        {isLoading ? "Entrando..." : "Entrar"}
                                    </Button>
                                </div>
                            </form>

                            <div className="mt-4 text-center text-sm">
                                <Link href="/forgot-password" className="font-medium text-brand-600 hover:text-brand-500">
                                    Esqueceu a senha?
                                </Link>
                            </div>
                        </div>

                        <div className="mt-6">
                            <div className="relative">
                                <div className="absolute inset-0 flex items-center">
                                    <div className="w-full border-t border-gray-200" />
                                </div>
                                <div className="relative flex justify-center text-sm">
                                    <span className="bg-white px-2 text-gray-500">Ou entre com</span>
                                </div>
                            </div>

                            <div className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-2">
                                <Button
                                    variant="secondary"
                                    className="w-full justify-center gap-2"
                                    onClick={() => handleSocialLogin("google")}
                                    isDisabled={socialProvider !== null}
                                >
                                    <SocialIcon type="google" className="h-5 w-5" />
                                    <span>{socialProvider === "google" ? "Conectando..." : "Google"}</span>
                                </Button>
                                <Button
                                    variant="secondary"
                                    className="w-full justify-center gap-2"
                                    onClick={() => handleSocialLogin("apple")}
                                    isDisabled={socialProvider !== null}
                                >
                                    <SocialIcon type="apple" className="h-5 w-5" />
                                    <span>{socialProvider === "apple" ? "Conectando..." : "Apple"}</span>
                                </Button>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Right Section - Image/Branding */}
            <div className="relative hidden w-0 flex-1 lg:block">
                <img
                    className="absolute inset-0 h-full w-full object-cover"
                    src="https://images.unsplash.com/photo-1496917756835-20cb06e75b4e?ixlib=rb-1.2.1&ixid=eyJhcHBfaWQiOjEyMDd9&auto=format&fit=crop&w=1908&q=80"
                    alt="Imagem de fundo"
                />
                <div className="absolute inset-0 bg-gray-900/10 mix-blend-multiply" />
            </div>
        </div>
    );
};
