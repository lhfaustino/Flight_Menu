import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { ToastProvider } from "@/components/ui/Toast";
import { AuthProvider } from "@/components/features/auth/AuthProvider";
import { ServiceWorkerRegister } from "@/components/ui/ServiceWorkerRegister";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
    title: "Meu App",
    description: "Aplicativo para escala, serviço de bordo e documentos rápidos.",
    manifest: "/manifest.json",
    icons: {
        icon: "/logo.png",
        shortcut: "/logo.png",
        apple: "/logo.png",
    },
    appleWebApp: {
        capable: true,
        statusBarStyle: "black-translucent",
        title: "Meu App",
    },
};

export const viewport: Viewport = {
    width: "device-width",
    initialScale: 1,
    maximumScale: 1,
    userScalable: false,
    viewportFit: "cover",
};

export default function RootLayout({
    children,
}: Readonly<{
    children: React.ReactNode;
}>) {
    return (
        <html lang="pt-BR" suppressHydrationWarning>
            <body className={`${inter.className} antialiased`} suppressHydrationWarning>
                <AuthProvider>
                    <ToastProvider>
                        {children}
                    </ToastProvider>
                </AuthProvider>
                <ServiceWorkerRegister />
            </body>
        </html>
    );
}
