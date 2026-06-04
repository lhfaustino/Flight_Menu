'use server';

import { randomBytes } from 'crypto';
import { revalidatePath } from 'next/cache';
import { createAdminClient } from '@/lib/supabase/admin';
import { createClient } from '@/lib/supabase/server';

type TodayFlight = {
  unique_key: string | null;
  flight_number: string | null;
  origin: string | null;
  destination: string | null;
  departure_time: string | null;
  arrival_time: string | null;
  service_type: string | null;
  meal_type: string | null;
};

type TelegramApiResult<T> = {
  ok: boolean;
  result?: T;
  description?: string;
};

type TelegramBotInfo = {
  username?: string;
};

export async function createTelegramConnectionLink() {
  const supabase = await createClient();

  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) {
    return { success: false, error: 'Não autorizado' };
  }

  const botToken = process.env.TELEGRAM_BOT_TOKEN;
  if (!botToken) {
    return { success: false, error: 'Telegram bot token is not configured.' };
  }

  const botUsername = await getTelegramBotUsername(botToken);
  if (!botUsername) {
    return { success: false, error: 'Could not load Telegram bot username.' };
  }

  const adminClient = createAdminClient();
  const token = randomBytes(24).toString('base64url');
  const expiresAt = new Date(Date.now() + 15 * 60 * 1000).toISOString();

  await adminClient
    .from('telegram_link_tokens')
    .update({ used_at: new Date().toISOString() })
    .eq('user_id', user.id)
    .is('used_at', null);

  const { error } = await adminClient
    .from('telegram_link_tokens')
    .insert({
      user_id: user.id,
      token,
      expires_at: expiresAt,
    });

  if (error) {
    return { success: false, error: error.message };
  }

  return {
    success: true,
    botUrl: `https://t.me/${botUsername}?start=${token}`,
    connectionCommand: `/connect ${token}`,
    expiresAt,
  };
}

export async function getTelegramConnectionStatus() {
  const supabase = await createClient();

  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) {
    return { success: false, error: 'Não autorizado' };
  }

  const { data, error } = await supabase
    .from('profiles')
    .select('telegram_chat_id')
    .eq('id', user.id)
    .maybeSingle();

  if (error) {
    return { success: false, error: error.message };
  }

  return {
    success: true,
    connected: Boolean(String(data?.telegram_chat_id ?? '').trim()),
  };
}

export async function disconnectTelegram() {
  const supabase = await createClient();

  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) {
    return { success: false, error: 'Não autorizado' };
  }

  const { error } = await supabase
    .from('profiles')
    .update({
      telegram_chat_id: null,
      updated_at: new Date().toISOString(),
    })
    .eq('id', user.id);

  if (error) {
    return { success: false, error: error.message };
  }

  revalidatePath('/settings');

  return {
    success: true,
    message: 'Telegram disconnected.',
  };
}

export async function sendTodayFlightInformation(selectedFlightKeys: string[] = []) {
  const supabase = await createClient();

  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) {
    return { success: false, error: 'Não autorizado' };
  }

  const uniqueSelectedKeys = [...new Set(selectedFlightKeys.map((key) => key.trim()).filter(Boolean))];
  if (uniqueSelectedKeys.length === 0) {
    return { success: false, error: 'Selecione ao menos um voo para enviar.' };
  }

  const botToken = process.env.TELEGRAM_BOT_TOKEN;
  if (!botToken) {
    return { success: false, error: 'Telegram bot token is not configured.' };
  }

  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('telegram_chat_id, timezone')
    .eq('id', user.id)
    .maybeSingle();

  if (profileError) {
    return { success: false, error: profileError.message };
  }

  const chatId = String(profile?.telegram_chat_id ?? '').trim();
  if (!chatId) {
    return { success: false, error: 'Conecte o Telegram nas configurações do perfil antes de enviar.' };
  }

  const timezone = String(profile?.timezone ?? 'America/Sao_Paulo');
  const { data: flights, error: flightsError } = await supabase
    .from('flight_leg_details')
    .select('unique_key, flight_number, origin, destination, departure_time, arrival_time, service_type, meal_type')
    .eq('user_id', user.id)
    .in('unique_key', uniqueSelectedKeys)
    .order('departure_time', { ascending: true });

  if (flightsError) {
    return { success: false, error: flightsError.message };
  }

  if (!flights?.length) {
    return { success: false, error: 'Nenhum voo selecionado foi encontrado.' };
  }

  const message = buildSelectedFlightMessage(flights, timezone);
  const response = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      chat_id: chatId,
      text: message,
      disable_web_page_preview: true,
    }),
  });

  const payload = await response.json().catch(() => null);
  if (!response.ok || payload?.ok === false) {
    return {
      success: false,
      error: payload?.description ?? 'Telegram could not send the message.',
    };
  }

  return {
    success: true,
    message: `${flights.length} ${flights.length === 1 ? 'voo enviado' : 'voos enviados'} pelo Telegram.`,
  };
}

async function getTelegramBotUsername(botToken: string) {
  const response = await fetch(`https://api.telegram.org/bot${botToken}/getMe`, {
    method: 'GET',
    cache: 'no-store',
  });

  const payload = await response.json().catch(() => null) as TelegramApiResult<TelegramBotInfo> | null;
  if (!response.ok || !payload?.ok) return null;

  return payload.result?.username ?? null;
}

function buildSelectedFlightMessage(flights: TodayFlight[], timezone: string) {
  const lines = [
    'Voos selecionados',
    '',
    ...flights.flatMap((flight, index) => [
      `${index + 1}. ${formatDisplayDate(getFlightRosterDate(flight))} ${formatTime(flight.departure_time, timezone)} ${flight.flight_number ?? '-'} ${flight.origin ?? '-'} -> ${flight.destination ?? '-'}`,
      `Crew service: ${flight.service_type ?? '-'}`,
      `Passenger service: ${flight.meal_type ?? '-'}`,
      '',
    ]),
  ];

  return lines.join('\n').trim();
}

function formatTime(value: string | null, _timezone: string) {
  if (!value) return '--:--';

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '--:--';

  return `${String(date.getUTCHours()).padStart(2, '0')}:${String(date.getUTCMinutes()).padStart(2, '0')}`;
}

function getFlightRosterDate(flight: Pick<TodayFlight, 'unique_key' | 'departure_time'>) {
  const keyDate = flight.unique_key?.match(/^(\d{4}-\d{2}-\d{2})-/)?.[1];
  if (keyDate) return keyDate;

  return flight.departure_time ? String(flight.departure_time).slice(0, 10) : '';
}

function formatDisplayDate(value: string) {
  const match = value.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return value;

  return `${match[3]}/${match[2]}/${match[1]}`;
}
