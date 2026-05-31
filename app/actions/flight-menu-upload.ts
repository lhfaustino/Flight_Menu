'use server';

import { createClient } from '@/lib/supabase/server';
import { extractPdfText, parseRosterText } from '@/lib/pdf-parsing';
import type { RosterEntry } from '@/lib/pdf-parsing';
import {
  buildFlightDateKey,
  buildUniqueKey,
  fetchFlightMenuRows,
  processCateringPdfBuffer,
  toIsoDate,
  uploadPdfBestEffort,
  upsertByUniqueKey,
} from '@/lib/flight-menu-processing';

type FlightMenuRow = {
  id: string;
  date: string;
  flightNumber: string;
  origin: string;
  destination: string;
  crewService: string;
  paxService: string;
};

type FlightLegUpsertRow = {
  unique_key: string;
  roster_id: string;
  user_id: string;
  flight_number: string;
  origin: string;
  destination: string;
  departure_time: string | null;
  arrival_time: string | null;
  service_type: string | null;
  meal_type: string | null;
};

export async function updateFlightMenu(formData: FormData) {
  const supabase = await createClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    throw new Error('Unauthorized');
  }

  const rosterFile = formData.get('rosterFile') as File | null;
  const cateringFile = formData.get('cateringFile') as File | null;

  if (!rosterFile || !cateringFile) {
    return { success: false, error: 'Select both PDF files before updating.' };
  }

  if (rosterFile.type !== 'application/pdf' || cateringFile.type !== 'application/pdf') {
    return { success: false, error: 'Only PDF files are allowed.' };
  }

  try {
    const [rosterBuffer, cateringBuffer] = await Promise.all([
      fileToBuffer(rosterFile),
      fileToBuffer(cateringFile),
    ]);

    const cateringResult = await processCateringPdfBuffer({
      supabase,
      userId: user.id,
      pdfBuffer: cateringBuffer,
      sourceName: cateringFile.name,
    });

    const rosterText = await extractPdfText(rosterBuffer);
    const rosterEntries = parseRosterText(rosterText);

    if (rosterEntries.length === 0) {
      return { success: false, error: 'No flight data found in roster PDF. Check the format.' };
    }

    const cateringByFlightDate = new Map(
      cateringResult.rules.map((rule) => [buildFlightDateKey(rule.service_date, rule.flight_number), rule])
    );
    const rosterStoragePath = await uploadPdfBestEffort(
      supabase,
      'flight-rosters',
      `${user.id}/${Date.now()}-${rosterFile.name}`,
      rosterBuffer
    );

    const { data: roster, error: rosterError } = await supabase
      .from('flight_rosters')
      .insert({
        user_id: user.id,
        name: rosterFile.name.replace(/\.pdf$/i, ''),
        file_url: rosterStoragePath ?? rosterFile.name,
      })
      .select('id')
      .single();

    if (rosterError || !roster?.id) {
      return {
        success: false,
        error: `Could not create roster record in Supabase: ${rosterError?.message ?? 'Missing roster id'}.`,
      };
    }

    const flightLegRows = buildFlightLegRows({
      userId: user.id,
      rosterId: roster.id,
      rosterEntries,
      cateringByFlightDate,
    });

    const {
      inserted: flightLegsInserted,
      updated: flightLegsUpdated,
      error: flightLegUpsertError,
    } = await upsertByUniqueKey(supabase, 'flight_leg_details', flightLegRows);

    if (flightLegUpsertError) {
      return {
        success: false,
        error:
          `Could not save flight legs to Supabase: ${flightLegUpsertError.message}. ` +
          'Run supabase/repair_flight_schema.sql in Supabase SQL Editor, then try Atualizar again.',
      };
    }

    const savedRows = await fetchFlightMenuRows(supabase, user.id);

    return {
      success: true,
      flights: rosterEntries,
      rules: cateringResult.entries,
      rows: savedRows,
      flightsAdded: flightLegsInserted,
      rulesAdded: cateringResult.rulesInserted,
      message:
        `Atualizado: ${flightLegsInserted} flight legs inserted, ` +
        `${flightLegsUpdated} flight legs updated, ` +
        `${cateringResult.entries.length} catering rows parsed.`,
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error while updating flight menu.',
    };
  }
}

function buildFlightLegRows({
  userId,
  rosterId,
  rosterEntries,
  cateringByFlightDate,
}: {
  userId: string;
  rosterId: string;
  rosterEntries: RosterEntry[];
  cateringByFlightDate: Map<string, { service_type: string; meal_type: string }>;
}) {
  const rowsByUniqueKey = new Map<string, FlightLegUpsertRow>();

  for (const entry of rosterEntries) {
    const flightDate = toIsoDate(entry.date || new Date().toISOString().split('T')[0]);
    const uniqueKey = buildUniqueKey(flightDate, entry.flightNumber, entry.origin);
    const departureTime = new Date(`${flightDate}T${entry.departureTime}:00Z`);
    const arrivalTime = new Date(`${flightDate}T${entry.arrivalTime}:00Z`);
    const catering = cateringByFlightDate.get(buildFlightDateKey(flightDate, entry.flightNumber));

    if (arrivalTime < departureTime) {
      arrivalTime.setDate(arrivalTime.getDate() + 1);
    }

    rowsByUniqueKey.set(uniqueKey, {
      unique_key: uniqueKey,
      roster_id: rosterId,
      user_id: userId,
      flight_number: entry.flightNumber,
      origin: entry.origin,
      destination: entry.destination,
      departure_time: departureTime.toISOString(),
      arrival_time: arrivalTime.toISOString(),
      service_type: catering?.service_type || null,
      meal_type: catering?.meal_type || null,
    });
  }

  return [...rowsByUniqueKey.values()];
}

async function fileToBuffer(file: File) {
  return Buffer.from(await file.arrayBuffer());
}
