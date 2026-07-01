import { redirect } from "next/navigation";

/**
 * Root entry
 */
export default function Home() {
    redirect("/auth");
}
