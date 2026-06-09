"use client";

import * as React from "react";
import { BarChart3, Clock3, MapPin, Plane, RotateCcw, SlidersHorizontal } from "lucide-react";
import { BarChart } from "@/components/features/charts/BarChart";
import { LineChart } from "@/components/features/charts/LineChart";
import { PieChart } from "@/components/features/charts/PieChart";
import { Button } from "@/components/ui/Button";

export type InicioFlightRow = {
  id: string;
  date: string;
  year: string;
  flightNumber: string;
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
};

const EMPTY_FILTERS: FilterState = {
  fromDate: "",
  toDate: "",
  equipment: "all",
  destination: "all",
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
