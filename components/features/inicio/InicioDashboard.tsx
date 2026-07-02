"use client";

import * as React from "react";
import { BarChart3, Clock3, MapPin, Plane, RotateCcw, Route, SlidersHorizontal } from "lucide-react";
import { BarChart } from "@/components/features/charts/BarChart";
import { LineChart } from "@/components/features/charts/LineChart";
import { PieChart } from "@/components/features/charts/PieChart";
import { Button } from "@/components/ui/Button";

export type InicioFlightRow = {
  id: string;
  date: string;
  year: string;
  flightNumber: string;
  origin: string;
  destination: string;
  departureTime: string | null;
  arrivalTime: string | null;
  flightDurationMinutes: number;
  equipment: string;
};

type FilterState = {
  fromDate: string;
  toDate: string;
  equipment: string;
  destination: string;
  routeMonth: string;
};

const EMPTY_FILTERS: FilterState = {
  fromDate: "",
  toDate: "",
  equipment: "all",
  destination: "all",
  routeMonth: "all",
};

export function InicioDashboard({ rows }: { rows: InicioFlightRow[] }) {
  const [filters, setFilters] = React.useState<FilterState>(EMPTY_FILTERS);
  const [isFilterOpen, setIsFilterOpen] = React.useState(false);

  const equipments = React.useMemo(() => uniqueOptions(rows.map((row) => row.equipment)), [rows]);
  const destinations = React.useMemo(() => uniqueOptions(rows.map((row) => row.destination)), [rows]);

  const filteredRows = React.useMemo(
    () =>
      rows.filter((row) => {
        if (filters.fromDate && row.date < filters.fromDate) return false;
        if (filters.toDate && row.date > filters.toDate) return false;
        if (filters.equipment !== "all" && row.equipment !== filters.equipment) return false;
        if (filters.destination !== "all" && row.destination !== filters.destination) return false;
        return true;
      }),
    [filters, rows]
  );
  const activeFilterCount = [
    filters.fromDate,
    filters.toDate,
    filters.equipment !== "all" ? filters.equipment : "",
    filters.destination !== "all" ? filters.destination : "",
    filters.routeMonth !== "all" ? filters.routeMonth : "",
  ].filter(Boolean).length;

  const totalFlights = filteredRows.length;
  const totalMinutes = sum(filteredRows.map((row) => row.flightDurationMinutes));
  const totalHours = totalMinutes / 60;
  const topDestination = topByCount(filteredRows.map((row) => row.destination));
  const rowsWithEquipment = filteredRows.filter((row) => hasEquipment(row.equipment));
  const topEquipment = topByCount(rowsWithEquipment.map((row) => row.equipment), "Sem dados");

  const hoursByMonth = React.useMemo(() => {
    const buckets = new Map<string, number>();
    for (const row of filteredRows) {
      const month = row.date ? row.date.slice(0, 7) : "Sem data";
      buckets.set(month, (buckets.get(month) ?? 0) + row.flightDurationMinutes / 60);
    }

    return [...buckets.entries()]
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([month, hours]) => ({ month: formatMonth(month), Horas: roundOne(hours) }));
  }, [filteredRows]);

  const arrivalsByDestination = React.useMemo(
    () =>
      countBy(filteredRows.map((row) => row.destination))
        .slice(0, 10)
        .map(({ label, count }) => ({ destino: label, Chegadas: count })),
    [filteredRows]
  );

  const hoursByYear = React.useMemo(() => {
    const buckets = new Map<string, number>();
    for (const row of filteredRows) {
      const year = row.year || "Sem ano";
      buckets.set(year, (buckets.get(year) ?? 0) + row.flightDurationMinutes / 60);
    }

    return [...buckets.entries()]
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([year, hours]) => ({ ano: year, Horas: roundOne(hours) }));
  }, [filteredRows]);

  const equipmentCounts = React.useMemo(
    () => countBy(rowsWithEquipment.map((row) => row.equipment)).map(({ label, count }) => ({ equipamento: label, Voos: count })),
    [rowsWithEquipment]
  );
  const routeMonths = React.useMemo(() => {
    const months = uniqueOptions(filteredRows.map((row) => (row.date ? row.date.slice(0, 7) : "")));
    return months.map((month) => ({ value: month, label: formatMonth(month) }));
  }, [filteredRows]);
  const routeRows = React.useMemo(
    () =>
      filteredRows.filter((row) => {
        if (filters.routeMonth !== "all" && row.date.slice(0, 7) !== filters.routeMonth) return false;
        return true;
      }),
    [filteredRows, filters.routeMonth]
  );

  return (
    <div className="space-y-6">
      <section className="rounded-lg border border-gray-200 bg-white px-3 py-3 shadow-sm transition focus-within:border-brand-300 focus-within:ring-2 focus-within:ring-brand-500/10">
        <div className="flex items-center justify-between gap-3">
          <div className="flex min-w-0 items-center gap-2">
            <Button
              variant={isFilterOpen ? "secondary-color" : "secondary"}
              size="sm"
              iconLeading={SlidersHorizontal}
              aria-expanded={isFilterOpen}
              aria-controls="inicio-filter-panel"
              onPress={() => setIsFilterOpen((current) => !current)}
              className="h-9 px-3"
            >
              Filtros{activeFilterCount > 0 ? ` (${activeFilterCount})` : ""}
            </Button>
            <div className="min-w-0">
              <p className="truncate text-xs text-gray-500">
                {filteredRows.length} de {rows.length} voos
              </p>
            </div>
          </div>

          {activeFilterCount > 0 ? (
            <Button
              variant="tertiary"
              size="sm"
              iconLeading={RotateCcw}
              onPress={() => setFilters(EMPTY_FILTERS)}
              className="h-9 shrink-0 px-3"
            >
              Limpar
            </Button>
          ) : null}
        </div>

        {isFilterOpen ? (
          <div
            id="inicio-filter-panel"
            className="mt-3 grid gap-2 border-t border-gray-100 pt-3 sm:grid-cols-2 xl:grid-cols-[minmax(130px,0.75fr)_minmax(130px,0.75fr)_minmax(150px,1fr)_minmax(150px,1fr)_auto]"
          >
          <label className="flex flex-col gap-1 text-xs font-semibold text-gray-600">
            De
            <input
              type="date"
              value={filters.fromDate}
              onChange={(event) => setFilters((current) => ({ ...current, fromDate: event.target.value }))}
              className="h-9 rounded-md border border-gray-300 px-2.5 text-sm text-gray-900 outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20"
            />
          </label>

          <label className="flex flex-col gap-1 text-xs font-semibold text-gray-600">
            Até
            <input
              type="date"
              value={filters.toDate}
              onChange={(event) => setFilters((current) => ({ ...current, toDate: event.target.value }))}
              className="h-9 rounded-md border border-gray-300 px-2.5 text-sm text-gray-900 outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20"
            />
          </label>

          <label className="flex flex-col gap-1 text-xs font-semibold text-gray-600">
            Equipamento
            <select
              value={filters.equipment}
              onChange={(event) => setFilters((current) => ({ ...current, equipment: event.target.value }))}
              className="h-9 rounded-md border border-gray-300 px-2.5 text-sm text-gray-900 outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20"
            >
              <option value="all">Todos</option>
              {equipments.map((equipment) => (
                <option key={equipment} value={equipment}>
                  {equipment}
                </option>
              ))}
            </select>
          </label>

          <label className="flex flex-col gap-1 text-xs font-semibold text-gray-600">
            Destino
            <select
              value={filters.destination}
              onChange={(event) => setFilters((current) => ({ ...current, destination: event.target.value }))}
              className="h-9 rounded-md border border-gray-300 px-2.5 text-sm text-gray-900 outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20"
            >
              <option value="all">Todos</option>
              {destinations.map((destination) => (
                <option key={destination} value={destination}>
                  {destination}
                </option>
              ))}
            </select>
          </label>

          <div className="flex items-end sm:col-span-2 xl:col-span-1">
            <Button
              variant="secondary"
              size="sm"
              iconLeading={RotateCcw}
              onPress={() => setFilters(EMPTY_FILTERS)}
              className="h-9 w-full px-3 xl:w-auto"
            >
              Limpar
            </Button>
          </div>
          </div>
        ) : null}
      </section>

      <section className="grid gap-4 md:grid-cols-4">
        <Metric icon={Clock3} label="Horas voadas" value={formatHours(totalHours)} />
        <Metric icon={Plane} label="Voos" value={String(totalFlights)} />
        <Metric icon={MapPin} label="Destino mais frequente" value={topDestination} />
        <Metric icon={BarChart3} label="Equipamento mais usado" value={topEquipment} />
      </section>

      {filteredRows.length > 0 ? (
        <section className="grid gap-6 xl:grid-cols-2">
          <RouteMapPanel
            rows={routeRows}
            months={routeMonths}
            selectedMonth={filters.routeMonth}
            onMonthChange={(routeMonth) => setFilters((current) => ({ ...current, routeMonth }))}
          />

          <ChartPanel title="Horas voadas por mês" description="Soma das horas calculadas entre partida e chegada.">
            <BarChart data={hoursByMonth} categories={["Horas"]} index="month" valueFormatter={formatChartHours} showLegend={false} />
            <MobileChartLabels
              items={hoursByMonth.map((item) => ({
                label: item.month,
                value: formatChartHours(item.Horas),
              }))}
            />
          </ChartPanel>

          <ChartPanel title="Chegadas por destino" description="Quantidade de vezes que a escala chegou em cada local.">
            <BarChart
              data={arrivalsByDestination}
              categories={["Chegadas"]}
              index="destino"
              layout="vertical"
              valueFormatter={(value) => `${value} chegada${Number(value) === 1 ? "" : "s"}`}
              showLegend={false}
            />
            <MobileChartLabels
              items={arrivalsByDestination.map((item) => ({
                label: item.destino,
                value: `${item.Chegadas} chegada${item.Chegadas === 1 ? "" : "s"}`,
              }))}
            />
          </ChartPanel>

          <ChartPanel title="Horas voadas por ano" description="Histórico anual das horas voadas no roster importado.">
            <LineChart data={hoursByYear} categories={["Horas"]} index="ano" valueFormatter={formatChartHours} showLegend={false} />
            <MobileChartLabels
              items={hoursByYear.map((item) => ({
                label: item.ano,
                value: formatChartHours(item.Horas),
              }))}
            />
          </ChartPanel>

          <ChartPanel title="Voos por equipamento" description="Distribuição dos voos por todos os equipamentos extraídos da escala.">
            {equipmentCounts.length > 0 ? (
              <>
                <PieChart
                  data={equipmentCounts}
                  category="Voos"
                  index="equipamento"
                  valueFormatter={(value) => `${value} voo${Number(value) === 1 ? "" : "s"}`}
                  variant="donut"
                />
                <MobileChartLabels
                  items={equipmentCounts.map((item) => ({
                    label: item.equipamento,
                    value: `${item.Voos} voo${item.Voos === 1 ? "" : "s"}`,
                  }))}
                />
              </>
            ) : (
              <div className="flex h-[300px] items-center justify-center rounded-lg border border-dashed border-gray-200 px-6 text-center text-sm text-gray-500">
                Reimporte a escala para preencher os equipamentos dos voos já salvos.
              </div>
            )}
          </ChartPanel>
        </section>
      ) : (
        <section className="rounded-lg border border-gray-200 bg-white px-6 py-10 text-sm text-gray-500 shadow-sm">
          Nenhum voo encontrado para os filtros selecionados.
        </section>
      )}
    </div>
  );
}

function RouteMapPanel({
  rows,
  months,
  selectedMonth,
  onMonthChange,
}: {
  rows: InicioFlightRow[];
  months: { value: string; label: string }[];
  selectedMonth: string;
  onMonthChange: (value: string) => void;
}) {
  const mapData = React.useMemo(() => buildRouteMapData(rows), [rows]);
  const maxCount = Math.max(1, ...mapData.routes.map((route) => route.count));

  return (
    <div className="rounded-lg border border-gray-200 bg-white p-5 shadow-sm xl:col-span-2">
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <span className="flex size-9 items-center justify-center rounded-lg bg-red-50 text-red-700">
              <Route className="size-5" />
            </span>
            <div>
              <h2 className="text-lg font-semibold text-gray-900">Mapa de rotas</h2>
              <p className="mt-1 text-sm text-gray-500">
                {mapData.routes.length} rotas, {mapData.airports.length} aeroportos, {rows.length} voos
              </p>
            </div>
          </div>
        </div>

        <label className="flex min-w-44 flex-col gap-1 text-xs font-semibold text-gray-600">
          Mês
          <select
            value={selectedMonth}
            onChange={(event) => onMonthChange(event.target.value)}
            className="h-9 rounded-md border border-gray-300 px-2.5 text-sm text-gray-900 outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20"
          >
            <option value="all">Todos os meses</option>
            {months.map((month) => (
              <option key={month.value} value={month.value}>
                {month.label}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="overflow-hidden rounded-lg border border-gray-200 bg-white">
        <svg className="h-auto w-full" viewBox={`0 0 ${ROUTE_MAP.width} ${ROUTE_MAP.height}`} role="img" aria-label="Mapa de rotas de voo">
          <rect width={ROUTE_MAP.width} height={ROUTE_MAP.height} fill="#ffffff" />
          <image href="/images/brazil-states-map.svg" x="0" y="0" width={ROUTE_MAP.width} height={ROUTE_MAP.height} preserveAspectRatio="xMidYMid meet" />

          {mapData.routes.map((route, index) => {
            const origin = projectAirport(route.origin);
            const destination = projectAirport(route.destination);
            const strokeWidth = 0.8 + (route.count / maxCount) * 1.6;
            const curve = createRouteCurve(origin, destination, route, index);

            return (
              <g key={route.key}>
                <path
                  d={curve.path}
                  fill="none"
                  stroke="#dc2626"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeOpacity="0.82"
                  strokeWidth={strokeWidth}
                />
              </g>
            );
          })}

          {mapData.airports.map((airport) => {
            const point = projectAirport(airport.code);
            return (
              <g key={airport.code}>
                <circle cx={point.x} cy={point.y} r="4.2" fill="#991b1b" stroke="#ffffff" strokeWidth="1.5" />
              </g>
            );
          })}

          {mapData.routes.length === 0 ? (
            <foreignObject x="0" y="0" width={ROUTE_MAP.width} height={ROUTE_MAP.height}>
              <div className="flex h-full items-center justify-center px-6 text-center text-sm font-medium text-gray-500">
                Nenhuma rota com origem e destino reconhecidos para este período.
              </div>
            </foreignObject>
          ) : null}
        </svg>
      </div>

      {mapData.missingAirports.length > 0 ? (
        <p className="mt-3 text-xs text-gray-500">
          Sem coordenada: {mapData.missingAirports.join(", ")}.
        </p>
      ) : null}
    </div>
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

function ChartPanel({ title, description, children }: { title: string; description: string; children: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-gray-200 bg-white p-5 shadow-sm">
      <div className="mb-4">
        <h2 className="text-lg font-semibold text-gray-900">{title}</h2>
        <p className="mt-1 text-sm text-gray-500">{description}</p>
      </div>
      {children}
    </div>
  );
}

function MobileChartLabels({ items }: { items: { label: string; value: string }[] }) {
  if (items.length === 0) return null;

  return (
    <div className="mt-4 grid gap-2 border-t border-gray-100 pt-4 md:hidden">
      {items.map((item) => (
        <div key={item.label} className="flex items-center justify-between gap-3 text-sm">
          <span className="min-w-0 truncate font-medium text-gray-700">{item.label}</span>
          <span className="shrink-0 text-gray-500">{item.value}</span>
        </div>
      ))}
    </div>
  );
}

function uniqueOptions(values: string[]) {
  return [...new Set(values.filter(Boolean))].sort((left, right) => left.localeCompare(right));
}

function sum(values: number[]) {
  return values.reduce((total, value) => total + value, 0);
}

function countBy(values: string[]) {
  const buckets = new Map<string, number>();
  for (const value of values) {
    buckets.set(value, (buckets.get(value) ?? 0) + 1);
  }

  return [...buckets.entries()]
    .sort((left, right) => right[1] - left[1] || left[0].localeCompare(right[0]))
    .map(([label, count]) => ({ label, count }));
}

function topByCount(values: string[], emptyValue = "-") {
  return countBy(values)[0]?.label ?? emptyValue;
}

function hasEquipment(value: string) {
  return value !== "Não informado";
}

function roundOne(value: number) {
  return Math.round(value * 10) / 10;
}

function formatHours(value: number) {
  return `${roundOne(value).toLocaleString("pt-BR", { minimumFractionDigits: 1, maximumFractionDigits: 1 })} h`;
}

function formatChartHours(value: unknown) {
  return `${Number(value).toLocaleString("pt-BR", { minimumFractionDigits: 1, maximumFractionDigits: 1 })} h`;
}

function formatMonth(value: string) {
  const match = value.match(/^(\d{4})-(\d{2})$/);
  if (!match) return value;
  return `${match[2]}/${match[1]}`;
}

type AirportPoint = {
  code: string;
  lat: number;
  lon: number;
};

type RouteSegment = {
  key: string;
  origin: string;
  destination: string;
  count: number;
};

const ROUTE_MAP = {
  width: 760,
  height: 620,
  padding: 46,
  minLat: -35,
  maxLat: 6,
  minLon: -75,
  maxLon: -33,
};

const AIRPORT_COORDINATES: Record<string, AirportPoint> = {
  AJU: { code: "AJU", lat: -10.99, lon: -37.07 },
  BEL: { code: "BEL", lat: -1.38, lon: -48.48 },
  BPS: { code: "BPS", lat: -16.44, lon: -39.08 },
  BSB: { code: "BSB", lat: -15.87, lon: -47.92 },
  BVB: { code: "BVB", lat: 2.85, lon: -60.69 },
  CGB: { code: "CGB", lat: -15.65, lon: -56.12 },
  CGH: { code: "CGH", lat: -23.63, lon: -46.66 },
  CGR: { code: "CGR", lat: -20.47, lon: -54.67 },
  CNF: { code: "CNF", lat: -19.62, lon: -43.97 },
  CWB: { code: "CWB", lat: -25.53, lon: -49.17 },
  CXJ: { code: "CXJ", lat: -29.2, lon: -51.19 },
  FLN: { code: "FLN", lat: -27.67, lon: -48.55 },
  FOR: { code: "FOR", lat: -3.78, lon: -38.53 },
  GIG: { code: "GIG", lat: -22.81, lon: -43.25 },
  GRU: { code: "GRU", lat: -23.43, lon: -46.47 },
  GYN: { code: "GYN", lat: -16.63, lon: -49.22 },
  IGU: { code: "IGU", lat: -25.6, lon: -54.49 },
  IOS: { code: "IOS", lat: -14.82, lon: -39.03 },
  JDO: { code: "JDO", lat: -7.22, lon: -39.27 },
  JPA: { code: "JPA", lat: -7.15, lon: -34.95 },
  JTC: { code: "JTC", lat: -22.16, lon: -49.07 },
  LDB: { code: "LDB", lat: -23.33, lon: -51.13 },
  MAB: { code: "MAB", lat: -5.37, lon: -49.14 },
  MAO: { code: "MAO", lat: -3.04, lon: -60.05 },
  MCO: { code: "MCO", lat: 28.43, lon: -81.31 },
  MCZ: { code: "MCZ", lat: -9.51, lon: -35.79 },
  MGF: { code: "MGF", lat: -23.48, lon: -52.02 },
  MIA: { code: "MIA", lat: 25.79, lon: -80.29 },
  NAT: { code: "NAT", lat: -5.77, lon: -35.37 },
  NVT: { code: "NVT", lat: -26.88, lon: -48.65 },
  PFB: { code: "PFB", lat: -28.24, lon: -52.33 },
  PMW: { code: "PMW", lat: -10.29, lon: -48.36 },
  POA: { code: "POA", lat: -29.99, lon: -51.17 },
  PVH: { code: "PVH", lat: -8.71, lon: -63.9 },
  RAO: { code: "RAO", lat: -21.13, lon: -47.77 },
  RBR: { code: "RBR", lat: -9.87, lon: -67.9 },
  REC: { code: "REC", lat: -8.13, lon: -34.92 },
  SDU: { code: "SDU", lat: -22.91, lon: -43.16 },
  SLZ: { code: "SLZ", lat: -2.58, lon: -44.23 },
  SSA: { code: "SSA", lat: -12.91, lon: -38.33 },
  THE: { code: "THE", lat: -5.06, lon: -42.82 },
  UDI: { code: "UDI", lat: -18.88, lon: -48.23 },
  VCP: { code: "VCP", lat: -23.01, lon: -47.13 },
  VDC: { code: "VDC", lat: -14.86, lon: -40.86 },
  VIX: { code: "VIX", lat: -20.26, lon: -40.29 },
  XAP: { code: "XAP", lat: -27.13, lon: -52.66 },
};

function buildRouteMapData(rows: InicioFlightRow[]) {
  const routeBuckets = new Map<string, RouteSegment>();
  const airportCodes = new Set<string>();
  const missingAirports = new Set<string>();

  for (const row of rows) {
    const origin = normalizeAirportCode(row.origin);
    const destination = normalizeAirportCode(row.destination);
    if (!origin || !destination || origin === destination) continue;

    if (!AIRPORT_COORDINATES[origin]) missingAirports.add(origin);
    if (!AIRPORT_COORDINATES[destination]) missingAirports.add(destination);
    if (!AIRPORT_COORDINATES[origin] || !AIRPORT_COORDINATES[destination]) continue;

    airportCodes.add(origin);
    airportCodes.add(destination);

    const key = `${origin}-${destination}`;
    const current = routeBuckets.get(key);
    if (current) {
      current.count += 1;
    } else {
      routeBuckets.set(key, { key, origin, destination, count: 1 });
    }
  }

  return {
    routes: [...routeBuckets.values()].sort((left, right) => right.count - left.count || left.key.localeCompare(right.key)),
    airports: [...airportCodes].sort().map((code) => AIRPORT_COORDINATES[code]),
    missingAirports: [...missingAirports].sort(),
  };
}

function normalizeAirportCode(value: string) {
  const code = value.trim().toUpperCase();
  if (!code || code === "-" || code === "N/A") return "";
  return code;
}

function projectAirport(code: string) {
  const airport = AIRPORT_COORDINATES[code];
  return projectGeo(airport.lon, airport.lat);
}

function projectGeo(lon: number, lat: number) {
  const x =
    ROUTE_MAP.padding +
    ((lon - ROUTE_MAP.minLon) / (ROUTE_MAP.maxLon - ROUTE_MAP.minLon)) * (ROUTE_MAP.width - ROUTE_MAP.padding * 2);
  const y =
    ROUTE_MAP.padding +
    ((ROUTE_MAP.maxLat - lat) / (ROUTE_MAP.maxLat - ROUTE_MAP.minLat)) * (ROUTE_MAP.height - ROUTE_MAP.padding * 2);

  return { x: clamp(x, ROUTE_MAP.padding, ROUTE_MAP.width - ROUTE_MAP.padding), y: clamp(y, ROUTE_MAP.padding, ROUTE_MAP.height - ROUTE_MAP.padding) };
}

function createRouteCurve(
  origin: { x: number; y: number },
  destination: { x: number; y: number },
  route: RouteSegment,
  index: number
) {
  const dx = destination.x - origin.x;
  const dy = destination.y - origin.y;
  const distance = Math.hypot(dx, dy);
  if (distance < 1) {
    return { path: `M ${origin.x.toFixed(1)} ${origin.y.toFixed(1)} L ${destination.x.toFixed(1)} ${destination.y.toFixed(1)}` };
  }

  const midpointX = (origin.x + destination.x) / 2;
  const midpointY = (origin.y + destination.y) / 2;
  const perpendicularX = -dy / distance;
  const perpendicularY = dx / distance;
  const direction = route.origin.localeCompare(route.destination) <= 0 ? 1 : -1;
  const spread = ((stableHash(route.key) % 7) - 3) * 6 + (index % 5) * 2;
  const bend = direction * clamp(distance * 0.2 + spread, 22, 96);
  const controlX = clamp(midpointX + perpendicularX * bend, ROUTE_MAP.padding, ROUTE_MAP.width - ROUTE_MAP.padding);
  const controlY = clamp(midpointY + perpendicularY * bend, ROUTE_MAP.padding, ROUTE_MAP.height - ROUTE_MAP.padding);

  return {
    path: `M ${origin.x.toFixed(1)} ${origin.y.toFixed(1)} Q ${controlX.toFixed(1)} ${controlY.toFixed(1)} ${destination.x.toFixed(1)} ${destination.y.toFixed(1)}`,
  };
}

function stableHash(value: string) {
  let hash = 0;
  for (let index = 0; index < value.length; index += 1) {
    hash = (hash * 31 + value.charCodeAt(index)) >>> 0;
  }
  return hash;
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}
