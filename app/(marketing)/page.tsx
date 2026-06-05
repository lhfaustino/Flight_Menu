import { redirect } from "next/navigation";
import { AUTH_CONFIG } from "@/lib/constants";

/**
 * Root route.
 */
export default function Home() {
    redirect(AUTH_CONFIG.authPath);
}
