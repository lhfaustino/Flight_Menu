import { ExternalLink, Link2 } from "lucide-react";
import { getUsefulLinks } from "@/app/actions/useful-links";

export const dynamic = "force-dynamic";

export default async function LinksUteisPage() {
    const usefulLinks = await getUsefulLinks();

    return (
        <div className="mx-auto max-w-3xl">
            <div className="mb-8">
                <p className="text-sm font-semibold uppercase tracking-wide text-brand-600">Acessos</p>
                <h1 className="mt-2 text-3xl font-bold text-gray-900">Links Úteis</h1>
            </div>

            {usefulLinks.length > 0 ? (
                <div className="space-y-3">
                    {usefulLinks.map((link) => (
                        <a
                            key={link.id}
                            href={link.href}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="group flex w-full items-center gap-3 rounded-lg border border-gray-200 bg-white px-4 py-3 text-left shadow-sm transition-colors hover:border-brand-200 hover:bg-brand-50/40 focus:outline-none focus:ring-2 focus:ring-brand-500/20"
                        >
                            <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-gray-50 text-gray-500 transition-colors group-hover:bg-white group-hover:text-brand-600">
                                <Link2 className="size-5" />
                            </span>
                            <span className="min-w-0 flex-1">
                                <span className="block font-semibold text-gray-900">{link.title}</span>
                                <span className="block truncate text-sm text-gray-500">{getLinkLabel(link.href)}</span>
                            </span>
                            <ExternalLink className="size-4 shrink-0 text-gray-400 transition-colors group-hover:text-brand-600" />
                        </a>
                    ))}
                </div>
            ) : (
                <div className="rounded-lg border border-gray-200 bg-white px-6 py-10 text-center shadow-sm">
                    <div className="mx-auto mb-4 flex size-12 items-center justify-center rounded-lg bg-gray-50 text-gray-400">
                        <Link2 className="size-6" />
                    </div>
                    <h2 className="font-semibold text-gray-900">Nenhum link cadastrado</h2>
                    <p className="mt-1 text-sm text-gray-500">Os links úteis aparecerão aqui quando forem cadastrados.</p>
                </div>
            )}
        </div>
    );
}

function getLinkLabel(href: string) {
    try {
        const url = new URL(href);
        return url.hostname.replace(/^www\./, "");
    } catch {
        return href;
    }
}
