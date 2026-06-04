import { redirect } from 'next/navigation';
import { CateringUploadCard } from '@/components/features/catering/CateringUploadCard';
import { getCurrentAdminAccess } from '@/app/actions/admin-users';
import { ADMIN_EMAIL } from '@/lib/admin-access';
import { createAdminClient } from '@/lib/supabase/admin';

export default async function MealPlanAdminPage() {
  const access = await getCurrentAdminAccess();

  if (!access.isAdmin) {
    redirect('/roster-upload');
  }

  const adminClient = createAdminClient();
  const { data: masterProfile } = await adminClient
    .from('profiles')
    .select('id')
    .eq('email', ADMIN_EMAIL)
    .maybeSingle();

  const { count } = await adminClient
    .from('catering_rules')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', masterProfile?.id ?? access.id);

  const { data: latestRule } = await adminClient
    .from('catering_rules')
    .select('updated_at, created_at')
    .eq('user_id', masterProfile?.id ?? access.id)
    .order('updated_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  const lastUpdated = latestRule?.updated_at ?? latestRule?.created_at ?? null;

  return (
    <div className="min-h-screen bg-gray-50 py-12">
      <div className="mx-auto max-w-4xl px-4">
        <div className="mb-8">
          <p className="text-sm font-semibold uppercase tracking-wide text-brand-600">Admin</p>
          <h1 className="mt-2 text-3xl font-bold text-gray-900">Meal plan fixo</h1>
          <p className="mt-2 max-w-2xl text-gray-600">
            Atualize aqui o PDF de alimentacao usado por todos os usuarios. Usuarios comuns enviam apenas a escala.
          </p>
        </div>

        <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="rounded-lg border border-gray-200 bg-white p-5 shadow-sm">
            <p className="text-sm font-medium text-gray-500">Regras salvas</p>
            <p className="mt-2 text-3xl font-bold text-gray-900">{count ?? 0}</p>
          </div>
          <div className="rounded-lg border border-gray-200 bg-white p-5 shadow-sm">
            <p className="text-sm font-medium text-gray-500">Ultima atualizacao</p>
            <p className="mt-2 text-lg font-semibold text-gray-900">
              {lastUpdated ? new Date(lastUpdated).toLocaleString('pt-BR') : 'Nenhum PDF enviado'}
            </p>
          </div>
        </div>

        <CateringUploadCard />
      </div>
    </div>
  );
}
