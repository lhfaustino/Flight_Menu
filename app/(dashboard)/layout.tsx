"use client";

import { AppShell } from "@/components/layout/AppShell";
import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";

/**
 * Dashboard Layout
 * Wraps all dashboard pages in the sidebar and top navigation.
 */
export default function DashboardLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    const pathname = usePathname();
    const [isMounted, setIsMounted] = useState(false);

    useEffect(() => {
        setIsMounted(true);
    }, []);

    // Extract view name from pathname for AppShell's active state
    const currentView = pathname.split("/").pop() || "dashboard";

    if (!isMounted) {
        return <div className="min-h-screen bg-gray-50" />;
    }

    return (
        <AppShell currentView={currentView}>
            {children}
        </AppShell>
    );
}
