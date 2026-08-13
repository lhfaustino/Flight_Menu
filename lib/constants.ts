/**
 * Application-wide constants and configuration.
 */

export const APP_CONFIG = {
    name: "Trip Space",
    description: "Aplicativo para escala, serviço de bordo e documentos rápidos.",
    version: "1.0.0",
};

export const BRAND_CONFIG = {
    name: "Trip Space",
    logo: {
        light: "/logo_tripspace.png",
        dark: "/logo_tripspace.png",
        icon: "/logo_tripspace.png",
    },
    name_logo: true, // Show brand name alongside logo
    theme: {
        primaryColor: "#1A454C", // Brand primary color from logo.svg
    },
};

export const NAVIGATION = {
    main: [
        { name: "Painel", href: "dashboard" },
        { name: "Projetos", href: "projects" },
        { name: "Usuários", href: "users" },
        { name: "Configurações", href: "settings" },
    ],
    admin: [
        { name: "Usuários", href: "users" },
        { name: "Funções", href: "roles" },
        { name: "Atividade", href: "activity" },
    ],
};

export const AUTH_CONFIG = {
    authPath: "/auth",
    loginPath: "/login",
    signupPath: "/signup",
    afterLoginPath: "/inicio",
    afterSignupPath: "/inicio",
    rememberedLoginPath: "/inicio",
};
