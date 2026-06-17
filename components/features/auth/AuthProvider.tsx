"use client";

import { createContext, useContext, useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { User, Session } from "@supabase/supabase-js";
import { useRouter } from "next/navigation";
import { clearRememberLogin, getStoredRememberLogin, isRememberLoginActive } from "@/lib/auth-remember";

interface AuthContextType {
    user: User | null;
    session: Session | null;
    isLoading: boolean;
    signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

/**
 * AuthProvider Component
 * Manages the Supabase auth state and provides it to the application.
 * Listens for auth state changes (sign in, sign out, session refresh).
 */
export function AuthProvider({ children }: { children: React.ReactNode }) {
    const [user, setUser] = useState<User | null>(null);
    const [session, setSession] = useState<Session | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const supabase = createClient();
    const router = useRouter();

    useEffect(() => {
        const getInitialSession = async () => {
            const { data: { session } } = await supabase.auth.getSession();

            if (session?.user) {
                const rememberedLogin = getStoredRememberLogin();

                if (rememberedLogin && !isRememberLoginActive(rememberedLogin, session.user.id)) {
                    clearRememberLogin();
                    await supabase.auth.signOut();
                    setSession(null);
                    setUser(null);
                    setIsLoading(false);
                    return;
                }
            }

            setSession(session);
            setUser(session?.user ?? null);
            setIsLoading(false);
        };

        getInitialSession();

        const { data: { subscription } } = supabase.auth.onAuthStateChange(
            (_event, session) => {
                setSession(session);
                setUser(session?.user ?? null);
                setIsLoading(false);

                // Optionally refresh the page on logic/logout to clear sensitive state
                if (_event === "SIGNED_IN") router.refresh();
                if (_event === "SIGNED_OUT") {
                    clearRememberLogin();
                    router.push("/login");
                }
            }
        );

        return () => {
            subscription.unsubscribe();
        };
    }, [supabase, router]);

    const signOut = async () => {
        clearRememberLogin();
        await supabase.auth.signOut();
        router.push("/login");
    };

    return (
        <AuthContext.Provider value={{ user, session, isLoading, signOut }}>
            {children}
        </AuthContext.Provider>
    );
}

/**
 * Hook to access the auth context.
 * Must be used within an AuthProvider.
 */
export function useAuth() {
    const context = useContext(AuthContext);
    if (context === undefined) {
        throw new Error("useAuth must be used within an AuthProvider");
    }
    return context;
}
