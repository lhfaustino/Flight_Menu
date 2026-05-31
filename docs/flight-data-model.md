# Flight Data Model

## Source of Truth

`flight_leg_details` is the source of truth for the flight menu shown to users.

The application reads this table when the user opens `/roster-upload` and refreshes the displayed table after each successful `Atualizar` upload.

Displayed columns:

- `departure_time` or `unique_key` date -> Date
- `flight_number` -> Flight Number
- `origin` -> Origin
- `destination` -> Destination
- `service_type` -> Crew Service
- `meal_type` -> Passenger Service

## Unique Key

Flight records are identified per user by:

`user_id + unique_key`

Where `unique_key` is:

`YYYY-MM-DD-flightNumber-origin`

Example:

`2026-05-24-1145-FLN`

This allows the app to upsert rows: insert a new row when it does not exist, update the existing row when it does.

## Tables

### `flight_leg_details`

Canonical user flight history and flight menu data.

Required by the app:

- `user_id`
- `unique_key`
- `flight_number`
- `origin`
- `destination`
- `departure_time`
- `arrival_time`
- `service_type`
- `meal_type`

Optional enrichment:

- `roster_id`
- `crew_position`

### `catering_rules`

Parsed catering rows from the catering plan. This is supporting data, not the UI source of truth.

Required by the app:

- `user_id`
- `unique_key`
- `flight_number`
- `service_date`
- `origin_iata`
- `destination_iata`
- `service_type`
- `meal_type`
- `priority`

### `flight_rosters`

Upload metadata for roster PDFs.

Required by the app:

- `user_id`
- `name`
- `file_url`

## Upload Flow

1. User selects roster PDF and catering PDF.
2. User clicks `Atualizar`.
3. App parses the catering PDF first.
4. App parses the roster PDF.
5. App builds `flight_leg_details` rows from catering data and enriches them with roster data when available.
6. App upserts `catering_rules`.
7. App upserts `flight_leg_details`.
8. App reloads the visible flight menu from `flight_leg_details`.
