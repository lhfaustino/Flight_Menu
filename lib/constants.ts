/**
 * Application-wide constants and configuration.
 */

export const APP_CONFIG = {
    name: "Flight Menu",
    description: "Flight meal service planning and roster upload application.",
    version: "1.0.0",
};

export const BRAND_CONFIG = {
    name: "Flight Menu",
    logo: {
        light: "/logo.svg",
        dark: "/logo.svg",
        icon: "/logo.svg",
    },
    name_logo: true, // Show brand name alongside logo
    theme: {
        primaryColor: "#1A454C", // Brand primary color from logo.svg
    },
};

export const NAVIGATION = {
    main: [
        { name: "Dashboard", href: "dashboard" },
        { name: "Projects", href: "projects" },
        { name: "Users", href: "users" },
        { name: "Settings", href: "settings" },
    ],
    admin: [
        { name: "Users", href: "users" },
        { name: "Roles", href: "roles" },
        { name: "Activity", href: "activity" },
    ],
};

export const AUTH_CONFIG = {
    loginPath: "/login",
    signupPath: "/signup",
    afterLoginPath: "/roster-upload",
};
