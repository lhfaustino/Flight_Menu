'use server';

import { createClient } from '@/lib/supabase/server';
import { extractPdfText, parseCateringText } from '@/lib/pdf-parsing';

export async function uploadCateringPlan(formData: FormData) {
  const supabase = await createClient();
  
  // Get authenticated user
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) {
    throw new Error('Unauthorized');
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
    
    // 2. Extract text from PDF
    const pdfText = await extractPdfText(pdfBuffer);
    
    // 3. Parse catering entries
    const cateringEntries = parseCateringText(pdfText);
    
    if (cateringEntries.length === 0) {
      throw new Error('No catering data found in PDF. Check the format.');
    }
    
    // 4. Upload PDF to Supabase Storage
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
    
    // 5. Create catering rules from entries
    const cateringRules = cateringEntries.map(entry => ({
      unique_key: buildUniqueKey(entry.date, entry.flightNumber, entry.origin),
      user_id: user.id,
      flight_number: entry.flightNumber,
      service_date: toIsoDate(entry.date),
      origin_iata: entry.origin || null,
      destination_iata: entry.destination || null,
      service_type: entry.crewService || 'Standard',
      meal_type: entry.paxService || 'Meal',
      priority: 1,
    }));

    const existingKeys = await fetchExistingKeys(
      supabase,
      'catering_rules',
      cateringRules.map((rule) => rule.unique_key)
    );
    const newCateringRules = cateringRules.filter((rule) => !existingKeys.has(rule.unique_key));
    
    const { error: insertError } = newCateringRules.length > 0
      ? await supabase
          .from('catering_rules')
          .insert(newCateringRules)
      : { error: null };

    const flightLegsUpdated = await updateFlightLegMeals(supabase, cateringRules);
    
    if (insertError) {
      if (insertError.message.toLowerCase().includes('row-level security')) {
        return {
          success: true,
          rulesAdded: 0,
          rules: cateringEntries,
          message: `Parsed ${cateringRules.length} catering rules, but Supabase blocked saving them with row-level security. ${flightLegsUpdated} existing flight legs were enriched with meal information.${storageWarning}`,
        };
      }

      return {
        success: true,
        rulesAdded: 0,
        rules: cateringEntries,
        message: `Parsed ${cateringRules.length} catering rules, but could not save them: ${insertError.message}. ${flightLegsUpdated} existing flight legs were enriched with meal information.${storageWarning}`,
      };
    }
    
    return {
      success: true,
      rulesAdded: newCateringRules.length,
      rules: cateringEntries,
      message: `Successfully imported ${newCateringRules.length} catering rules. ${cateringRules.length - newCateringRules.length} duplicate records were discarded. ${flightLegsUpdated} existing flight legs were enriched with meal information.${storageWarning}`,
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error during upload',
    };
  }
}

function toIsoDate(value: string) {
  const match = value.match(/^(\d{2})-(\d{2})-(\d{4})$/);
  if (!match) return value;

  return `${match[3]}-${match[2]}-${match[1]}`;
}

function buildUniqueKey(date: string, flightNumber: string, origin: string) {
  return `${toIsoDate(date)}-${normalizeFlightNumber(flightNumber)}-${origin.toUpperCase()}`;
}

function normalizeFlightNumber(value: string) {
  const digits = value.replace(/\D/g, '');
  return digits.startsWith('3') && digits.length === 5 ? digits.slice(1) : digits;
}

async function fetchExistingKeys(supabase: Awaited<ReturnType<typeof createClient>>, table: string, keys: string[]) {
  const existing = new Set<string>();

  for (const chunk of chunkArray([...new Set(keys)], 250)) {
    const { data } = await supabase
      .from(table)
      .select('unique_key')
      .in('unique_key', chunk);

    data?.forEach((row: { unique_key: string | null }) => {
      if (row.unique_key) existing.add(row.unique_key);
    });
  }

  return existing;
}

async function updateFlightLegMeals(
  supabase: Awaited<ReturnType<typeof createClient>>,
  cateringRules: Array<{
    unique_key: string;
    service_type: string;
    meal_type: string;
  }>
) {
  const existingFlightLegKeys = await fetchExistingKeys(
    supabase,
    'flight_leg_details',
    cateringRules.map((rule) => rule.unique_key)
  );
  let updated = 0;

  for (const rule of cateringRules.filter((rule) => existingFlightLegKeys.has(rule.unique_key))) {
    const { error } = await supabase
      .from('flight_leg_details')
      .update({
        service_type: rule.service_type,
        meal_type: rule.meal_type,
      })
      .eq('unique_key', rule.unique_key);

    if (!error) updated += 1;
  }

  return updated;
}

function chunkArray<T>(items: T[], size: number) {
  const chunks: T[][] = [];
  for (let index = 0; index < items.length; index += size) {
    chunks.push(items.slice(index, index + size));
  }
  return chunks;
}
