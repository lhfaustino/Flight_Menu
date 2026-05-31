"use client";

import Link from "next/link";
import { BRAND_CONFIG } from "@/lib/constants";
import { cx } from "@/lib/utils";

interface BrandLogoProps {
    className?: string;
    showText?: boolean;
    size?: "sm" | "md" | "lg";
    href?: string;
    variant?: "default" | "light" | "dark";
}

export const BrandLogo = ({
    className,
    showText = true,
    size = "md",
    href = "/",
    variant = "default",
}: BrandLogoProps) => {
    const { name, logo, name_logo } = BRAND_CONFIG;

    const sizes = {
        sm: "h-6",
        md: "h-8",
        lg: "h-10",
    };

    const logoSrc = variant === "dark" ? logo.dark : logo.light;

    const shouldShowText = typeof name_logo !== 'undefined' ? name_logo && showText : showText;

    const content = (
        <div className={cx("flex items-center gap-2.5 font-bold tracking-tight shrink-0", className)}>
            <div className={cx(sizes[size], "flex items-center justify-center")}>
                <img
                    src={logoSrc}
                    alt={name}
                    className="h-full w-auto object-contain"
                />
            </div>
            {shouldShowText && (
                <span className={cx(
                    "text-gray-900 whitespace-nowrap",
                    size === "sm" ? "text-lg" : size === "md" ? "text-xl" : "text-2xl"
                )}>
                    {name}
                </span>
            )}
        </div>
    );

    if (href) {
        return <Link href={href}>{content}</Link>;
    }

    return content;
};
