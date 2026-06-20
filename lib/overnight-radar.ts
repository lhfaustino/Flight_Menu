export type FlightLegForStay = {
  id: string;
  userId: string;
  flightNumber: string | null;
  crewPosition: string | null;
  origin: string | null;
  destination: string | null;
  departureTime: string | null;
  arrivalTime: string | null;
};

export type CrewProfileForRadar = {
  userId: string;
  name: string | null;
  avatarUrl: string | null;
};

export type OvernightStay = {
  id: string;
  userId: string;
  location: string;
  start: Date;
  end: Date;
  arrivalFlightNumber: string | null;
  departureFlightNumber: string | null;
  crewPosition: string | null;
};

export type OvernightRadarMatch = {
  userId: string;
  name: string;
  avatarUrl: string | null;
  role: string | null;
  location: string;
  arrivalTime: Date;
  departureTime: Date;
  overlapHours: number;
};

const MIN_STAY_HOURS = 6;
const MIN_OVERLAP_HOURS = 6;

export function getOverlapHours(startA: Date, endA: Date, startB: Date, endB: Date) {
  const overlapStart = new Date(Math.max(startA.getTime(), startB.getTime()));
  const overlapEnd = new Date(Math.min(endA.getTime(), endB.getTime()));
  const overlapMs = overlapEnd.getTime() - overlapStart.getTime();

  if (overlapMs <= 0) return 0;

  return overlapMs / (1000 * 60 * 60);
}

export function buildOvernightStays(rows: FlightLegForStay[], minStayHours = MIN_STAY_HOURS): OvernightStay[] {
  const byUser = new Map<string, FlightLegForStay[]>();

  for (const row of rows) {
    if (!row.userId || !row.departureTime || !row.arrivalTime) continue;
    const userRows = byUser.get(row.userId) ?? [];
    userRows.push(row);
    byUser.set(row.userId, userRows);
  }

  const stays: OvernightStay[] = [];

  for (const [userId, userRows] of byUser.entries()) {
    const sortedRows = [...userRows].sort((left, right) => getTime(left.departureTime) - getTime(right.departureTime));

    for (let index = 0; index < sortedRows.length - 1; index += 1) {
      const arrivalLeg = sortedRows[index];
      const departureLeg = sortedRows[index + 1];
      const location = normalizeLocation(arrivalLeg.destination);
      const nextOrigin = normalizeLocation(departureLeg.origin);

      if (!location || location !== nextOrigin) continue;

      const start = parseDate(arrivalLeg.arrivalTime);
      const end = parseDate(departureLeg.departureTime);
      if (!start || !end || end <= start) continue;

      const stayHours = (end.getTime() - start.getTime()) / (1000 * 60 * 60);
      if (stayHours < minStayHours) continue;

      stays.push({
        id: `${arrivalLeg.id}:${departureLeg.id}`,
        userId,
        location,
        start,
        end,
        arrivalFlightNumber: arrivalLeg.flightNumber,
        departureFlightNumber: departureLeg.flightNumber,
        crewPosition: arrivalLeg.crewPosition ?? departureLeg.crewPosition,
      });
    }
  }

  return stays;
}

export function findOvernightRadarMatches({
  currentUserId,
  stays,
  profiles,
  now = new Date(),
  minOverlapHours = MIN_OVERLAP_HOURS,
}: {
  currentUserId: string;
  stays: OvernightStay[];
  profiles: CrewProfileForRadar[];
  now?: Date;
  minOverlapHours?: number;
}): OvernightRadarMatch[] {
  const profileByUserId = new Map(profiles.map((profile) => [profile.userId, profile]));
  const currentUserStays = stays.filter((stay) => stay.userId === currentUserId && stay.end >= now);
  const bestMatchByUserId = new Map<string, OvernightRadarMatch>();

  for (const currentStay of currentUserStays) {
    for (const otherStay of stays) {
      if (otherStay.userId === currentUserId || otherStay.location !== currentStay.location || otherStay.end < now) continue;

      const overlapHours = getOverlapHours(currentStay.start, currentStay.end, otherStay.start, otherStay.end);
      const overlapEnd = new Date(Math.min(currentStay.end.getTime(), otherStay.end.getTime()));
      if (overlapHours < minOverlapHours || overlapEnd < now) continue;

      const profile = profileByUserId.get(otherStay.userId);
      const match: OvernightRadarMatch = {
        userId: otherStay.userId,
        name: profile?.name?.trim() || "Tripulante",
        avatarUrl: profile?.avatarUrl ?? null,
        role: otherStay.crewPosition,
        location: otherStay.location,
        arrivalTime: otherStay.start,
        departureTime: otherStay.end,
        overlapHours,
      };
      const previous = bestMatchByUserId.get(match.userId);
      if (!previous || match.overlapHours > previous.overlapHours) {
        bestMatchByUserId.set(match.userId, match);
      }
    }
  }

  return [...bestMatchByUserId.values()].sort(
    (left, right) =>
      right.overlapHours - left.overlapHours ||
      left.departureTime.getTime() - right.departureTime.getTime() ||
      left.name.localeCompare(right.name),
  );
}

function parseDate(value: string | null) {
  if (!value) return null;
  const date = new Date(value);
  return Number.isFinite(date.getTime()) ? date : null;
}

function getTime(value: string | null) {
  return parseDate(value)?.getTime() ?? 0;
}

function normalizeLocation(value: string | null) {
  return value?.trim().toUpperCase() || "";
}
