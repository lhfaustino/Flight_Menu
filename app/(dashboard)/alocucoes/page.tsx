import { getAlocucoes } from "@/app/actions/alocucoes";
import { AlocucoesPage } from "@/components/features/alocucoes/AlocucoesPage";

export const dynamic = "force-dynamic";

export default async function Page() {
    const speeches = await getAlocucoes();
    return <AlocucoesPage speeches={speeches} />;
}
