import * as React from "react"
import { useRouter } from "next/navigation"
import { ClipboardList, Settings, Search, LifeBuoy, ShieldCheck } from "lucide-react"
import { NavList, NavAccountCard, MobileNavigationHeader } from "./navigation/SidebarNavigation"
import type { NavItemType } from "./navigation/NavList"
import { UserMenu } from "./navigation/UserMenu"
import { CommandPalette } from "./CommandPalette"
import { BrandLogo } from "@/components/ui/BrandLogo"
import { useAuth } from "@/components/features/auth/AuthProvider"
import { isAdminEmail } from "@/lib/admin-access"
import { RouterProvider } from "react-aria-components";

const baseNavigation: (NavItemType & { view: string })[] = [
    { label: "Planilha", href: "/roster-upload", view: "meal-plan", icon: ClipboardList },
    { label: "Configurações", href: "/settings", view: "settings", icon: Settings },
    { label: "Suporte", href: "/support", view: "support", icon: LifeBuoy },
]

const adminNavigation: (NavItemType & { view: string })[] = [
    { label: "Admin", href: "/meal-plan-admin", view: "meal-plan-admin", icon: ShieldCheck },
]

interface AppShellProps {
    children: React.ReactNode;
    currentView?: string;
    onViewChange?: (view: any) => void;
}

export function AppShell({ children, currentView, onViewChange }: AppShellProps) {
    const router = useRouter();
    const { user } = useAuth();
    const navigation = React.useMemo(
        () => isAdminEmail(user?.email) ? [...baseNavigation, ...adminNavigation] : baseNavigation,
        [user?.email],
    );

    const handleNavClick = (item: any) => {
        if (onViewChange && item.view) {
            onViewChange(item.view);
        } else if (item.href) {
            router.push(item.href);
        }
    };

    const activeUrl = navigation.find(n => n.view === currentView)?.href || "/roster-upload";

    return (
        <div className="flex flex-col lg:flex-row min-h-screen bg-gray-50">
            <RouterProvider navigate={router.push}>
                {/* Desktop Sidebar */}
                <div className="hidden lg:flex flex-col w-72 border-r border-gray-200 bg-white h-screen sticky top-0">
                    <div className="p-6">
                        <BrandLogo size="md" />
                    </div>

                    <div className="flex-1 overflow-y-auto">
                        <NavList items={navigation} activeUrl={activeUrl} onItemClick={handleNavClick} />
                    </div>

                    <div className="p-4 border-t border-gray-200">
                        <NavAccountCard />
                    </div>
                </div>

                {/* Main Content */}
                <main className="flex-1 overflow-y-auto">
                    <div className="h-16 border-b border-gray-200 bg-white flex items-center justify-between px-4 lg:px-12 sticky top-0 z-10 gap-4">
                        <div className="flex items-center gap-4 lg:hidden min-w-0 flex-1">
                            <MobileNavigationHeader>
                                {(close) => (
                                    <div className="p-4">
                                        <NavList
                                            items={navigation}
                                            activeUrl={activeUrl}
                                            onItemClick={(item) => {
                                                handleNavClick(item);
                                                close();
                                            }}
                                        />
                                    </div>
                                )}
                            </MobileNavigationHeader>
                            <BrandLogo size="sm" />
                        </div>

                        <div className="relative group max-w-md w-full hidden sm:block">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 group-hover:scale-110 transition-transform" />
                            <input
                                type="text"
                                placeholder="Search or type a command (⌘K)"
                                readOnly
                                onClick={() => window.dispatchEvent(new CustomEvent("open-command-palette"))}
                                className="w-full bg-gray-50 border border-gray-200 rounded-lg py-2 pl-10 pr-4 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-brand-500/20 cursor-pointer transition-all hover:bg-white hover:border-brand-200"
                            />
                        </div>

                        <div className="flex items-center gap-2 sm:gap-4 shrink-0">
                            <UserMenu compact placement="bottom right" />
                        </div>
                    </div>
                    <div className="p-4 lg:p-12 max-w-7xl mx-auto w-full">
                        {children}
                    </div>
                </main>
                <CommandPalette onNavigate={(view) => {
                    if (onViewChange) {
                        onViewChange(view);
                    } else {
                        const item = navigation.find(n => n.view === view);
                        if (item?.href) {
                            router.push(item.href);
                        }
                    }
                }} />
            </RouterProvider>
        </div>
    )
}
