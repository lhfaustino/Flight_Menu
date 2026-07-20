import { InicioDashboard, type InicioFlightRow } from "@/components/features/inicio/InicioDashboard";
import { createClient } from "@/lib/supabase/server";

export default async function InicioPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const rows = user ? await fetchInicioRows(supabase, user.id) : [];

  return (
    <div className="min-h-screen bg-gray-50 py-12">
      <div className="mx-auto max-w-6xl px-4">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Início</h1>
          <p className="mt-2 text-gray-600">
            Acompanhe horas voadas, destinos, equipamentos e folgas da sua escala.
          </p>
        </div>

        <InicioDashboard rows={rows} />
      </div>
    </div>
  );
}

async function fetchInicioRows(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string
): Promise<InicioFlightRow[]> {
  const { data } = await supabase
    .from("flight_leg_details")
    .select(
      "id, unique_key, flight_number, crew_position, origin, destination, departure_time, arrival_time, flight_duration_minutes, equipment"
    )
    .eq("user_id", userId)
    .order("departure_time", { ascending: true, nullsFirst: false });

  return (
    data?.map((row: any, index: number) => {
      const departureTime = row.departure_time ? String(row.departure_time) : null;
      const arrivalTime = row.arrival_time ? String(row.arrival_time) : null;
      const date = getFlightDate(row.unique_key, departureTime);

      return {
        id: row.id ?? row.unique_key ?? `${row.flight_number}-${index}`,
        date,
        year: date.slice(0, 4),
        flightNumber: row.flight_number ?? "-",
        isRosterActivity: row.crew_position === "ROSTER_ACTIVITY",
        origin: row.origin ?? "-",
        destination: row.destination ?? "-",
        departureTime,
        arrivalTime,
        flightDurationMinutes:
          typeof row.flight_duration_minutes === "number"
            ? row.flight_duration_minutes
            : calculateDurationMinutes(departureTime, arrivalTime),
        equipment: normalizeEquipment(row.equipment),
      };
    }) ?? []
  );
}

function normalizeEquipment(value: string | null) {
  const equipment = value?.trim().toUpperCase();
  return equipment || "Não informado";
}

function getFlightDate(uniqueKey: string | null, departureTime: string | null) {
  const uniqueKeyDate = uniqueKey?.match(/^(\d{4}-\d{2}-\d{2})-/);
  if (uniqueKeyDate) return uniqueKeyDate[1];
  return departureTime?.slice(0, 10) ?? "";
}

function calculateDurationMinutes(departureTime: string | null, arrivalTime: string | null) {
  if (!departureTime || !arrivalTime) return 0;

  const departure = new Date(departureTime).getTime();
  const arrival = new Date(arrivalTime).getTime();
  if (!Number.isFinite(departure) || !Number.isFinite(arrival)) return 0;

  return Math.max(0, Math.round((arrival - departure) / 60000));
}
