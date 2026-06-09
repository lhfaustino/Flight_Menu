import { PDFParse } from 'pdf-parse';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const pdfWorkerSrc = pathToFileURL(
  path.join(process.cwd(), 'node_modules/pdf-parse/dist/pdf-parse/esm/pdf.worker.mjs')
).toString();

PDFParse.setWorker(pdfWorkerSrc);

export interface RosterEntry {
  flightNumber: string;
  origin: string;
  destination: string;
  departureTime: string;
  arrivalTime: string;
  date?: string;
  crewPosition?: string;
  equipment?: string;
}

export interface CateringEntry {
  flightNumber: string;
  date: string;
  origin: string;
  destination: string;
  crewService: string;
  base: string;
  paxService: string;
}

/**
 * Extracts text from PDF buffer
 */
export async function extractPdfText(pdfBuffer: Buffer): Promise<string> {
  const parser = new PDFParse({ data: pdfBuffer });

  try {
    const result = await parser.getText();
    return result.text;
  } catch (error) {
    throw new Error(`Failed to parse PDF: ${error instanceof Error ? error.message : 'Unknown error'}`);
  } finally {
    await parser.destroy();
  }
}

/**
 * Parses flight roster text
 * Looks for pattern: G3[number] [origin] [departure] [arrival] [destination]
 * Example: G3 123 JFK 14:30 18:45 LHR
 */
export function parseRosterText(text: string): RosterEntry[] {
  const entries: RosterEntry[] = [];

  const periodMatch = text.match(/Period:\s*(\d{2})([A-Za-z]{3})(\d{2})\s*-/);
  const periodYear = periodMatch ? 2000 + Number(periodMatch[3]) : new Date().getFullYear();
  const periodMonth = periodMatch ? monthNameToNumber(periodMatch[2]) : new Date().getMonth() + 1;
  let currentDate: string | undefined;

  for (const rawLine of text.split('\n')) {
    const line = rawLine.trim();
    if (!line) continue;

    const dayMatch = line.match(/^(?:Mon|Tue|Wed|Thu|Fri|Sat|Sun)(\d{2})\b/);
    if (dayMatch && periodMonth) {
      currentDate = `${periodYear}-${String(periodMonth).padStart(2, '0')}-${dayMatch[1]}`;
    }

    const flightMatch = line.match(/^(?:DH\/)?G3\s+(\d+)\s+([A-Z]{3})\s+!?(\d{3,4})\s+!?(\d{3,4})\s+([A-Z]{3})\b/i);
    if (!flightMatch) continue;

    entries.push({
      flightNumber: `G3${flightMatch[1]}`,
      origin: flightMatch[2],
      destination: flightMatch[5],
      departureTime: normalizeTime(flightMatch[3]),
      arrivalTime: normalizeTime(flightMatch[4]),
      date: currentDate,
      crewPosition: line.startsWith('DH/') ? 'DH' : undefined,
      equipment: extractEquipment(line),
    });
  }

  return entries;
}

/**
 * Parses catering plan text
 * Portuguese columns: voo | data | de | para | serviço crew | base | padrao embarque serviço pax
 */
export function parseCateringText(text: string): CateringEntry[] {
  const entriesByKey = new Map<string, CateringEntry>();

  for (const rawLine of text.split('\n')) {
    const line = rawLine.trim();
    const entry = parseCateringRow(line);
    if (entry) entriesByKey.set(buildCateringEntryKey(entry), entry);
  }

  if (entriesByKey.size === 0) {
    for (const entry of parseCateringRowsFromTextBlock(text)) {
      entriesByKey.set(buildCateringEntryKey(entry), entry);
    }
  }

  return [...entriesByKey.values()];
}

function parseCateringRow(line: string): CateringEntry | null {
  if (!line) return null;

  const match = line.match(
    /^(?:G3\s*)?(\d+)\s+(\d{2}[-/]\d{2}[-/]\d{4})\s+([A-Z]{3})\s+([A-Z]{3})\s+(.+?)\s+([A-Z]{3})\s+(.+)$/iu
  );
  if (!match) return null;

  return {
    flightNumber: `G3${match[1]}`,
    date: normalizeCateringDate(match[2]),
    origin: match[3].toUpperCase(),
    destination: match[4].toUpperCase(),
    crewService: match[5].trim(),
    base: match[6].toUpperCase(),
    paxService: match[7].trim(),
  };
}

function parseCateringRowsFromTextBlock(text: string): CateringEntry[] {
  const normalizedText = text.replace(/\s+/g, ' ').trim();
  const rowPattern =
    /(?:^|\s)(?:G3\s*)?(\d+)\s+(\d{2}[-/]\d{2}[-/]\d{4})\s+([A-Z]{3})\s+([A-Z]{3})\s+(.+?)(?=\s+(?:G3\s*)?\d+\s+\d{2}[-/]\d{2}[-/]\d{4}\s+[A-Z]{3}\s+[A-Z]{3}\s+|$)/giu;
  const entries: CateringEntry[] = [];

  for (const match of normalizedText.matchAll(rowPattern)) {
    const serviceMatch = match[5].trim().match(/^(.+?)\s+([A-Z]{3})\s+(.+)$/u);
    if (!serviceMatch) continue;

    entries.push({
      flightNumber: `G3${match[1]}`,
      date: normalizeCateringDate(match[2]),
      origin: match[3].toUpperCase(),
      destination: match[4].toUpperCase(),
      crewService: serviceMatch[1].trim(),
      base: serviceMatch[2].toUpperCase(),
      paxService: serviceMatch[3].trim(),
    });
  }

  return entries;
}

function normalizeCateringDate(value: string) {
  return value.replace(/\//g, '-');
}

function buildCateringEntryKey(entry: CateringEntry) {
  return [
    entry.flightNumber,
    entry.date,
    entry.origin,
    entry.destination,
    entry.crewService,
    entry.base,
    entry.paxService,
  ].join('|');
}

function normalizeTime(value: string): string {
  const padded = value.padStart(4, '0');
  return `${padded.slice(0, 2)}:${padded.slice(2)}`;
}

function extractEquipment(line: string): string | undefined {
  const match = line.toUpperCase().match(/\b(B73G|B738)\b/);
  return match?.[1];
}

function monthNameToNumber(month: string): number | undefined {
  const months: Record<string, number> = {
    jan: 1,
    feb: 2,
    mar: 3,
    apr: 4,
    may: 5,
    jun: 6,
    jul: 7,
    aug: 8,
    sep: 9,
    oct: 10,
    nov: 11,
    dec: 12,
  };

  return months[month.toLowerCase()];
}
