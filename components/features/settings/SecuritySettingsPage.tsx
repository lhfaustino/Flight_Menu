"use client";

import { useState } from "react";
import { Shield, Smartphone, Monitor, Lock } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Toggle } from "@/components/ui/Toggle";
import { Badge } from "@/components/ui/Badge";

export const SecuritySettingsPage = () => {
    const [isTwoFactorEnabled, setIsTwoFactorEnabled] = useState(false);

    return (
        <div className="space-y-6">
            <Card>
                <CardHeader>
                    <div className="flex items-center gap-3 mb-2">
                        <div className="p-2 bg-brand-50 rounded-lg">
                            <Shield className="size-5 text-brand-600" />
                        </div>
                        <CardTitle>Configurações de segurança</CardTitle>
                    </div>
                    <CardDescription>Gerencie a segurança da conta e os métodos de autenticação.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-8">
                    {/* Two-Factor Authentication */}
                    <div className="flex items-start justify-between gap-4 p-4 rounded-xl border border-gray-100 bg-gray-50/50">
                        <div className="space-y-1">
                            <div className="flex items-center gap-2">
                                <h4 className="font-bold text-gray-900">Autenticação de dois fatores (2FA)</h4>
                                <Badge variant={isTwoFactorEnabled ? "success" : "default"} size="sm">
                                    {isTwoFactorEnabled ? "Ativada" : "Desativada"}
                                </Badge>
                            </div>
                            <p className="text-sm text-gray-500 max-w-md">
                                Adicione uma camada extra de segurança à sua conta. Vamos pedir um código sempre que você entrar em um novo dispositivo.
                            </p>
                        </div>
                        <Toggle
                            isSelected={isTwoFactorEnabled}
                            onChange={setIsTwoFactorEnabled}
                        />
                    </div>

                    {/* Password Section */}
                    <div className="space-y-4 pt-4 border-t border-gray-100">
                        <h4 className="text-sm font-bold text-gray-900 uppercase tracking-widest">Senha</h4>
                        <div className="flex items-center justify-between p-4 rounded-xl border border-gray-200">
                            <div className="flex items-center gap-4">
                                <div className="p-2 bg-gray-100 rounded-lg">
                                    <Lock className="size-4 text-gray-500" />
                                </div>
                                <div className="space-y-1">
                                    <p className="text-sm font-semibold text-gray-900">Senha da conta</p>
                                    <p className="text-xs text-gray-500">Alterada há 3 meses</p>
                                </div>
                            </div>
                            <Button variant="secondary" size="sm">Alterar senha</Button>
                        </div>
                    </div>

                    {/* Active Sessions */}
                    <div className="space-y-4 pt-4 border-t border-gray-100">
                        <div className="flex items-center justify-between">
                            <h4 className="text-sm font-bold text-gray-900 uppercase tracking-widest">Sessões ativas</h4>
                            <Button variant="tertiary" size="sm" className="text-error-700 hover:text-error-800">
                                Sair de todos os outros dispositivos
                            </Button>
                        </div>
                        <div className="divide-y divide-gray-100">
                            <SessionItem
                                device="MacBook Pro"
                                location="São Paulo, Brasil"
                                activeNow
                                browser="Chrome"
                                icon={Monitor}
                            />
                            <SessionItem
                                device="iPhone 15 Pro"
                                location="São Paulo, Brasil"
                                lastSeen="há 2 horas"
                                browser="Safari"
                                icon={Smartphone}
                            />
                        </div>
                    </div>
                </CardContent>
            </Card>

            <Card className="border-error-100 bg-error-25/30">
                <CardHeader>
                    <CardTitle className="text-error-900">Zona de risco</CardTitle>
                    <CardDescription className="text-error-700">Ações irreversíveis para sua conta.</CardDescription>
                </CardHeader>
                <CardFooter className="border-t border-error-100 px-6 py-4 flex items-center justify-between">
                    <p className="text-sm text-error-800 font-medium">Excluir conta e todos os dados</p>
                    <Button variant="destructive" size="sm">Excluir conta</Button>
                </CardFooter>
            </Card>
        </div>
    );
};

const SessionItem = ({ device, location, activeNow, lastSeen, browser, icon: Icon }: any) => (
    <div className="py-4 flex items-center justify-between group">
        <div className="flex items-center gap-4">
            <div className="size-10 rounded-full bg-gray-50 border border-gray-100 flex items-center justify-center">
                <Icon className="size-5 text-gray-400" />
            </div>
            <div className="space-y-0.5">
                <div className="flex items-center gap-2">
                    <p className="text-sm font-bold text-gray-900">{device}</p>
                    {activeNow && <Badge variant="success" size="sm" className="h-1.5 w-1.5 p-0 rounded-full" />}
                </div>
                <p className="text-xs text-gray-500">
                    {browser} • {location} • {activeNow ? "Ativo agora" : lastSeen}
                </p>
            </div>
        </div>
        <Button variant="tertiary" size="sm" className="opacity-0 group-hover:opacity-100 transition-opacity">
            Revogar
        </Button>
    </div>
);
