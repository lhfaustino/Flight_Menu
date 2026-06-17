export const REMEMBER_LOGIN_DAYS = 30;
export const REMEMBER_LOGIN_MS = REMEMBER_LOGIN_DAYS * 24 * 60 * 60 * 1000;
export const REMEMBER_LOGIN_COOKIE = "tripspace_remember_login";
export const REMEMBER_LOGIN_STORAGE_KEY = "tripspace:remember-login";

type RememberLoginValue = {
    userId: string;
    expiresAt: number;
};

export const buildRememberLoginValue = (userId: string, expiresAt: number) =>
    `${userId}:${expiresAt}`;

export const parseRememberLoginValue = (value?: string | null): RememberLoginValue | null => {
    if (!value) return null;

    const [userId, expiresAtValue] = value.split(":");
    const expiresAt = Number(expiresAtValue);

    if (!userId || !Number.isFinite(expiresAt)) {
        return null;
    }

    return { userId, expiresAt };
};

export const isRememberLoginActive = (
    value: string | null | undefined,
    userId: string,
    now = Date.now()
) => {
    const remembered = parseRememberLoginValue(value);
    return Boolean(remembered && remembered.userId === userId && remembered.expiresAt > now);
};

export const getStoredRememberLogin = () => {
    if (typeof window === "undefined") return null;
    return window.localStorage.getItem(REMEMBER_LOGIN_STORAGE_KEY);
};

export const setRememberLogin = (userId: string) => {
    if (typeof window === "undefined") return;

    const expiresAt = Date.now() + REMEMBER_LOGIN_MS;
    const value = buildRememberLoginValue(userId, expiresAt);
    const maxAge = Math.floor(REMEMBER_LOGIN_MS / 1000);

    window.localStorage.setItem(REMEMBER_LOGIN_STORAGE_KEY, value);
    document.cookie = `${REMEMBER_LOGIN_COOKIE}=${value}; Max-Age=${maxAge}; Path=/; SameSite=Lax`;
};

export const clearRememberLogin = () => {
    if (typeof window === "undefined") return;

    window.localStorage.removeItem(REMEMBER_LOGIN_STORAGE_KEY);
    document.cookie = `${REMEMBER_LOGIN_COOKIE}=; Max-Age=0; Path=/; SameSite=Lax`;
};
