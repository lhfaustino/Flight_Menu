"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Avatar } from "@/components/ui/Avatar";
import { Button } from "@/components/ui/Button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { TextArea } from "@/components/ui/Textarea";
import { useToast } from "@/components/ui/Toast";
import { deleteMyProfileAvatar, getMyProfile, updateMyProfile, uploadMyProfileAvatar } from "@/app/actions/profiles";
import { createTelegramConnectionLink, disconnectTelegram, getTelegramConnectionStatus } from "@/app/actions/telegram";
import { createClient } from "@/lib/supabase/client";
import { Copy, ExternalLink, RefreshCw, Send, Unlink } from "lucide-react";

const splitFullName = (fullName: string) => {
    const parts = fullName.trim().split(/\s+/).filter(Boolean);
    return {
        firstName: parts[0] ?? "",
        lastName: parts.slice(1).join(" "),
    };
};

export const ProfileSettingsPage = () => {
    const { addToast } = useToast();
    const router = useRouter();
    const fileInputRef = React.useRef<HTMLInputElement>(null);
    const [initialValues, setInitialValues] = React.useState({
        firstName: "",
        lastName: "",
        email: "",
        bio: "",
        avatarUrl: "",
        isTelegramConnected: false,
    });
    const [formData, setFormData] = React.useState(initialValues);
    const [isLoading, setIsLoading] = React.useState(true);
    const [isSaving, setIsSaving] = React.useState(false);
    const [isAvatarBusy, setIsAvatarBusy] = React.useState(false);
    const [isTelegramBusy, setIsTelegramBusy] = React.useState(false);
    const [telegramCommand, setTelegramCommand] = React.useState("");

    React.useEffect(() => {
        let isMounted = true;

        async function loadProfile() {
            const response = await getMyProfile();

            if (!isMounted) return;

            if (response.success && response.data) {
                const { firstName, lastName } = splitFullName(response.data.full_name ?? "");
                const nextValues = {
                    firstName,
                    lastName,
                    email: response.data.email ?? "",
                    bio: response.data.bio ?? "",
                    avatarUrl: response.data.avatar_url ?? "",
                    isTelegramConnected: Boolean(response.data.telegram_chat_id),
                };

                setInitialValues(nextValues);
                setFormData(nextValues);
            } else if (!response.success) {
                addToast({
                    title: "Não foi possível carregar o perfil",
                    description: response.error,
                    type: "error",
                });
            }

            setIsLoading(false);
        }

        loadProfile();

        return () => {
            isMounted = false;
        };
    }, [addToast]);

    const fullName = `${formData.firstName} ${formData.lastName}`.trim();

    const refreshProfileSession = React.useCallback(async () => {
        const supabase = createClient();
        await supabase.auth.refreshSession();
        router.refresh();
    }, [router]);

    const handleSave = async (event: React.FormEvent) => {
        event.preventDefault();

        if (fullName.length < 2) {
            addToast({
                title: "Erro de validação",
                description: "Informe seu nome antes de salvar.",
                type: "error",
            });
            return;
        }

        setIsSaving(true);

        const result = await updateMyProfile({
            full_name: fullName,
            email: formData.email,
            bio: formData.bio,
            avatar_url: formData.avatarUrl,
        });

        setIsSaving(false);

        if (result.success) {
            const { firstName, lastName } = splitFullName(result.data.full_name ?? "");
            const nextValues = {
                firstName,
                lastName,
                email: result.data.email ?? formData.email,
                bio: result.data.bio ?? "",
                avatarUrl: result.data.avatar_url ?? "",
                isTelegramConnected: formData.isTelegramConnected,
            };

            setInitialValues(nextValues);
            setFormData(nextValues);
            addToast({
                title: "Perfil atualizado",
                description: "Seus dados foram salvos.",
                type: "success",
            });
            await refreshProfileSession();
        } else {
            addToast({
                title: "Não foi possível salvar o perfil",
                description: result.error,
                type: "error",
            });
        }
    };

    const handleAvatarChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        event.target.value = "";

        if (!file) return;

        const uploadForm = new FormData();
        uploadForm.append("avatar", file);
        setIsAvatarBusy(true);

        const result = await uploadMyProfileAvatar(uploadForm);

        setIsAvatarBusy(false);

        if (result.success) {
            const avatarUrl = result.data.avatar_url ?? "";
            setFormData(prev => ({ ...prev, avatarUrl }));
            setInitialValues(prev => ({ ...prev, avatarUrl }));
            addToast({
                title: "Foto atualizada",
                description: "Sua nova foto de perfil está ativa.",
                type: "success",
            });
            await refreshProfileSession();
        } else {
            addToast({
                title: "Não foi possível atualizar a foto",
                description: result.error,
                type: "error",
            });
        }
    };

    const handleDeleteAvatar = async () => {
        setIsAvatarBusy(true);

        const result = await deleteMyProfileAvatar();

        setIsAvatarBusy(false);

        if (result.success) {
            setFormData(prev => ({ ...prev, avatarUrl: "" }));
            setInitialValues(prev => ({ ...prev, avatarUrl: "" }));
            addToast({
                title: "Foto removida",
                description: "Sua foto de perfil foi removida.",
                type: "success",
            });
            await refreshProfileSession();
        } else {
            addToast({
                title: "Não foi possível remover a foto",
                description: result.error,
                type: "error",
            });
        }
    };

    const handleCancel = () => {
        setFormData(initialValues);
    };

    const handleConnectTelegram = async () => {
        setIsTelegramBusy(true);

        const result = await createTelegramConnectionLink();

        setIsTelegramBusy(false);

        if (result.success && result.botUrl) {
            setTelegramCommand(result.connectionCommand ?? "");
            window.open(result.botUrl, "_blank", "noopener,noreferrer");
            addToast({
                title: "Telegram aberto",
                description: "Toque em Start no Telegram. Se ele enviar apenas /start, copie o comando exibido aqui.",
                type: "success",
            });
        } else {
            addToast({
                title: "Não foi possível conectar o Telegram",
                description: result.error,
                type: "error",
            });
        }
    };

    const handleCheckTelegram = async () => {
        setIsTelegramBusy(true);

        const result = await getTelegramConnectionStatus();

        setIsTelegramBusy(false);

        if (result.success) {
            const isConnected = Boolean(result.connected);
            setFormData(prev => ({ ...prev, isTelegramConnected: isConnected }));
            setInitialValues(prev => ({ ...prev, isTelegramConnected: isConnected }));
            if (isConnected) setTelegramCommand("");
            addToast({
                title: isConnected ? "Telegram conectado" : "Telegram ainda não conectado",
                description: isConnected ? "Sua conta do Telegram está pronta." : "Toque em Start no Telegram e verifique novamente.",
                type: isConnected ? "success" : "error",
            });
        } else {
            addToast({
                title: "Não foi possível verificar o Telegram",
                description: result.error,
                type: "error",
            });
        }
    };

    const handleDisconnectTelegram = async () => {
        setIsTelegramBusy(true);

        const result = await disconnectTelegram();

        setIsTelegramBusy(false);

        if (result.success) {
            setFormData(prev => ({ ...prev, isTelegramConnected: false }));
            setInitialValues(prev => ({ ...prev, isTelegramConnected: false }));
            setTelegramCommand("");
            addToast({
                title: "Telegram desconectado",
                description: "Os envios pelo Telegram foram desativados para sua conta.",
                type: "success",
            });
        } else {
            addToast({
                title: "Não foi possível desconectar o Telegram",
                description: result.error,
                type: "error",
            });
        }
    };

    const handleCopyTelegramCommand = async () => {
        if (!telegramCommand) return;

        await navigator.clipboard.writeText(telegramCommand);
        addToast({
            title: "Comando copiado",
            description: "Cole no chat do bot no Telegram.",
            type: "success",
        });
    };

    if (isLoading) {
        return (
            <Card>
                <CardHeader>
                    <CardTitle>Informações pessoais</CardTitle>
                    <CardDescription>Carregando seus dados de perfil...</CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                    <div className="h-20 w-20 animate-pulse rounded-full bg-gray-100" />
                    <div className="grid gap-6 sm:grid-cols-2">
                        <div className="h-16 animate-pulse rounded-lg bg-gray-100" />
                        <div className="h-16 animate-pulse rounded-lg bg-gray-100" />
                    </div>
                    <div className="h-16 animate-pulse rounded-lg bg-gray-100" />
                </CardContent>
            </Card>
        );
    }

    return (
        <form onSubmit={handleSave} className="space-y-6">
            <Card>
                <CardHeader>
                    <CardTitle>Informações pessoais</CardTitle>
                    <CardDescription>Atualize sua foto e seus dados pessoais.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                    {/* Avatar Section */}
                    <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:gap-6">
                        <Avatar
                            src={formData.avatarUrl}
                            alt={fullName || "Foto de perfil"}
                            size="xl"
                        />
                        <div className="space-y-2">
                            <input
                                ref={fileInputRef}
                                type="file"
                                accept="image/jpeg,image/png,image/gif,image/webp"
                                className="hidden"
                                onChange={handleAvatarChange}
                            />
                            <div className="flex gap-2">
                                <Button
                                    type="button"
                                    variant="secondary"
                                    size="sm"
                                    isDisabled={isAvatarBusy}
                                    onPress={() => fileInputRef.current?.click()}
                                >
                                    {isAvatarBusy ? "Enviando..." : "Alterar foto"}
                                </Button>
                                <Button
                                    type="button"
                                    variant="tertiary"
                                    size="sm"
                                    isDisabled={isAvatarBusy || !formData.avatarUrl}
                                    onPress={handleDeleteAvatar}
                                    className="text-error-700 hover:text-error-800"
                                >
                                    Remover
                                </Button>
                            </div>
                            <p className="text-xs text-gray-500">JPG, GIF, PNG ou WebP. Máximo de 1MB.</p>
                        </div>
                    </div>

                    <div className="grid gap-6 sm:grid-cols-2">
                        <Input
                            label="Nome"
                            value={formData.firstName}
                            onChange={(event) => setFormData(prev => ({ ...prev, firstName: event.target.value }))}
                            isDisabled={isSaving}
                            required
                        />
                        <Input
                            label="Sobrenome"
                            value={formData.lastName}
                            onChange={(event) => setFormData(prev => ({ ...prev, lastName: event.target.value }))}
                            isDisabled={isSaving}
                        />
                    </div>

                    <Input
                        label="E-mail"
                        type="email"
                        value={formData.email}
                        onChange={(event) => setFormData(prev => ({ ...prev, email: event.target.value }))}
                        isDisabled={isSaving}
                        required
                    />

                    <div className="rounded-lg border border-gray-200 bg-gray-50 p-4">
                        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                            <div>
                                <p className="text-sm font-semibold text-gray-900">Telegram</p>
                                <p className="mt-1 text-sm text-gray-500">
                                    {formData.isTelegramConnected ? "Conectado" : "Não conectado"}
                                </p>
                            </div>
                            <div className="flex flex-col gap-2 sm:flex-row">
                                <Button
                                    type="button"
                                    variant="secondary"
                                    size="sm"
                                    iconLeading={formData.isTelegramConnected ? Send : ExternalLink}
                                    isDisabled={isTelegramBusy}
                                    onPress={handleConnectTelegram}
                                >
                                    {formData.isTelegramConnected ? "Reconectar" : "Conectar Telegram"}
                                </Button>
                                <Button
                                    type="button"
                                    variant="tertiary"
                                    size="sm"
                                    iconLeading={RefreshCw}
                                    isDisabled={isTelegramBusy}
                                    onPress={handleCheckTelegram}
                                >
                                    Verificar conexão
                                </Button>
                                {formData.isTelegramConnected && (
                                    <Button
                                        type="button"
                                        variant="tertiary"
                                        size="sm"
                                        iconLeading={Unlink}
                                        isDisabled={isTelegramBusy}
                                        onPress={handleDisconnectTelegram}
                                        className="text-error-700 hover:text-error-800"
                                    >
                                        Desconectar
                                    </Button>
                                )}
                            </div>
                        </div>
                        {telegramCommand && !formData.isTelegramConnected && (
                            <div className="mt-4 rounded-lg border border-gray-200 bg-white p-3">
                                <p className="text-xs font-medium text-gray-700">Comando alternativo</p>
                                <div className="mt-2 flex flex-col gap-2 sm:flex-row sm:items-center">
                                    <code className="min-w-0 flex-1 overflow-x-auto rounded-md bg-gray-100 px-3 py-2 text-xs text-gray-900">
                                        {telegramCommand}
                                    </code>
                                    <Button
                                        type="button"
                                        variant="secondary"
                                        size="sm"
                                        iconLeading={Copy}
                                        onPress={handleCopyTelegramCommand}
                                    >
                                        Copiar
                                    </Button>
                                </div>
                            </div>
                        )}
                    </div>

                    <div className="space-y-1.5">
                        <label className="text-sm font-medium text-gray-700">Bio</label>
                        <TextArea
                            placeholder="Escreva uma breve apresentação..."
                            value={formData.bio}
                            onChange={(value) => setFormData(prev => ({ ...prev, bio: value }))}
                            isDisabled={isSaving}
                            rows={4}
                        />
                        <p className="text-xs text-gray-500">Breve descrição para seu perfil. URLs viram links automaticamente.</p>
                    </div>
                </CardContent>
                <CardFooter className="flex justify-end gap-3 border-t border-gray-200 px-6 py-4">
                    <Button type="button" variant="secondary" isDisabled={isSaving} onPress={handleCancel}>
                        Cancelar
                    </Button>
                    <Button type="submit" isDisabled={isSaving || isAvatarBusy}>
                        {isSaving ? "Salvando..." : "Salvar alterações"}
                    </Button>
                </CardFooter>
            </Card>
        </form>
    );
};
