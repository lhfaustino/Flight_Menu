import { PDFParse } from 'pdf-parse';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const pdfWorkerSrc = pathToFileURL(
  path.join(process.cwd(), 'node_modules/pdf-parse/dist/pdf-parse/esm/pdf.worker.mjs')
).toString();

PDFParse.setWorker(pdfWorkerSrc);

const EQUIPMENT_CODE_PATTERN =
  /\b(?:A\d{3}|A\d{2}N|B\d{3}[A-Z]?|B\d{2}[A-Z0-9]|B7M[78]|E\d{3}|E\d{2}S|AT\d{2}|CRJ\d{1,3}|ERJ\d{1,3}|7M[78]|73[78G9]|32[0-9N])\b/gi;

export interface RosterEntry {
  flightNumber: string;
  origin: string;
  destination: string;
  departureTime: string;
  arrivalTime: string;
  date?: string;
  crewPosition?: string;
  equipment?: string;
  entryType?: 'flight' | 'FR' | 'FP';
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
 * Deadhead roster lines can prefix the flight with DH, DH/, or DHG3.
 * Example: G3 123 JFK 14:30 18:45 LHR
 */
export function parseRosterText(text: string): RosterEntry[] {
  const entries: RosterEntry[] = [];

  const periodMatch = text.match(/Period:\s*(\d{2})([A-Za-z]{3})(\d{2})\s*-/);
  const periodYear = periodMatch ? 2000 + Number(periodMatch[3]) : new Date().getFullYear();
  const periodMonth = periodMatch ? monthNameToNumber(periodMatch[2]) : new Date().getMonth() + 1;
  let currentDate: string | undefined;
  let pendingActivityDate: string | undefined;

  for (const rawLine of text.split('\n')) {
    const line = rawLine.trim();
    if (!line) continue;

    const rosterDay = parseRosterDayHeader(line);
    if (rosterDay && periodMonth) {
      currentDate = `${periodYear}-${String(periodMonth).padStart(2, '0')}-${rosterDay}`;
    }

    const flightMatch = line.match(/^(?:D\/?H\s*\/?\s*)?G3\s+(\d+)\s+([A-Z]{3})\s+!?(\d{3,4})\s+!?(\d{3,4})\s+([A-Z]{3})\b/i);
    if (!flightMatch) {
      const activityDate = rosterDay ? currentDate : pendingActivityDate;
      const activity = activityDate ? parseRosterActivity(line, activityDate) : null;
      if (activity) {
        entries.push(activity);
        pendingActivityDate = undefined;
      } else {
        pendingActivityDate = rosterDay ? currentDate : undefined;
      }
      continue;
    }

    pendingActivityDate = undefined;

    entries.push({
      flightNumber: `G3${flightMatch[1]}`,
      origin: flightMatch[2],
      destination: flightMatch[5],
      departureTime: normalizeTime(flightMatch[3]),
      arrivalTime: normalizeTime(flightMatch[4]),
      date: currentDate,
      crewPosition: hasDeadheadCode(line) ? 'DH' : undefined,
      equipment: extractEquipment(line),
      entryType: 'flight',
    });
  }

  return entries;
}

function parseRosterActivity(line: string, date?: string): RosterEntry | null {
  const codeMatch = line.match(/(?:^|\s)(FR|FP)(?=\s|$)/i);
  if (!codeMatch) return null;

  const textAfterCode = line.slice((codeMatch.index ?? 0) + codeMatch[0].length);
  const times = [...textAfterCode.matchAll(/!?(\d{1,2}):?(\d{2})\b/g)]
    .map((match) => `${match[1].padStart(2, '0')}:${match[2]}`)
    .filter(isRosterTime);

  const code = codeMatch[1].toUpperCase() as 'FR' | 'FP';

  return {
    flightNumber: code,
    origin: '-',
    destination: '-',
    departureTime: times[0] ?? '00:00',
    arrivalTime: times[1] ?? times[0] ?? '23:59',
    date,
    entryType: code,
  };
}

function isRosterTime(value: string) {
  const [hours, minutes] = value.split(':').map(Number);
  return hours >= 0 && hours <= 23 && minutes >= 0 && minutes <= 59;
}

function hasDeadheadCode(line: string) {
  return /\bD\/?H\b/i.test(line) || /^D\/?H\s*\/?\s*G3\b/i.test(line);
}

function parseRosterDayHeader(line: string) {
  const normalMatch = line.match(/^([A-Za-z]{2,3})(\d{2})\b/);
  const ocrMatch = line.match(/^([A-Za-z]{2})1(\d{2})\b/);
  const match = normalMatch ?? ocrMatch;

  if (!match) return undefined;

  const weekday = match[1].toLowerCase();
  const normalizedWeekday = weekday.length === 2 ? weekday : weekday.slice(0, 3);
  const validWeekdays = new Set(['mo', 'tu', 'we', 'th', 'fr', 'sa', 'su', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun']);

  return validWeekdays.has(normalizedWeekday) ? match[2] : undefined;
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
  const match = line.toUpperCase().match(EQUIPMENT_CODE_PATTERN);
  return match?.[0];
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
