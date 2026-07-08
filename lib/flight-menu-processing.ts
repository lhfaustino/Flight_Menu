import { extractPdfText, parseCateringText } from "@/lib/pdf-parsing";

export const MEAL_PLAN_NOT_FOUND = "not found";

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

type FlightLegMealRefreshRow = {
    id: string;
    unique_key: string | null;
    flight_number: string | null;
    origin: string | null;
    departure_time: string | null;
};

export async function processCateringPdfBuffer({
    supabase,
    userId,
    pdfBuffer,
    sourceName,
    refreshAllFlightLegs = false,
}: {
    supabase: SupabaseLike;
    userId: string;
    pdfBuffer: Buffer;
    sourceName?: string;
    refreshAllFlightLegs?: boolean;
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

    const { inserted: rulesInserted, deleted: rulesDeleted, error: rulesError } = await replaceCateringRulesForUser(
        supabase,
        userId,
        cateringRules
    );

    if (rulesError) {
        throw new Error(`Could not save catering rules: ${rulesError.message}`);
    }

    const {
        updated: flightLegsUpdated,
        matched: flightLegsMatched,
        notFound: flightLegsNotFound,
        error: flightLegUpdateError,
    } = await refreshExistingFlightLegMeals(
        supabase,
        refreshAllFlightLegs ? undefined : userId,
        cateringRules
    );

    if (flightLegUpdateError) {
        throw new Error(`Could not update existing flight legs: ${flightLegUpdateError.message}`);
    }

    return {
        entries: cateringEntries,
        rules: cateringRules,
        rulesInserted,
        rulesDeleted,
        rulesUpdated: 0,
        flightLegsCleared: flightLegsNotFound,
        flightLegsMatched,
        flightLegsNotFound,
        flightLegsUpdated,
        message:
            `${sourceName ? `${sourceName}: ` : ""}` +
            `${cateringEntries.length} catering rows parsed, ` +
            `${rulesDeleted} previous rules deleted, ${rulesInserted} new rules inserted, ` +
            `${flightLegsMatched} existing roster flights matched, ${flightLegsNotFound} marked not found.`,
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

export async function refreshUserFlightLegMealsFromCurrentMealPlan(
    supabase: SupabaseLike,
    userId: string,
    mealPlanUserId: string
) {
    const cateringRules = await fetchCateringRulesForUser(supabase, mealPlanUserId);
    return refreshExistingFlightLegMeals(supabase, userId, cateringRules);
}

export async function refreshUserFlightLegMealsIfMealPlanChanged(
    supabase: SupabaseLike,
    userId: string,
    mealPlanUserId: string
) {
    const [latestMealPlanUpdate, oldestUserFlightUpdate] = await Promise.all([
        fetchLatestMealPlanUpdatedAt(supabase, mealPlanUserId),
        fetchOldestUserFlightLegUpdatedAt(supabase, userId),
    ]);

    if (!latestMealPlanUpdate || !oldestUserFlightUpdate) {
        return { skipped: true, reason: "missing-meal-plan-or-roster" };
    }

    if (new Date(oldestUserFlightUpdate).getTime() >= new Date(latestMealPlanUpdate).getTime()) {
        return { skipped: true, reason: "already-current" };
    }

    const result = await refreshUserFlightLegMealsFromCurrentMealPlan(supabase, userId, mealPlanUserId);
    return { skipped: false, reason: "meal-plan-changed", ...result };
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

export async function replaceCateringRulesForUser(
    supabase: SupabaseLike,
    userId: string,
    rows: CateringRuleRow[]
) {
    const seen = new Set<string>();
    const uniqueRows = rows.filter((row) => {
        if (seen.has(row.unique_key)) return false;
        seen.add(row.unique_key);
        return true;
    });

    const { count: deleted, error: deleteError } = await supabase
        .from("catering_rules")
        .delete({ count: "exact" })
        .eq("user_id", userId);

    if (deleteError) return { inserted: 0, deleted: 0, error: deleteError };
    if (!uniqueRows.length) return { inserted: 0, deleted: deleted ?? 0, error: null };

    const { error: insertError } = await supabase.from("catering_rules").insert(uniqueRows);
    if (insertError) return { inserted: 0, deleted: deleted ?? 0, error: insertError };

    return { inserted: uniqueRows.length, deleted: deleted ?? 0, error: null };
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

export function getCurrentDateInSaoPaulo() {
    const parts = new Intl.DateTimeFormat("en-CA", {
        timeZone: "America/Sao_Paulo",
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
    }).formatToParts(new Date());
    const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));

    return `${values.year}-${values.month}-${values.day}`;
}

export function isCurrentOrFutureFlightLeg(
    flightLeg: Pick<FlightLegMealRefreshRow, "unique_key" | "departure_time">,
    todayIsoDate = getCurrentDateInSaoPaulo()
) {
    const flightDate = getFlightLegDate(flightLeg.unique_key, flightLeg.departure_time);
    return !flightDate || flightDate >= todayIsoDate;
}

async function refreshExistingFlightLegMeals(
    supabase: SupabaseLike,
    userId: string | undefined,
    cateringRules: CateringRuleRow[]
) {
    const rulesByUniqueKey = new Map(cateringRules.map((rule) => [rule.unique_key, rule]));
    const rulesByDateFlight = new Map<string, CateringRuleRow>();

    for (const rule of cateringRules) {
        const dateFlightKey = buildFlightDateKey(rule.service_date, rule.flight_number);
        if (!rulesByDateFlight.has(dateFlightKey)) {
            rulesByDateFlight.set(dateFlightKey, rule);
        }
    }

    const todayIsoDate = getCurrentDateInSaoPaulo();
    const flightLegs = await fetchFlightLegRowsForMealRefresh(supabase, userId, todayIsoDate);
    let updated = 0;
    let matched = 0;
    let notFound = 0;

    for (const flightLeg of flightLegs) {
        const rule = findMatchingCateringRule(flightLeg, rulesByUniqueKey, rulesByDateFlight);
        const nextServiceType = rule?.service_type ?? MEAL_PLAN_NOT_FOUND;
        const nextMealType = rule?.meal_type ?? MEAL_PLAN_NOT_FOUND;

        const { error } = await supabase
            .from("flight_leg_details")
            .update({
                service_type: nextServiceType,
                meal_type: nextMealType,
                updated_at: new Date().toISOString(),
            })
            .eq("id", flightLeg.id);

        if (error) return { updated, matched, notFound, error };
        updated += 1;
        if (rule) {
            matched += 1;
        } else {
            notFound += 1;
        }
    }

    return { updated, matched, notFound, error: null };
}

async function fetchFlightLegRowsForMealRefresh(
    supabase: SupabaseLike,
    userId: string | undefined,
    todayIsoDate: string
) {
    const rows: FlightLegMealRefreshRow[] = [];
    const pageSize = 1000;
    let from = 0;

    while (true) {
        let query = supabase
            .from("flight_leg_details")
            .select("id, unique_key, flight_number, origin, departure_time")
            .range(from, from + pageSize - 1);

        if (userId) {
            query = query.eq("user_id", userId);
        }

        const { data, error } = await query;
        if (error) throw new Error(`Could not load previous roster flights: ${error.message}`);
        if (!data?.length) break;

        rows.push(
            ...data.filter((flightLeg: FlightLegMealRefreshRow) =>
                isCurrentOrFutureFlightLeg(flightLeg, todayIsoDate)
            )
        );
        if (data.length < pageSize) break;
        from += pageSize;
    }

    return rows;
}

async function fetchCateringRulesForUser(supabase: SupabaseLike, userId: string) {
    const rows: CateringRuleRow[] = [];
    const pageSize = 1000;
    let from = 0;

    while (true) {
        const { data, error } = await supabase
            .from("catering_rules")
            .select(
                "unique_key, user_id, flight_number, service_date, origin_iata, destination_iata, service_type, meal_type, priority"
            )
            .eq("user_id", userId)
            .range(from, from + pageSize - 1);

        if (error) throw new Error(`Could not load current meal plan: ${error.message}`);
        if (!data?.length) break;

        rows.push(...data);
        if (data.length < pageSize) break;
        from += pageSize;
    }

    return rows;
}

async function fetchLatestMealPlanUpdatedAt(supabase: SupabaseLike, userId: string) {
    const { data, error } = await supabase
        .from("catering_rules")
        .select("updated_at")
        .eq("user_id", userId)
        .order("updated_at", { ascending: false })
        .limit(1)
        .maybeSingle();

    if (error) throw new Error(`Could not check current meal plan version: ${error.message}`);
    return data?.updated_at ?? null;
}

async function fetchOldestUserFlightLegUpdatedAt(supabase: SupabaseLike, userId: string) {
    const { data, error } = await supabase
        .from("flight_leg_details")
        .select("updated_at")
        .eq("user_id", userId)
        .order("updated_at", { ascending: true })
        .limit(1)
        .maybeSingle();

    if (error) throw new Error(`Could not check user roster version: ${error.message}`);
    return data?.updated_at ?? null;
}

function findMatchingCateringRule(
    flightLeg: FlightLegMealRefreshRow,
    rulesByUniqueKey: Map<string, CateringRuleRow>,
    rulesByDateFlight: Map<string, CateringRuleRow>
) {
    if (flightLeg.unique_key) {
        const exactRule = rulesByUniqueKey.get(flightLeg.unique_key);
        if (exactRule) return exactRule;
    }

    const flightDate = getFlightLegDate(flightLeg.unique_key, flightLeg.departure_time);
    if (flightDate && flightLeg.flight_number && flightLeg.origin) {
        const rebuiltKey = buildUniqueKey(flightDate, flightLeg.flight_number, flightLeg.origin);
        const exactRule = rulesByUniqueKey.get(rebuiltKey);
        if (exactRule) return exactRule;
    }

    if (flightDate && flightLeg.flight_number) {
        return rulesByDateFlight.get(buildFlightDateKey(flightDate, flightLeg.flight_number));
    }

    return undefined;
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
    const uniqueKeyDate = uniqueKey?.match(/^(\d{4}-\d{2}-\d{2})-/);
    if (uniqueKeyDate) return uniqueKeyDate[1];
    if (departureTime) return departureTime.slice(0, 10);
    return "";
}

function chunkArray<T>(items: T[], size: number) {
    const chunks: T[][] = [];
    for (let index = 0; index < items.length; index += size) {
        chunks.push(items.slice(index, index + size));
    }
    return chunks;
}
