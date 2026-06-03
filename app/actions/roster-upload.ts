'use server';

import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { ADMIN_EMAIL } from '@/lib/admin-access';
import { extractPdfText, parseRosterText } from '@/lib/pdf-parsing';
import { MEAL_PLAN_NOT_FOUND } from '@/lib/flight-menu-processing';

type CateringRuleRow = {
  unique_key: string;
  service_type: string | null;
  meal_type: string | null;
};

export async function uploadRoster(formData: FormData) {
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
    
    // 3. Parse roster entries
    const rosterEntries = parseRosterText(pdfText);
    
    if (rosterEntries.length === 0) {
      throw new Error('No flight data found in PDF. Check the format.');
    }
    
    // 4. Upload PDF to Supabase Storage
    const fileName = `${user.id}/${Date.now()}-${file.name}`;
    const { error: uploadError } = await supabase.storage
      .from('flight-rosters')
      .upload(fileName, pdfBuffer, {
        contentType: 'application/pdf',
      });

    const storageWarning = uploadError
      ? ` PDF file was parsed, but not saved to Storage: ${uploadError.message}`
      : '';
    
    // 5. Create roster record in database
    const { data: roster, error: rosterError } = await supabase
      .from('flight_rosters')
      .insert({
        user_id: user.id,
        name: file.name.replace('.pdf', ''),
        file_url: uploadError ? file.name : `flight-rosters/${fileName}`,
      })
      .select('id')
      .single();
    
    if (rosterError) {
      return {
        success: true,
        flightsAdded: rosterEntries.length,
        flights: rosterEntries,
        message: `Parsed ${rosterEntries.length} flight legs, but could not save the roster record: ${rosterError.message}.${storageWarning}`,
      };
    }
    
    const rosterKeys = rosterEntries.map((entry) =>
      buildUniqueKey(entry.date || new Date().toISOString().split('T')[0], entry.flightNumber, entry.origin)
    );
    const adminClient = createAdminClient();
    const [existingKeys, existingUserKeys, cateringByKey] = await Promise.all([
      fetchExistingKeys(adminClient, 'flight_leg_details', rosterKeys, user.id),
      fetchUserFlightLegKeys(adminClient, user.id),
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
        roster_id: roster.id,
        user_id: user.id,
        flight_number: entry.flightNumber,
        crew_position: entry.crewPosition || null,
        origin: entry.origin,
        destination: entry.destination,
        departure_time: departureTime.toISOString(),
        arrival_time: arrivalTime.toISOString(),
        service_type: catering?.service_type || MEAL_PLAN_NOT_FOUND,
        meal_type: catering?.meal_type || MEAL_PLAN_NOT_FOUND,
      });
    });

    const flightLegs = Array.from(flightLegsByKey.values());
    const incomingKeys = new Set(flightLegsByKey.keys());
    const newFlightLegs = flightLegs.filter((flightLeg) => !existingKeys.has(flightLeg.unique_key));
    const existingFlightLegs = flightLegs.filter((flightLeg) => existingKeys.has(flightLeg.unique_key));
    const staleKeys = [...existingUserKeys].filter((key) => !incomingKeys.has(key));

    const { error: insertError } = newFlightLegs.length > 0
      ? await adminClient
          .from('flight_leg_details')
          .insert(newFlightLegs)
      : { error: null };
    
    if (insertError) {
      return {
        success: true,
        rosterId: roster.id,
        flightsAdded: 0,
        flights: rosterEntries,
        rows: await fetchFlightMenuRows(supabase, user.id),
        message: `Parsed ${rosterEntries.length} flight legs, but could not save new flight legs: ${insertError.message}.${storageWarning}`,
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
        rosterId: roster.id,
        flightsAdded: newFlightLegs.length,
        flights: rosterEntries,
        rows: await fetchFlightMenuRows(supabase, user.id),
        message: `Imported ${newFlightLegs.length} new flight legs, but could not update some existing flight legs: ${updateErrorMessage}.${storageWarning}`,
      };
    }

    let deleteErrorMessage: string | null = null;
    let flightsDeleted = 0;
    for (const chunk of chunkArray(staleKeys, 250)) {
      const { error, count } = await adminClient
        .from('flight_leg_details')
        .delete({ count: 'exact' })
        .eq('user_id', user.id)
        .in('unique_key', chunk);

      if (error) {
        deleteErrorMessage = error.message;
        break;
      }

      flightsDeleted += count ?? chunk.length;
    }

    if (deleteErrorMessage) {
      return {
        success: true,
        rosterId: roster.id,
        flightsAdded: newFlightLegs.length,
        flights: rosterEntries,
        rows: await fetchFlightMenuRows(supabase, user.id),
        message: `Imported ${newFlightLegs.length} new flight legs and updated ${existingFlightLegs.length} existing flight legs, but could not delete removed flights: ${deleteErrorMessage}.${storageWarning}`,
      };
    }
    
    return {
      success: true,
      rosterId: roster.id,
      flightsAdded: newFlightLegs.length,
      flights: rosterEntries,
      rows: await fetchFlightMenuRows(supabase, user.id),
      message: `Roster synced successfully. ${newFlightLegs.length} new flight legs added, ${existingFlightLegs.length} existing flight legs updated, and ${flightsDeleted} removed flight legs deleted.${storageWarning}`,
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error during upload',
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

async function fetchUserFlightLegKeys(supabase: any, userId: string) {
  const existing = new Set<string>();
  let from = 0;
  const pageSize = 1000;

  while (true) {
    const { data, error } = await supabase
      .from('flight_leg_details')
      .select('unique_key')
      .eq('user_id', userId)
      .not('unique_key', 'is', null)
      .range(from, from + pageSize - 1);

    if (error) {
      throw new Error(`Could not load existing flight legs: ${error.message}`);
    }

    if (!data || data.length === 0) break;

    data.forEach((row: { unique_key: string | null }) => {
      if (row.unique_key) existing.add(row.unique_key);
    });

    if (data.length < pageSize) break;
    from += pageSize;
  }

  return existing;
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

async function fetchFlightMenuRows(supabase: Awaited<ReturnType<typeof createClient>>, userId: string) {
  const { data } = await supabase
    .from('flight_leg_details')
    .select('unique_key, flight_number, origin, destination, departure_time, service_type, meal_type')
    .eq('user_id', userId)
    .order('departure_time', { ascending: true });

  return data?.map((flightLeg: any, index: number) => ({
    id: flightLeg.unique_key ?? `${flightLeg.flight_number}-${flightLeg.departure_time}-${index}`,
    date: flightLeg.departure_time ? String(flightLeg.departure_time).slice(0, 10) : '',
    flightNumber: flightLeg.flight_number ?? '-',
    origin: flightLeg.origin ?? '-',
    destination: flightLeg.destination ?? '-',
    crewService: flightLeg.service_type ?? '-',
    paxService: flightLeg.meal_type ?? '-',
  })) ?? [];
}

function chunkArray<T>(items: T[], size: number) {
  const chunks: T[][] = [];
  for (let index = 0; index < items.length; index += size) {
    chunks.push(items.slice(index, index + size));
  }
  return chunks;
}
