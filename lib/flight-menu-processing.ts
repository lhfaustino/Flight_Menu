import { extractPdfText, parseCateringText } from "@/lib/pdf-parsing";

type SupabaseLike = {
    from: (table: string) => any;
    storage: {
        from: (bucket: string) => any;
    };
};

type CateringRuleRow = {
    unique_key: string;
    user_id: string;
    flight_number: string;
    service_date: string;
    origin_iata: string | null;
    destination_iata: string | null;
    service_type: string;
    meal_type: string;
    priority: number;
};

export async function processCateringPdfBuffer({
    supabase,
    userId,
    pdfBuffer,
    sourceName,
}: {
    supabase: SupabaseLike;
    userId: string;
    pdfBuffer: Buffer;
    sourceName?: string;
}) {
    const cateringText = await extractPdfText(pdfBuffer);
    const cateringEntries = parseCateringText(cateringText);

    if (cateringEntries.length === 0) {
        throw new Error("No catering data found in catering PDF. Check the format.");
    }

    const cateringRules: CateringRuleRow[] = cateringEntries.map((entry) => ({
        unique_key: buildUniqueKey(entry.date, entry.flightNumber, entry.origin),
        user_id: userId,
        flight_number: entry.flightNumber,
        service_date: toIsoDate(entry.date),
        origin_iata: entry.origin || null,
        destination_iata: entry.destination || null,
        service_type: entry.crewService || "Standard",
        meal_type: entry.paxService || "Meal",
        priority: 1,
    }));

    const { inserted: rulesInserted, updated: rulesUpdated, error: rulesError } = await upsertByUniqueKey(
        supabase,
        "catering_rules",
        cateringRules
    );

    if (rulesError) {
        throw new Error(`Could not save catering rules: ${rulesError.message}`);
    }

    const { updated: flightLegsUpdated, error: flightLegUpdateError } = await updateExistingFlightLegMeals(
        supabase,
        userId,
        cateringRules
    );

    if (flightLegUpdateError) {
        throw new Error(`Could not update existing flight legs: ${flightLegUpdateError.message}`);
    }

    return {
        entries: cateringEntries,
        rules: cateringRules,
        rulesInserted,
        rulesUpdated,
        flightLegsUpdated,
        message:
            `${sourceName ? `${sourceName}: ` : ""}` +
            `${cateringEntries.length} catering rows parsed, ` +
            `${rulesInserted} inserted, ${rulesUpdated} updated, ` +
            `${flightLegsUpdated} existing flight legs updated.`,
    };
}

export async function fetchFlightMenuRows(supabase: SupabaseLike, userId: string) {
    const { data } = await supabase
        .from("flight_leg_details")
        .select("unique_key, flight_number, origin, destination, departure_time, service_type, meal_type")
        .eq("user_id", userId)
        .order("departure_time", { ascending: true, nullsFirst: false });

    return (
        data?.map((flightLeg: any, index: number) => ({
            id: flightLeg.unique_key ?? `${flightLeg.flight_number}-${flightLeg.departure_time}-${index}`,
            date: getFlightLegDate(flightLeg.unique_key, flightLeg.departure_time),
            flightNumber: flightLeg.flight_number ?? "-",
            origin: flightLeg.origin ?? "-",
            destination: flightLeg.destination ?? "-",
            crewService: flightLeg.service_type ?? "-",
            paxService: flightLeg.meal_type ?? "-",
        })) ?? []
    );
}

export async function uploadPdfBestEffort(
    supabase: SupabaseLike,
    bucket: string,
    path: string,
    buffer: Buffer
) {
    const { error } = await supabase.storage.from(bucket).upload(path, buffer, {
        contentType: "application/pdf",
    });

    if (error) return null;
    return `${bucket}/${path}`;
}

export async function upsertByUniqueKey<T extends { unique_key: string; user_id: string }>(
    supabase: SupabaseLike,
    table: string,
    rows: T[]
) {
    const userId = rows[0]?.user_id;
    const existingKeys = userId
        ? await fetchExistingKeys(supabase, table, userId, rows.map((row) => row.unique_key))
        : new Set<string>();
    const seen = new Set<string>();
    const uniqueRows = rows.filter((row) => {
        if (seen.has(row.unique_key)) return false;
        seen.add(row.unique_key);
        return true;
    });
    const rowsToInsert = uniqueRows.filter((row) => !existingKeys.has(row.unique_key));
    const rowsToUpdate = uniqueRows.filter((row) => existingKeys.has(row.unique_key));

    if (rowsToInsert.length) {
        const { error } = await supabase.from(table).insert(rowsToInsert);
        if (error) return { inserted: 0, updated: 0, error };
    }

    for (const row of rowsToUpdate) {
        const { error } = await supabase
            .from(table)
            .update(row)
            .eq("user_id", row.user_id)
            .eq("unique_key", row.unique_key);
        if (error) return { inserted: rowsToInsert.length, updated: 0, error };
    }

    return { inserted: rowsToInsert.length, updated: rowsToUpdate.length, error: null };
}

export function buildUniqueKey(date: string, flightNumber: string, origin: string) {
    return `${toIsoDate(date)}-${normalizeFlightNumber(flightNumber)}-${origin.toUpperCase()}`;
}

export function buildFlightDateKey(date: string, flightNumber: string) {
    return `${toIsoDate(date)}-${normalizeFlightNumber(flightNumber)}`;
}

export function toIsoDate(value: string) {
    const brazilMatch = value.match(/^(\d{2})-(\d{2})-(\d{4})$/);
    if (brazilMatch) return `${brazilMatch[3]}-${brazilMatch[2]}-${brazilMatch[1]}`;
    return value;
}

export function normalizeFlightNumber(value: string) {
    const digits = value.replace(/\D/g, "");
    return digits.startsWith("3") && digits.length === 5 ? digits.slice(1) : digits;
}

async function updateExistingFlightLegMeals(
    supabase: SupabaseLike,
    userId: string,
    cateringRules: CateringRuleRow[]
) {
    let updated = 0;

    for (const rule of cateringRules) {
        const { data, error } = await supabase
            .from("flight_leg_details")
            .update({
                service_type: rule.service_type,
                meal_type: rule.meal_type,
                updated_at: new Date().toISOString(),
            })
            .eq("user_id", userId)
            .eq("flight_number", rule.flight_number)
            .gte("departure_time", `${rule.service_date}T00:00:00.000Z`)
            .lt("departure_time", `${rule.service_date}T23:59:59.999Z`)
            .select("id");

        if (error) return { updated, error };
        updated += data?.length ?? 0;
    }

    return { updated, error: null };
}

async function fetchExistingKeys(supabase: SupabaseLike, table: string, userId: string, keys: string[]) {
    const existing = new Set<string>();

    for (const chunk of chunkArray([...new Set(keys)], 250)) {
        const { data } = await supabase
            .from(table)
            .select("unique_key")
            .eq("user_id", userId)
            .in("unique_key", chunk);

        data?.forEach((row: { unique_key: string | null }) => {
            if (row.unique_key) existing.add(row.unique_key);
        });
    }

    return existing;
}

function getFlightLegDate(uniqueKey: string | null, departureTime: string | null) {
    if (departureTime) return departureTime.slice(0, 10);
    const uniqueKeyDate = uniqueKey?.match(/^(\d{4}-\d{2}-\d{2})-/);
    return uniqueKeyDate?.[1] ?? "";
}

function chunkArray<T>(items: T[], size: number) {
    const chunks: T[][] = [];
    for (let index = 0; index < items.length; index += size) {
        chunks.push(items.slice(index, index + size));
    }
    return chunks;
}
