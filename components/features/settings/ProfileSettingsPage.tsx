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

type UsernameStatus = "idle" | "checking" | "available" | "current" | "taken" | "invalid" | "error";

const USERNAME_LABEL = "Nome de Usu\u00e1rio";
const USERNAME_HELPER_TEXT = "Use 3 a 24 caracteres: letras, n\u00fameros ou underline.";
const USERNAME_AVAILABLE_TEXT = "Nome de Usu\u00e1rio dispon\u00edvel.";
const USERNAME_CURRENT_TEXT = "Este \u00e9 seu nome de Usu\u00e1rio atual.";
const USERNAME_TAKEN_TEXT = "Este nome de Usu\u00e1rio j\u00e1 existe.";
const USERNAME_CHECK_ERROR_TEXT = "N\u00e3o foi poss\u00edvel verificar agora. Confirme a migration de username no Supabase.";
const VALIDATION_ERROR_TITLE = "Erro de valida\u00e7\u00e3o";

export const ProfileSettingsPage = () => {
    const { addToast } = useToast();
    const router = useRouter();
    const fileInputRef = React.useRef<HTMLInputElement>(null);
    const [initialValues, setInitialValues] = React.useState({
        firstName: "",
        lastName: "",
        username: "",
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
    const [usernameStatus, setUsernameStatus] = React.useState<UsernameStatus>("idle");
    const [telegramCommand, setTelegramCommand] = React.useState("");
    const [telegramBotUrl, setTelegramBotUrl] = React.useState("");

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
                    username: response.data.username ?? "",
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
    const normalizedUsername = React.useMemo(() => normalizeUsername(formData.username), [formData.username]);
    const initialUsername = React.useMemo(() => normalizeUsername(initialValues.username), [initialValues.username]);
    const shouldValidateUsername = normalizedUsername.length > 0 || initialUsername.length > 0;
    const isUsernameReady = !shouldValidateUsername || usernameStatus === "available" || usernameStatus === "current";

    React.useEffect(() => {
        if (!formData.username) {
            setUsernameStatus("idle");
            return;
        }

        if (normalizedUsername.length < 3 || normalizedUsername.length > 24) {
            setUsernameStatus("invalid");
            return;
        }

        if (normalizedUsername === initialUsername) {
            setUsernameStatus("current");
            return;
        }

        let isCancelled = false;
        const timeoutId = window.setTimeout(async () => {
            setUsernameStatus("checking");
            const supabase = createClient();
            const { data, error } = await supabase.rpc("is_username_available", {
                candidate: normalizedUsername,
            });

            if (isCancelled) return;
            if (error) {
                setUsernameStatus("error");
                return;
            }

            setUsernameStatus(data === true ? "available" : "taken");
        }, 350);

        return () => {
            isCancelled = true;
            window.clearTimeout(timeoutId);
        };
    }, [formData.username, initialUsername, normalizedUsername]);

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

        if (!isUsernameReady) {
            addToast({
                title: VALIDATION_ERROR_TITLE,
                description: "Escolha um nome de Usu\u00e1rio dispon\u00edvel antes de salvar.",
                type: "error",
            });
            return;
        }

        setIsSaving(true);

        const result = await updateMyProfile({
            full_name: fullName,
            username: normalizedUsername,
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
                username: result.data.username ?? normalizedUsername,
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
        setTelegramBotUrl("");
        const telegramWindow = window.open("about:blank", "_blank");

        const result = await createTelegramConnectionLink();

        setIsTelegramBusy(false);

        if (result.success && result.botUrl) {
            setTelegramCommand(result.connectionCommand ?? "");
            setTelegramBotUrl(result.botUrl);
            if (telegramWindow) {
                telegramWindow.opener = null;
                telegramWindow.location.href = result.botUrl;
            } else {
                window.open(result.botUrl, "_blank", "noopener,noreferrer");
            }
            addToast({
                title: "Telegram aberto",
                description: "Toque em Start. Se aparecer apenas /start, cole o comando completo exibido aqui.",
                type: "success",
            });
        } else {
            telegramWindow?.close();
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
            if (isConnected) {
                setTelegramCommand("");
                setTelegramBotUrl("");
            }
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
            setTelegramBotUrl("");
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
                        label={USERNAME_LABEL}
                        value={formData.username}
                        onChange={(event) => setFormData(prev => ({ ...prev, username: normalizeUsername(event.target.value) }))}
                        helperText={getUsernameHelperText(usernameStatus)}
                        error={usernameStatus === "taken" || usernameStatus === "invalid" || usernameStatus === "error"}
                        isDisabled={isSaving}
                        autoComplete="username"
                    />

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
                        {(telegramBotUrl || telegramCommand) && !formData.isTelegramConnected && (
                            <div className="mt-4 rounded-lg border border-gray-200 bg-white p-3">
                                {telegramBotUrl && (
                                    <Button
                                        type="button"
                                        variant="secondary"
                                        size="sm"
                                        iconLeading={ExternalLink}
                                        onPress={() => window.open(telegramBotUrl, "_blank", "noopener,noreferrer")}
                                    >
                                        Abrir Telegram
                                    </Button>
                                )}
                                {telegramCommand && (
                                    <>
                                        <p className="mt-3 text-xs font-medium text-gray-700">Comando alternativo</p>
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
                                    </>
                                )}
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
                    <Button type="submit" isDisabled={isSaving || isAvatarBusy || !isUsernameReady}>
                        {isSaving ? "Salvando..." : "Salvar alterações"}
                    </Button>
                </CardFooter>
            </Card>
        </form>
    );
};

const normalizeUsername = (value: string) =>
    value.toLowerCase().replace(/[^a-z0-9_]/g, "").slice(0, 24);

const getUsernameHelperText = (status: UsernameStatus) => {
    switch (status) {
        case "checking":
            return "Verificando disponibilidade...";
        case "available":
            return USERNAME_AVAILABLE_TEXT;
        case "current":
            return USERNAME_CURRENT_TEXT;
        case "taken":
            return USERNAME_TAKEN_TEXT;
        case "invalid":
            return USERNAME_HELPER_TEXT;
        case "error":
            return USERNAME_CHECK_ERROR_TEXT;
        default:
            return USERNAME_HELPER_TEXT;
    }
};
