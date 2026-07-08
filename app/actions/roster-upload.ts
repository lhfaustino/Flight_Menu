'use server';

import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { ADMIN_EMAIL } from '@/lib/admin-access';
import { extractPdfText, parseRosterText } from '@/lib/pdf-parsing';
import type { RosterEntry } from '@/lib/pdf-parsing';
import {
  MEAL_PLAN_NOT_FOUND,
  getCurrentDateInSaoPaulo,
  isCurrentOrFutureFlightLeg,
  refreshUserFlightLegMealsFromCurrentMealPlan,
} from '@/lib/flight-menu-processing';

type CateringRuleRow = {
  unique_key: string;
  service_type: string | null;
  meal_type: string | null;
};

type ParsedRosterEntry = RosterEntry & {
  rosterId: string;
};

export async function uploadRoster(formData: FormData) {
  const supabase = await createClient();
  
  // Get authenticated user
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) {
    throw new Error('Não autorizado');
  }
  
  const files = getRosterFiles(formData);
  if (files.length === 0) {
    throw new Error('Nenhum arquivo enviado');
  }

  const invalidFile = files.find((file) => file.type !== 'application/pdf');
  if (invalidFile) {
    throw new Error(`Somente arquivos PDF são permitidos. Arquivo inválido: ${invalidFile.name}`);
  }
  
  try {
    const adminClient = createAdminClient();
    const rosterEntries: ParsedRosterEntry[] = [];
    const warnings: string[] = [];

    for (const [fileIndex, file] of files.entries()) {
      const arrayBuffer = await file.arrayBuffer();
      const pdfBuffer = Buffer.from(arrayBuffer);
      const pdfText = await extractPdfText(pdfBuffer);
      const parsedEntries = parseRosterText(pdfText);

      if (parsedEntries.length === 0) {
        warnings.push(`${file.name}: nenhum voo encontrado`);
        continue;
      }

      const fileName = `${user.id}/${Date.now()}-${fileIndex}-${file.name}`;
      const { error: uploadError } = await supabase.storage
        .from('flight-rosters')
        .upload(fileName, pdfBuffer, {
          contentType: 'application/pdf',
        });

      if (uploadError) {
        warnings.push(`${file.name}: PDF interpretado, mas não salvo no Storage (${uploadError.message})`);
      }

      const { data: roster, error: rosterError } = await supabase
        .from('flight_rosters')
        .insert({
          user_id: user.id,
          name: file.name.replace(/\.pdf$/i, ''),
          file_url: uploadError ? file.name : `flight-rosters/${fileName}`,
        })
        .select('id')
        .single();

      if (rosterError || !roster?.id) {
        warnings.push(`${file.name}: voos interpretados, mas registro da escala não foi salvo (${rosterError?.message ?? 'id ausente'})`);
        continue;
      }

      rosterEntries.push(...parsedEntries.map((entry) => ({ ...entry, rosterId: roster.id })));
    }

    if (rosterEntries.length === 0) {
      throw new Error(
        warnings.length > 0
          ? `Nenhum voo foi importado. ${warnings.join(' ')}`
          : 'Nenhum voo encontrado nos PDFs. Confira o formato dos arquivos.'
      );
    }
    
    const rosterKeys = rosterEntries.map((entry) =>
      buildUniqueKey(entry.date || new Date().toISOString().split('T')[0], entry.flightNumber, entry.origin)
    );
    const [existingKeys, cateringByKey] = await Promise.all([
      fetchExistingKeys(adminClient, 'flight_leg_details', rosterKeys, user.id),
      fetchCateringByKey(rosterKeys),
    ]);

    // 6. Sync parsed flight legs into database
    const flightLegsByKey = new Map<string, {
      unique_key: string;
      roster_id: string;
      user_id: string;
      flight_number: string;
      crew_position: string | null;
      origin: string;
      destination: string;
      departure_time: string;
      arrival_time: string;
      flight_duration_minutes: number | null;
      equipment: string | null;
      service_type: string | null;
      meal_type: string | null;
    }>();

    rosterEntries.forEach(entry => {
      const flightDate = entry.date || new Date().toISOString().split('T')[0];
      const departureTime = new Date(`${flightDate}T${entry.departureTime}:00Z`);
      const arrivalTime = new Date(`${flightDate}T${entry.arrivalTime}:00Z`);
      const uniqueKey = buildUniqueKey(flightDate, entry.flightNumber, entry.origin);
      const catering = cateringByKey.get(uniqueKey);
      
      // Handle overnight flights
      if (arrivalTime < departureTime) {
        arrivalTime.setDate(arrivalTime.getDate() + 1);
      }
      
      flightLegsByKey.set(uniqueKey, {
        unique_key: uniqueKey,
        roster_id: entry.rosterId,
        user_id: user.id,
        flight_number: entry.flightNumber,
        crew_position: entry.crewPosition || null,
        origin: entry.origin,
        destination: entry.destination,
        departure_time: departureTime.toISOString(),
        arrival_time: arrivalTime.toISOString(),
        flight_duration_minutes: Math.max(0, Math.round((arrivalTime.getTime() - departureTime.getTime()) / 60000)),
        equipment: entry.equipment || null,
        service_type: catering?.service_type || MEAL_PLAN_NOT_FOUND,
        meal_type: catering?.meal_type || MEAL_PLAN_NOT_FOUND,
      });
    });

    const todayIsoDate = getCurrentDateInSaoPaulo();
    const flightLegs = Array.from(flightLegsByKey.values());
    const currentAndFutureFlightLegs = flightLegs.filter((flightLeg) =>
      isCurrentOrFutureFlightLeg(flightLeg, todayIsoDate)
    );
    const pastFlightLegsCount = flightLegs.length - currentAndFutureFlightLegs.length;
    const newFlightLegs = currentAndFutureFlightLegs.filter((flightLeg) => !existingKeys.has(flightLeg.unique_key));
    const existingFlightLegs = currentAndFutureFlightLegs.filter((flightLeg) => existingKeys.has(flightLeg.unique_key));
    const currentAndFutureKeys = new Set(currentAndFutureFlightLegs.map((flightLeg) => flightLeg.unique_key));
    const existingCurrentAndFutureKeys = await fetchCurrentAndFutureFlightLegKeys(adminClient, user.id, todayIsoDate);
    const removedFlightKeys = existingCurrentAndFutureKeys.filter((uniqueKey) => !currentAndFutureKeys.has(uniqueKey));

    const { error: insertError } = newFlightLegs.length > 0
      ? await adminClient
          .from('flight_leg_details')
          .insert(newFlightLegs)
      : { error: null };
    
    if (insertError) {
      return {
        success: true,
        flightsAdded: 0,
        flights: rosterEntries,
        rows: await fetchFlightMenuRows(supabase, user.id),
        message: `Parsed ${rosterEntries.length} flight legs, but could not save new current/future flight legs: ${insertError.message}.${formatWarnings(warnings)}`,
      };
    }

    let updateErrorMessage: string | null = null;
    for (const flightLeg of existingFlightLegs) {
        const { error } = await adminClient
        .from('flight_leg_details')
        .update({
          roster_id: flightLeg.roster_id,
          flight_number: flightLeg.flight_number,
          crew_position: flightLeg.crew_position,
          origin: flightLeg.origin,
          destination: flightLeg.destination,
          departure_time: flightLeg.departure_time,
          arrival_time: flightLeg.arrival_time,
          flight_duration_minutes: flightLeg.flight_duration_minutes,
          equipment: flightLeg.equipment,
          service_type: flightLeg.service_type,
          meal_type: flightLeg.meal_type,
          updated_at: new Date().toISOString(),
        })
        .eq('user_id', user.id)
        .eq('unique_key', flightLeg.unique_key);

      if (error) {
        updateErrorMessage = error.message;
        break;
      }
    }

    if (updateErrorMessage) {
      return {
        success: true,
        flightsAdded: newFlightLegs.length,
        flights: rosterEntries,
        rows: await fetchFlightMenuRows(supabase, user.id),
        message: `Imported ${newFlightLegs.length} new current/future flight legs, but could not update some existing current/future flight legs: ${updateErrorMessage}.${formatWarnings(warnings)}`,
      };
    }

    const { error: deleteError } = removedFlightKeys.length > 0
      ? await deleteFlightLegsByKeys(adminClient, user.id, removedFlightKeys)
      : { error: null };

    if (deleteError) {
      return {
        success: true,
        flightsAdded: newFlightLegs.length,
        flights: rosterEntries,
        rows: await fetchFlightMenuRows(supabase, user.id),
        message: `Escala atualizada, mas alguns voos atuais/futuros antigos nao foram removidos: ${deleteError.message}.${formatWarnings(warnings)}`,
      };
    }

    const mealPlanUpdatedAt = await fetchCurrentUserMealPlanUpdatedAt(adminClient);
    if (mealPlanUpdatedAt) {
      await markUserMealPlanRefreshed(adminClient, user.id, mealPlanUpdatedAt);
    }

    return {
      success: true,
      flightsAdded: newFlightLegs.length,
      flights: rosterEntries,
      rows: await fetchFlightMenuRows(supabase, user.id),
      mealPlanUpdatedAt,
      message:
        `Escala importada. ${files.length} arquivo${files.length === 1 ? '' : 's'} processado${files.length === 1 ? '' : 's'}, ` +
        `${newFlightLegs.length} novos voos adicionados, ${existingFlightLegs.length} voos existentes atualizados e ${removedFlightKeys.length} voos removidos da escala atual. ` +
        `${pastFlightLegsCount} voo${pastFlightLegsCount === 1 ? '' : 's'} antigo${pastFlightLegsCount === 1 ? '' : 's'} mantido${pastFlightLegsCount === 1 ? '' : 's'} sem alteracao.${formatWarnings(warnings)}`,
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Erro desconhecido durante o envio',
    };
  }
}

export async function refreshCurrentUserMealPlan() {
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();

  if (authError || !user) {
    throw new Error('Não autorizado');
  }

  try {
    const adminClient = createAdminClient();
    const { data: adminProfile, error: adminProfileError } = await adminClient
      .from('profiles')
      .select('id')
      .eq('email', ADMIN_EMAIL)
      .maybeSingle();

    if (adminProfileError) {
      return {
        success: false,
        rows: await fetchFlightMenuRows(supabase, user.id),
        error: `Could not load the admin meal plan owner: ${adminProfileError.message}`,
      };
    }

    if (!adminProfile?.id) {
      return {
        success: false,
        rows: await fetchFlightMenuRows(supabase, user.id),
        error: 'No admin meal plan was found yet.',
      };
    }

    const result = await refreshUserFlightLegMealsFromCurrentMealPlan(adminClient, user.id, adminProfile.id);
    const rows = await fetchFlightMenuRows(supabase, user.id);
    const mealPlanUpdatedAt = await fetchCurrentMealPlanUpdatedAt(adminClient, adminProfile.id);
    if (mealPlanUpdatedAt) {
      await markUserMealPlanRefreshed(adminClient, user.id, mealPlanUpdatedAt);
    }

    return {
      success: true,
      rows,
      mealPlanUpdatedAt,
      message:
        `Servicos atualizados. ${result.matched} voos encontrados no meal plan, ` +
        `${result.notFound} marcados como not found.`,
    };
  } catch (error) {
    return {
      success: false,
      rows: await fetchFlightMenuRows(supabase, user.id),
      error: error instanceof Error ? error.message : 'Erro desconhecido ao atualizar os serviços.',
    };
  }
}

export async function getCurrentMealPlanVersion() {
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();

  if (authError || !user) {
    return { success: false, mealPlanUpdatedAt: null, error: 'Não autorizado' };
  }

  try {
    const adminClient = createAdminClient();
    const { data: adminProfile, error: adminProfileError } = await adminClient
      .from('profiles')
      .select('id')
      .eq('email', ADMIN_EMAIL)
      .maybeSingle();

    if (adminProfileError) {
      return { success: false, mealPlanUpdatedAt: null, error: adminProfileError.message };
    }

    if (!adminProfile?.id) {
      return { success: true, mealPlanUpdatedAt: null };
    }

    return {
      success: true,
      mealPlanUpdatedAt: await fetchCurrentMealPlanUpdatedAt(adminClient, adminProfile.id),
    };
  } catch (error) {
    return {
      success: false,
      mealPlanUpdatedAt: null,
      error: error instanceof Error ? error.message : 'Erro desconhecido ao verificar a versão do meal plan.',
    };
  }
}

function buildUniqueKey(date: string, flightNumber: string, origin: string) {
  return `${normalizeDate(date)}-${normalizeFlightNumber(flightNumber)}-${origin.toUpperCase()}`;
}

function normalizeDate(value: string) {
  const match = value.match(/^(\d{2})-(\d{2})-(\d{4})$/);
  if (match) return `${match[3]}-${match[2]}-${match[1]}`;
  return value;
}

function normalizeFlightNumber(value: string) {
  const digits = value.replace(/\D/g, '');
  return digits.startsWith('3') && digits.length === 5 ? digits.slice(1) : digits;
}

function getRosterFiles(formData: FormData) {
  const multiFiles = formData.getAll('files').filter((value): value is File => value instanceof File);
  const legacyFile = formData.get('file');

  if (multiFiles.length > 0) return multiFiles;
  return legacyFile instanceof File ? [legacyFile] : [];
}

function formatWarnings(warnings: string[]) {
  return warnings.length > 0 ? ` Avisos: ${warnings.join(' ')}` : '';
}

async function fetchExistingKeys(supabase: any, table: string, keys: string[], userId?: string) {
  const existing = new Set<string>();

  for (const chunk of chunkArray([...new Set(keys)], 250)) {
    let query = supabase
      .from(table)
      .select('unique_key')
      .in('unique_key', chunk);

    if (userId) {
      query = query.eq('user_id', userId);
    }

    const { data } = await query;

    data?.forEach((row: { unique_key: string | null }) => {
      if (row.unique_key) existing.add(row.unique_key);
    });
  }

  return existing;
}

async function fetchCurrentAndFutureFlightLegKeys(supabase: any, userId: string, todayIsoDate: string) {
  const keys: string[] = [];
  const pageSize = 1000;
  let from = 0;

  while (true) {
    const { data, error } = await supabase
      .from('flight_leg_details')
      .select('unique_key, departure_time')
      .eq('user_id', userId)
      .range(from, from + pageSize - 1);

    if (error) throw new Error(`Could not load current roster flights: ${error.message}`);
    if (!data?.length) break;

    data.forEach((flightLeg: { unique_key: string | null; departure_time: string | null }) => {
      if (flightLeg.unique_key && isCurrentOrFutureFlightLeg(flightLeg, todayIsoDate)) {
        keys.push(flightLeg.unique_key);
      }
    });

    if (data.length < pageSize) break;
    from += pageSize;
  }

  return keys;
}

async function deleteFlightLegsByKeys(supabase: any, userId: string, keys: string[]) {
  for (const chunk of chunkArray([...new Set(keys)], 250)) {
    const { error } = await supabase
      .from('flight_leg_details')
      .delete()
      .eq('user_id', userId)
      .in('unique_key', chunk);

    if (error) return { error };
  }

  return { error: null };
}

async function fetchCateringByKey(keys: string[]) {
  const supabase = createAdminClient();
  const cateringByKey = new Map<string, CateringRuleRow>();
  const { data: adminProfile } = await supabase
    .from('profiles')
    .select('id')
    .eq('email', ADMIN_EMAIL)
    .maybeSingle();

  for (const chunk of chunkArray([...new Set(keys)], 250)) {
    let query = supabase
      .from('catering_rules')
      .select('unique_key, service_type, meal_type')
      .in('unique_key', chunk);

    if (adminProfile?.id) {
      query = query.eq('user_id', adminProfile.id);
    }

    const { data } = await query;

    data?.forEach((row: CateringRuleRow) => {
      if (row.unique_key) cateringByKey.set(row.unique_key, row);
    });
  }

  return cateringByKey;
}

async function fetchCurrentUserMealPlanUpdatedAt(supabase: any) {
  const { data: adminProfile } = await supabase
    .from('profiles')
    .select('id')
    .eq('email', ADMIN_EMAIL)
    .maybeSingle();

  if (!adminProfile?.id) return null;
  return fetchCurrentMealPlanUpdatedAt(supabase, adminProfile.id);
}

async function markUserMealPlanRefreshed(supabase: any, userId: string, mealPlanUpdatedAt: string) {
  await supabase
    .from('profiles')
    .update({
      last_meal_plan_refreshed_at: mealPlanUpdatedAt,
      updated_at: new Date().toISOString(),
    })
    .eq('id', userId);
}

async function fetchCurrentMealPlanUpdatedAt(supabase: any, adminUserId: string) {
  const { data } = await supabase
    .from('catering_rules')
    .select('updated_at, created_at')
    .eq('user_id', adminUserId)
    .order('updated_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  return data?.updated_at ?? data?.created_at ?? null;
}

async function fetchFlightMenuRows(supabase: Awaited<ReturnType<typeof createClient>>, userId: string) {
  const { data } = await supabase
    .from('flight_leg_details')
    .select('unique_key, flight_number, origin, destination, departure_time, service_type, meal_type')
    .eq('user_id', userId)
    .order('departure_time', { ascending: true });

  return data?.map((flightLeg: any, index: number) => ({
    id: flightLeg.unique_key ?? `${flightLeg.flight_number}-${flightLeg.departure_time}-${index}`,
    date: getFlightLegDate(flightLeg.unique_key, flightLeg.departure_time),
    flightNumber: flightLeg.flight_number ?? '-',
    origin: flightLeg.origin ?? '-',
    destination: flightLeg.destination ?? '-',
    crewService: flightLeg.service_type ?? '-',
    paxService: flightLeg.meal_type ?? '-',
  })) ?? [];
}

function getFlightLegDate(uniqueKey: string | null, departureTime: string | null) {
  const uniqueKeyDate = uniqueKey?.match(/^(\d{4}-\d{2}-\d{2})-/);
  if (uniqueKeyDate) return uniqueKeyDate[1];
  return departureTime ? String(departureTime).slice(0, 10) : '';
}

function chunkArray<T>(items: T[], size: number) {
  const chunks: T[][] = [];
  for (let index = 0; index < items.length; index += size) {
    chunks.push(items.slice(index, index + size));
  }
  return chunks;
}
