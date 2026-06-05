import * as React from "react";
import { useRouter } from "next/navigation";
import { UtensilsCrossed, Link2, Megaphone, Settings, Search, LifeBuoy, ShieldCheck } from "lucide-react";
import { NavList, NavAccountCard, MobileNavigationHeader } from "./navigation/SidebarNavigation";
import type { NavItemType } from "./navigation/NavList";
import { UserMenu } from "./navigation/UserMenu";
import { CommandPalette } from "./CommandPalette";
import { BrandLogo } from "@/components/ui/BrandLogo";
import { useAuth } from "@/components/features/auth/AuthProvider";
import { getCurrentAdminAccess } from "@/app/actions/admin-users";
import { RouterProvider } from "react-aria-components";

type AppNavItem = NavItemType & { view?: string; items?: AppNavItem[] };

const baseNavigation: AppNavItem[] = [
    { label: "Alimentação", href: "/roster-upload", view: "meal-plan", icon: UtensilsCrossed },
    { label: "Alocuções", href: "/alocucoes", view: "alocucoes", icon: Megaphone },
    { label: "Links Úteis", href: "/links-uteis", view: "links-uteis", icon: Link2 },
    { label: "Configurações", href: "/settings", view: "settings", icon: Settings },
    { label: "Suporte", href: "/support", view: "support", icon: LifeBuoy },
];

const adminNavigation: AppNavItem = {
    label: "Admin",
    href: "/admin",
    view: "admin",
    icon: ShieldCheck,
};

interface AppShellProps {
    children: React.ReactNode;
    currentView?: string;
    onViewChange?: (view: any) => void;
}

export function AppShell({ children, currentView, onViewChange }: AppShellProps) {
    const router = useRouter();
    const { user } = useAuth();
    const [adminAccess, setAdminAccess] = React.useState({ isAdmin: false, isSuperAdmin: false });

    React.useEffect(() => {
        let isMounted = true;

        async function loadAdminAccess() {
            if (!user) {
                setAdminAccess({ isAdmin: false, isSuperAdmin: false });
                return;
            }

            const access = await getCurrentAdminAccess();
            if (isMounted) {
                setAdminAccess({ isAdmin: access.isAdmin, isSuperAdmin: access.isSuperAdmin });
            }
        }

        loadAdminAccess();

        return () => {
            isMounted = false;
        };
    }, [user]);

    const navigation = React.useMemo(
        () => adminAccess.isAdmin ? [...baseNavigation, adminNavigation] : baseNavigation,
        [adminAccess.isAdmin],
    );

    const flatNavigation = React.useMemo(() => flattenNavigation(navigation), [navigation]);

    const handleNavClick = (item: any) => {
        if (onViewChange && item.view) {
            onViewChange(item.view);
        } else if (item.href) {
            router.push(item.href);
        }
    };

    const activeUrl = flatNavigation.find(n => n.view === currentView)?.href || "/roster-upload";

    return (
        <div className="flex min-h-screen flex-col bg-gray-50 lg:flex-row">
            <RouterProvider navigate={router.push}>
                <div className="sticky top-0 hidden h-screen w-72 flex-col border-r border-gray-200 bg-white lg:flex">
                    <div className="p-6">
                        <BrandLogo size="md" />
                    </div>

                    <div className="flex-1 overflow-y-auto">
                        <NavList items={navigation} activeUrl={activeUrl} onItemClick={handleNavClick} />
                    </div>

                    <div className="border-t border-gray-200 p-4">
                        <NavAccountCard />
                    </div>
                </div>

                <main className="flex-1 overflow-y-auto">
                    <div className="sticky top-0 z-10 flex h-16 items-center justify-between gap-4 border-b border-gray-200 bg-white px-4 lg:px-12">
                        <div className="flex min-w-0 flex-1 items-center gap-4 lg:hidden">
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

                        <div className="group relative hidden w-full max-w-md sm:block">
                            <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-gray-400 transition-transform group-hover:scale-110" />
                            <input
                                type="text"
                                placeholder="Buscar ou digitar comando (Ctrl+K)"
                                readOnly
                                onClick={() => window.dispatchEvent(new CustomEvent("open-command-palette"))}
                                className="w-full cursor-pointer rounded-lg border border-gray-200 bg-gray-50 py-2 pl-10 pr-4 text-sm text-gray-900 transition-all hover:border-brand-200 hover:bg-white focus:outline-none focus:ring-2 focus:ring-brand-500/20"
                            />
                        </div>

                        <div className="flex shrink-0 items-center gap-2 sm:gap-4">
                            <UserMenu compact placement="bottom right" />
                        </div>
                    </div>
                    <div className="mx-auto w-full max-w-7xl p-4 lg:p-12">
                        {children}
                    </div>
                </main>
                <CommandPalette onNavigate={(view) => {
                    if (onViewChange) {
                        onViewChange(view);
                    } else {
                        const item = flatNavigation.find(n => n.view === view);
                        if (item?.href) {
                            router.push(item.href);
                        }
                    }
                }} />
            </RouterProvider>
        </div>
    );
}

function flattenNavigation(items: AppNavItem[]): AppNavItem[] {
    return items.flatMap((item) => [item, ...(item.items ? flattenNavigation(item.items) : [])]);
}
