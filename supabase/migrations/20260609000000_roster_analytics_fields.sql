ALTER TABLE public.flight_leg_details
  ADD COLUMN IF NOT EXISTS flight_duration_minutes INTEGER,
  ADD COLUMN IF NOT EXISTS equipment TEXT;

UPDATE public.flight_leg_details
SET flight_duration_minutes = GREATEST(
  0,
  ROUND(EXTRACT(EPOCH FROM (arrival_time - departure_time)) / 60)::INTEGER
)
WHERE flight_duration_minutes IS NULL
  AND departure_time IS NOT NULL
  AND arrival_time IS NOT NULL;

CREATE INDEX IF NOT EXISTS flight_leg_details_user_equipment_idx
  ON public.flight_leg_details (user_id, equipment);
