import { BrandLogo } from "@/components/ui/BrandLogo";

export const MarketingFooter = () => {
    return (
        <footer className="bg-white border-t border-gray-100">
            <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
                <div className="flex flex-col md:flex-row items-center justify-between gap-6">
                    <BrandLogo size="md" href="/" />
                    <p className="text-sm text-gray-500">
                        &copy; {new Date().getFullYear()} Trip Space. Todos os direitos reservados.
                    </p>
                </div>
            </div>
        </footer>
    );
};
