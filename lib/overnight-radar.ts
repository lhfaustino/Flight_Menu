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
  id: string;
  userId: string;
  name: string;
  avatarUrl: string | null;
  role: string | null;
  location: string;
  arrivalTime: Date;
  departureTime: Date;
  overlapStart: Date;
  overlapEnd: Date;
  overlapHours: number;
};

const MIN_STAY_HOURS = 6;
const MIN_OVERLAP_HOURS = 6;
const ROSTER_ACTIVITY_POSITION = "ROSTER_ACTIVITY";

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
    if (
      !row.userId ||
      !row.departureTime ||
      !row.arrivalTime ||
      row.crewPosition?.trim().toUpperCase() === ROSTER_ACTIVITY_POSITION
    ) {
      continue;
    }
    const userRows = byUser.get(row.userId) ?? [];
    userRows.push(row);
    byUser.set(row.userId, userRows);
  }

  const stays: OvernightStay[] = [];

  for (const [userId, userRows] of byUser.entries()) {
    const sortedRows = [...userRows].sort((left, right) => getTime(left.departureTime) - getTime(right.departureTime));
    const arrivalsByDestination = new Map<string, FlightLegForStay[]>();

    for (const row of sortedRows) {
      const destination = normalizeLocation(row.destination);
      if (!destination) continue;

      const arrivals = arrivalsByDestination.get(destination) ?? [];
      arrivals.push(row);
      arrivalsByDestination.set(destination, arrivals);
    }

    for (const arrivals of arrivalsByDestination.values()) {
      arrivals.sort((left, right) => getTime(left.arrivalTime) - getTime(right.arrivalTime));
    }

    const previousDepartureByLocation = new Map<string, number>();

    for (const departureLeg of sortedRows) {
      const location = normalizeLocation(departureLeg.origin);
      const end = parseDate(departureLeg.departureTime);
      if (!location || !end) continue;

      const previousDeparture = previousDepartureByLocation.get(location) ?? Number.NEGATIVE_INFINITY;
      const arrivalLeg = findLatestArrival(
        arrivalsByDestination.get(location) ?? [],
        previousDeparture,
        end.getTime(),
      );
      previousDepartureByLocation.set(location, end.getTime());
      if (!arrivalLeg) continue;

      const start = parseDate(arrivalLeg.arrivalTime);
      if (!start || end <= start) continue;

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

function findLatestArrival(rows: FlightLegForStay[], afterTime: number, beforeTime: number) {
  for (let index = rows.length - 1; index >= 0; index -= 1) {
    const arrivalTime = getTime(rows[index].arrivalTime);
    if (arrivalTime >= beforeTime) continue;
    if (arrivalTime <= afterTime) return undefined;
    return rows[index];
  }

  return undefined;
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
  const otherStaysByLocation = new Map<string, OvernightStay[]>();

  for (const stay of stays) {
    if (stay.userId === currentUserId || stay.end < now) continue;

    const locationStays = otherStaysByLocation.get(stay.location) ?? [];
    locationStays.push(stay);
    otherStaysByLocation.set(stay.location, locationStays);
  }

  const matches: OvernightRadarMatch[] = [];

  for (const currentStay of currentUserStays) {
    for (const otherStay of otherStaysByLocation.get(currentStay.location) ?? []) {
      const overlapStart = new Date(Math.max(currentStay.start.getTime(), otherStay.start.getTime()));
      const overlapEnd = new Date(Math.min(currentStay.end.getTime(), otherStay.end.getTime()));

      const overlapHours = getOverlapHours(currentStay.start, currentStay.end, otherStay.start, otherStay.end);
      if (overlapHours <= minOverlapHours || overlapEnd < now) continue;

      const profile = profileByUserId.get(otherStay.userId);
      matches.push({
        id: `${currentStay.id}:${otherStay.id}`,
        userId: otherStay.userId,
        name: profile?.name?.trim() || "Tripulante",
        avatarUrl: profile?.avatarUrl ?? null,
        role: otherStay.crewPosition,
        location: otherStay.location,
        arrivalTime: otherStay.start,
        departureTime: otherStay.end,
        overlapStart,
        overlapEnd,
        overlapHours,
      });
    }
  }

  return matches.sort(
    (left, right) =>
      left.overlapStart.getTime() - right.overlapStart.getTime() ||
      left.location.localeCompare(right.location) ||
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
