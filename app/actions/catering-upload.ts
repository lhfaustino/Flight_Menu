'use server';

import { assertCurrentAdmin } from '@/app/actions/admin-users';
import { ADMIN_EMAIL } from '@/lib/admin-access';
import { processCateringPdfBuffer } from '@/lib/flight-menu-processing';
import { createAdminClient } from '@/lib/supabase/admin';
import { createClient } from '@/lib/supabase/server';

export async function uploadCateringPlan(formData: FormData) {
  const supabase = await createClient();

  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) {
    throw new Error('Não autorizado');
  }

  await assertCurrentAdmin();

  const file = formData.get('file') as File;
  if (!file) {
    throw new Error('Nenhum arquivo enviado');
  }

  if (file.type !== 'application/pdf') {
    throw new Error('Somente arquivos PDF são permitidos');
  }

  try {
    const adminClient = createAdminClient();
    const { data: masterProfile, error: masterProfileError } = await adminClient
      .from('profiles')
      .select('id')
      .eq('email', ADMIN_EMAIL)
      .maybeSingle();

    if (masterProfileError || !masterProfile?.id) {
      throw new Error('Não foi possível encontrar o perfil master do meal plan.');
    }

    const arrayBuffer = await file.arrayBuffer();
    const pdfBuffer = Buffer.from(arrayBuffer);

    const fileName = `${masterProfile.id}/${Date.now()}-${file.name}`;
    const { error: uploadError } = await supabase.storage
      .from('catering-plans')
      .upload(fileName, pdfBuffer, {
        contentType: 'application/pdf',
      });

    if (uploadError) {
      console.warn(`Catering PDF parsed but not saved to Storage: ${uploadError.message}`);
    }

    const storageWarning = uploadError
      ? ` O PDF foi processado, mas não foi salvo no Storage: ${uploadError.message}`
      : '';

    const result = await processCateringPdfBuffer({
      supabase: adminClient,
      userId: masterProfile.id,
      pdfBuffer,
      sourceName: file.name,
      refreshAllFlightLegs: true,
    });

    return {
      success: true,
      rulesAdded: result.rulesInserted,
      rules: result.entries,
      message:
        `Meal plan atualizado com sucesso. ${result.rulesDeleted} regras antigas removidas, ` +
        `${result.rulesInserted} novas regras inseridas, ${result.flightLegsCleared} voos antigos limpos, ` +
        `${result.flightLegsUpdated} voos atualizados pelo novo PDF.${storageWarning}`,
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Erro desconhecido durante o envio',
    };
  }
}
