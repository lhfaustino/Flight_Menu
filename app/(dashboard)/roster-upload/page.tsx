import { FlightMenuUploadWorkspace } from '@/components/features/flight-menu/FlightMenuUploadWorkspace';
import { createClient } from '@/lib/supabase/server';

export default async function RosterUploadPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: flightLegs } = user
    ? await supabase
        .from('flight_leg_details')
        .select('unique_key, flight_number, origin, destination, departure_time, service_type, meal_type')
        .eq('user_id', user.id)
        .order('departure_time', { ascending: true })
    : { data: [] };

  const initialRows =
    flightLegs?.map((flightLeg, index) => ({
      id: flightLeg.unique_key ?? `${flightLeg.flight_number}-${flightLeg.departure_time}-${index}`,
      date: getIsoDate(flightLeg.departure_time),
      flightNumber: flightLeg.flight_number ?? '-',
      origin: flightLeg.origin ?? '-',
      destination: flightLeg.destination ?? '-',
      crewService: flightLeg.service_type ?? '-',
      paxService: flightLeg.meal_type ?? '-',
    })) ?? [];

  return (
    <div className="min-h-screen bg-gray-50 py-12">
      <div className="mx-auto max-w-6xl px-4">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Planilha de Serviços</h1>
          <p className="mt-2 text-gray-600">Envie os arquivos (escala e planilha de alimentação)</p>
        </div>
        
        <FlightMenuUploadWorkspace initialRows={initialRows} />
      </div>
    </div>
  );
}

function getIsoDate(value: string | null) {
  if (!value) return '';
  return value.slice(0, 10);
}
