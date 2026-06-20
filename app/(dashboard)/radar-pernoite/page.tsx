import { Clock3, MapPin, Radar, UsersRound } from "lucide-react";
import { Avatar } from "@/components/ui/Avatar";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import {
  buildOvernightStays,
  findOvernightRadarMatches,
  type CrewProfileForRadar,
  type FlightLegForStay,
  type OvernightRadarMatch,
} from "@/lib/overnight-radar";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type FlightLegRow = {
  id: string;
  user_id: string;
  flight_number: string | null;
  crew_position: string | null;
  origin: string | null;
  destination: string | null;
  departure_time: string | null;
  arrival_time: string | null;
};

type ProfileRow = {
  id: string;
  full_name: string | null;
  avatar_url: string | null;
};

export default async function RadarPernoitePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const matches = user ? await fetchRadarMatches(user.id) : [];

  return (
    <div className="min-h-screen bg-gray-50 py-8 sm:py-12">
      <div className="mx-auto max-w-6xl px-4">
        <div className="mb-8">
          <div className="mb-4 flex size-12 items-center justify-center rounded-lg bg-brand-50 text-brand-700">
            <Radar className="size-6" />
          </div>
          <h1 className="text-3xl font-bold text-gray-900">Radar do Pernoite</h1>
          <p className="mt-2 max-w-2xl text-gray-600">
            Encontre tripulantes com pernoite no mesmo local quando houver pelo menos 6 horas continuas de sobreposicao.
          </p>
        </div>

        <section className="mb-5 grid gap-4 md:grid-cols-3">
          <Metric icon={UsersRound} label="Tripulantes encontrados" value={String(matches.length)} />
          <Metric icon={Clock3} label="Sobreposicao minima" value="6 h" />
          <Metric icon={MapPin} label="Base do radar" value="Sua escala importada" />
        </section>

        {matches.length > 0 ? (
          <section className="grid gap-4">
            {matches.map((match) => (
              <RadarMatchCard key={match.userId} match={match} />
            ))}
          </section>
        ) : (
          <section className="rounded-lg border border-dashed border-gray-300 bg-white px-6 py-12 text-center shadow-sm">
            <Radar className="mx-auto mb-3 size-8 text-gray-300" />
            <h2 className="font-semibold text-gray-900">No crew members found for this overnight.</h2>
            <p className="mt-1 text-sm text-gray-500">
              Importe ou atualize sua escala para comparar pernoites futuros com outros tripulantes.
            </p>
          </section>
        )}
      </div>
    </div>
  );
}

async function fetchRadarMatches(currentUserId: string): Promise<OvernightRadarMatch[]> {
  const adminClient = createAdminClient();

  const [{ data: flightRows, error: flightError }, { data: profileRows, error: profileError }] = await Promise.all([
    adminClient
      .from("flight_leg_details")
      .select("id, user_id, flight_number, crew_position, origin, destination, departure_time, arrival_time")
      .not("departure_time", "is", null)
      .not("arrival_time", "is", null)
      .order("user_id", { ascending: true })
      .order("departure_time", { ascending: true }),
    adminClient.from("profiles").select("id, full_name, avatar_url"),
  ]);

  if (flightError) throw new Error(`Could not load roster data: ${flightError.message}`);
  if (profileError) throw new Error(`Could not load crew profiles: ${profileError.message}`);

  const stays = buildOvernightStays(
    ((flightRows ?? []) as FlightLegRow[]).map(
      (row): FlightLegForStay => ({
        id: row.id,
        userId: row.user_id,
        flightNumber: row.flight_number,
        crewPosition: row.crew_position,
        origin: row.origin,
        destination: row.destination,
        departureTime: row.departure_time,
        arrivalTime: row.arrival_time,
      }),
    ),
  );
  const profiles = ((profileRows ?? []) as ProfileRow[]).map(
    (row): CrewProfileForRadar => ({
      userId: row.id,
      name: row.full_name,
      avatarUrl: row.avatar_url,
    }),
  );

  return findOvernightRadarMatches({
    currentUserId,
    stays,
    profiles,
  });
}

function RadarMatchCard({ match }: { match: OvernightRadarMatch }) {
  return (
    <article className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm sm:p-5">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex min-w-0 items-center gap-3">
          <Avatar size="lg" src={match.avatarUrl} initials={getInitials(match.name)} alt={match.name} />
          <div className="min-w-0">
            <h2 className="truncate text-base font-semibold text-gray-900">{match.name}</h2>
            {match.role ? <p className="mt-0.5 text-sm text-gray-500">{match.role}</p> : null}
            <p className="mt-1 inline-flex items-center gap-1 text-sm font-semibold text-brand-700">
              <MapPin className="size-4" />
              {match.location}
            </p>
          </div>
        </div>

        <div className="shrink-0 rounded-lg bg-brand-50 px-3 py-2 text-left sm:text-right">
          <p className="text-xs font-semibold uppercase text-brand-700">Sobreposicao</p>
          <p className="text-lg font-semibold text-brand-900">{formatOverlapHours(match.overlapHours)}</p>
        </div>
      </div>

      <div className="mt-4 grid gap-3 border-t border-gray-100 pt-4 sm:grid-cols-2">
        <TimeBlock label="Chegada" value={match.arrivalTime} />
        <TimeBlock label="Saida" value={match.departureTime} />
      </div>
    </article>
  );
}

function Metric({ icon: Icon, label, value }: { icon: React.ElementType; label: string; value: string }) {
  return (
    <div className="rounded-lg border border-gray-200 bg-white p-5 shadow-sm">
      <div className="mb-4 flex size-10 items-center justify-center rounded-lg bg-brand-50 text-brand-700">
        <Icon className="size-5" />
      </div>
      <p className="text-sm font-medium text-gray-500">{label}</p>
      <p className="mt-1 truncate text-2xl font-semibold text-gray-900">{value}</p>
    </div>
  );
}

function TimeBlock({ label, value }: { label: string; value: Date }) {
  return (
    <div className="rounded-lg border border-gray-100 bg-gray-50 px-3 py-2">
      <p className="text-xs font-semibold uppercase text-gray-500">{label}</p>
      <p className="mt-1 text-sm font-semibold text-gray-900">{formatDateTime(value)}</p>
    </div>
  );
}

function getInitials(name: string) {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");
}

function formatOverlapHours(value: number) {
  return `${value.toLocaleString("pt-BR", { minimumFractionDigits: 1, maximumFractionDigits: 1 })} h`;
}

function formatDateTime(value: Date) {
  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(value);
}
