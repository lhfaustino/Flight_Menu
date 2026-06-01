'use server';

import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { ADMIN_EMAIL } from '@/lib/admin-access';
import { extractPdfText, parseRosterText } from '@/lib/pdf-parsing';

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
    const [existingKeys, cateringByKey] = await Promise.all([
      fetchExistingKeys(supabase, 'flight_leg_details', rosterKeys),
      fetchCateringByKey(rosterKeys),
    ]);

    // 6. Insert parsed flight legs into database
    const flightLegs = rosterEntries.map(entry => {
      const flightDate = entry.date || new Date().toISOString().split('T')[0];
      const departureTime = new Date(`${flightDate}T${entry.departureTime}:00Z`);
      const arrivalTime = new Date(`${flightDate}T${entry.arrivalTime}:00Z`);
      const uniqueKey = buildUniqueKey(flightDate, entry.flightNumber, entry.origin);
      const catering = cateringByKey.get(uniqueKey);
      
      // Handle overnight flights
      if (arrivalTime < departureTime) {
        arrivalTime.setDate(arrivalTime.getDate() + 1);
      }
      
      return {
        unique_key: uniqueKey,
        roster_id: roster.id,
        user_id: user.id,
        flight_number: entry.flightNumber,
        crew_position: entry.crewPosition || null,
        origin: entry.origin,
        destination: entry.destination,
        departure_time: departureTime.toISOString(),
        arrival_time: arrivalTime.toISOString(),
        service_type: catering?.service_type || null,
        meal_type: catering?.meal_type || null,
      };
    }).filter((flightLeg) => !existingKeys.has(flightLeg.unique_key));

    if (flightLegs.length === 0) {
      return {
        success: true,
        rosterId: roster.id,
        flightsAdded: 0,
        flights: rosterEntries,
        rows: await fetchFlightMenuRows(supabase, user.id),
        message: `No new flight legs imported. ${rosterEntries.length} duplicate records were discarded.${storageWarning}`,
      };
    }
    
    const { error: insertError } = await supabase
      .from('flight_leg_details')
      .insert(flightLegs);
    
    if (insertError) {
      return {
        success: true,
        rosterId: roster.id,
        flightsAdded: flightLegs.length,
        flights: rosterEntries,
        rows: await fetchFlightMenuRows(supabase, user.id),
        message: `Parsed ${rosterEntries.length} flight legs, but could not save flight legs: ${insertError.message}.${storageWarning}`,
      };
    }
    
    return {
      success: true,
      rosterId: roster.id,
      flightsAdded: flightLegs.length,
      flights: rosterEntries,
      rows: await fetchFlightMenuRows(supabase, user.id),
      message: `Successfully imported ${flightLegs.length} flight legs. ${rosterEntries.length - flightLegs.length} duplicate records were discarded.${storageWarning}`,
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
