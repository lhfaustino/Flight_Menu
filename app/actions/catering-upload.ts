'use server';

import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { isAdminEmail } from '@/lib/admin-access';
import { processCateringPdfBuffer } from '@/lib/flight-menu-processing';

export async function uploadCateringPlan(formData: FormData) {
  const supabase = await createClient();
  
  // Get authenticated user
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) {
    throw new Error('Unauthorized');
  }

  if (!isAdminEmail(user.email)) {
    throw new Error('Only the administrator can update the meal plan PDF.');
  }
  
  const file = formData.get('file') as File;
  if (!file) {
    throw new Error('No file provided');
  }
  
  if (file.type !== 'application/pdf') {
    throw new Error('Only PDF files are allowed');
  }
  
  try {
    // 1. Convert file to buffer
    const arrayBuffer = await file.arrayBuffer();
    const pdfBuffer = Buffer.from(arrayBuffer);
    
    // 2. Upload PDF to Supabase Storage
    const fileName = `${user.id}/${Date.now()}-${file.name}`;
    const { error: uploadError } = await supabase.storage
      .from('catering-plans')
      .upload(fileName, pdfBuffer, {
        contentType: 'application/pdf',
      });
    
    if (uploadError) {
      console.warn(`Catering PDF parsed but not saved to Storage: ${uploadError.message}`);
    }

    const storageWarning = uploadError
      ? ` PDF file was parsed, but not saved to Storage: ${uploadError.message}`
      : '';
    
    const adminClient = createAdminClient();
    const result = await processCateringPdfBuffer({
      supabase: adminClient,
      userId: user.id,
      pdfBuffer,
      sourceName: file.name,
      refreshAllFlightLegs: true,
    });
    
    return {
      success: true,
      rulesAdded: result.rulesInserted,
      rules: result.entries,
      message:
        `Meal plan replaced successfully. ${result.rulesDeleted} old rules deleted, ` +
        `${result.rulesInserted} new rules inserted, ${result.flightLegsCleared} old flight leg meals cleared, ` +
        `${result.flightLegsUpdated} flight legs updated from the new PDF.${storageWarning}`,
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error during upload',
    };
  }
}
