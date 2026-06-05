"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, KeyRound } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { UntitledUiLogo } from "@/components/ui/logos";
import { useToast } from "@/components/ui/Toast";
import { AUTH_CONFIG } from "@/lib/constants";
import { createClient } from "@/lib/supabase/client";

type LinkStatus = "checking" | "ready" | "invalid";

export const UpdatePasswordPage = () => {
    const router = useRouter();
    const { addToast } = useToast();
    const [linkStatus, setLinkStatus] = useState<LinkStatus>("checking");
    const [password, setPassword] = useState("");
    const [confirmPassword, setConfirmPassword] = useState("");
    const [error, setError] = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState(false);

    useEffect(() => {
        const establishRecoverySession = async () => {
            const supabase = createClient();
            const url = new URL(window.location.href);
            const hashParams = new URLSearchParams(url.hash.replace(/^#/, ""));
            const code = url.searchParams.get("code");
            const accessToken = hashParams.get("access_token");
            const refreshToken = hashParams.get("refresh_token");

            try {
                if (code) {
                    const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);
                    if (exchangeError) throw exchangeError;
                } else if (accessToken && refreshToken) {
                    const { error: sessionError } = await supabase.auth.setSession({
                        access_token: accessToken,
                        refresh_token: refreshToken,
                    });
                    if (sessionError) throw sessionError;
                } else {
                    const {
                        data: { session },
                    } = await supabase.auth.getSession();

                    if (!session) {
                        setLinkStatus("invalid");
                        return;
                    }
                }

                window.history.replaceState({}, document.title, "/auth/update-password");
                setLinkStatus("ready");
            } catch (sessionError: any) {
                setError(sessionError.message || "Este link de recuperação é inválido ou expirou.");
                setLinkStatus("invalid");
            }
        };

        establishRecoverySession();
    }, []);

    const handleSubmit = async (event: React.FormEvent) => {
        event.preventDefault();
        setError(null);

        if (password.length < 6) {
            setError("A senha deve ter pelo menos 6 caracteres.");
            return;
        }

        if (password !== confirmPassword) {
            setError("As senhas não conferem.");
            return;
        }

        setIsLoading(true);

        try {
            const supabase = createClient();
            const { error: updateError } = await supabase.auth.updateUser({ password });

            if (updateError) throw updateError;

            addToast({
                title: "Senha atualizada",
                description: "Agora você pode entrar com sua nova senha.",
                type: "success",
            });

            router.push(AUTH_CONFIG.loginPath);
            router.refresh();
        } catch (updateError: any) {
            setError(updateError.message || "Não foi possível atualizar sua senha.");
            addToast({
                title: "Falha ao atualizar a senha",
                description: updateError.message || "Solicite um novo e-mail de recuperação de senha.",
                type: "error",
            });
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="flex min-h-screen flex-col justify-center bg-gray-50 py-12 sm:px-6 lg:px-8">
            <div className="sm:mx-auto sm:w-full sm:max-w-md">
                <div className="flex justify-center">
                    <UntitledUiLogo className="h-10 w-auto" />
                </div>
                <h2 className="mt-6 text-center text-3xl font-bold tracking-tight text-gray-900">Atualizar senha</h2>
                <p className="mt-2 text-center text-sm text-gray-600">
                    Escolha uma nova senha para sua conta Trip Space.
                </p>
            </div>

            <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
                <div className="bg-white px-4 py-8 shadow-sm sm:rounded-lg sm:px-10">
                    {linkStatus === "checking" && (
                        <div className="text-center">
                            <div className="mx-auto mb-6 flex h-12 w-12 items-center justify-center rounded-full bg-brand-50">
                                <KeyRound className="h-6 w-6 text-brand-600" />
                            </div>
                            <p className="text-sm text-gray-600">Verificando seu link de recuperação...</p>
                        </div>
                    )}

                    {linkStatus === "invalid" && (
                        <div className="text-center">
                            <div className="mx-auto mb-6 flex h-12 w-12 items-center justify-center rounded-full bg-error-50">
                                <KeyRound className="h-6 w-6 text-error-600" />
                            </div>
                            <h3 className="text-lg font-semibold text-gray-900">Link de recuperação expirado</h3>
                            <p className="mt-2 text-sm text-gray-600">
                                {error || "Solicite um novo e-mail de recuperação de senha e tente novamente."}
                            </p>
                            <Button className="mt-6 w-full justify-center" onPress={() => router.push("/forgot-password")}>
                                Solicitar novo link
                            </Button>
                        </div>
                    )}

                    {linkStatus === "ready" && (
                        <form className="space-y-6" onSubmit={handleSubmit} method="POST">
                            {error && (
                                <div className="rounded-md bg-error-50 p-4">
                                    <p className="text-sm text-error-700">{error}</p>
                                </div>
                            )}

                            <Input
                                label="Nova senha"
                                type="password"
                                autoComplete="new-password"
                                required
                                value={password}
                                onChange={(event) => setPassword(event.target.value)}
                            />

                            <Input
                                label="Confirmar senha"
                                type="password"
                                autoComplete="new-password"
                                required
                                value={confirmPassword}
                                onChange={(event) => setConfirmPassword(event.target.value)}
                            />

                            <Button type="submit" className="w-full justify-center" isDisabled={isLoading}>
                                {isLoading ? "Atualizando..." : "Atualizar senha"}
                            </Button>
                        </form>
                    )}

                    <div className="mt-6 flex justify-center">
                        <Link href="/login" className="flex items-center text-sm font-medium text-gray-600 hover:text-gray-500">
                            <ArrowLeft className="mr-2 h-4 w-4" />
                            Voltar para o login
                        </Link>
                    </div>
                </div>
            </div>
        </div>
    );
};
