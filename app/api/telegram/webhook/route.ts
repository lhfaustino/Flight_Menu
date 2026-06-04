import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';

type TelegramUpdate = {
  message?: {
    chat?: {
      id?: number | string;
    };
    text?: string;
  };
};

export async function POST(request: NextRequest) {
  const expectedSecret = process.env.TELEGRAM_WEBHOOK_SECRET;
  if (expectedSecret) {
    const providedSecret = request.headers.get('x-telegram-bot-api-secret-token');
    if (providedSecret !== expectedSecret) {
      return NextResponse.json({ ok: false, error: 'Não autorizado' }, { status: 401 });
    }
  }

  const update = await request.json().catch(() => null) as TelegramUpdate | null;
  const chatId = update?.message?.chat?.id;
  const text = update?.message?.text?.trim() ?? '';

  if (!chatId) {
    return NextResponse.json({ ok: true });
  }

  const token = extractStartToken(text);
  if (!token) {
    await sendTelegramMessage(String(chatId), 'Abra o Telegram pelas configurações do Flight Menu para conectar sua conta.');
    return NextResponse.json({ ok: true });
  }

  const supabase = createAdminClient();
  const { data: linkToken, error: tokenError } = await supabase
    .from('telegram_link_tokens')
    .select('id, user_id, expires_at, used_at')
    .eq('token', token)
    .maybeSingle();

  if (tokenError || !linkToken || linkToken.used_at || new Date(linkToken.expires_at).getTime() < Date.now()) {
    await sendTelegramMessage(String(chatId), 'Este link de conexão do Flight Menu expirou. Crie um novo nas configurações.');
    return NextResponse.json({ ok: true });
  }

  const now = new Date().toISOString();
  const { error: profileError } = await supabase
    .from('profiles')
    .update({
      telegram_chat_id: String(chatId),
      updated_at: now,
    })
    .eq('id', linkToken.user_id);

  if (profileError) {
    await sendTelegramMessage(String(chatId), 'O Flight Menu não conseguiu conectar o Telegram. Tente novamente.');
    return NextResponse.json({ ok: false, error: profileError.message }, { status: 500 });
  }

  await supabase
    .from('telegram_link_tokens')
    .update({ used_at: now })
    .eq('id', linkToken.id);

  await sendTelegramMessage(String(chatId), 'Telegram conectado ao Flight Menu.');

  return NextResponse.json({ ok: true });
}

function extractStartToken(text: string) {
  const match = text.match(/^\/(?:start|connect)(?:@\w+)?\s+([A-Za-z0-9_-]+)$/);
  return match?.[1] ?? null;
}

async function sendTelegramMessage(chatId: string, text: string) {
  const botToken = process.env.TELEGRAM_BOT_TOKEN;
  if (!botToken) return;

  await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      chat_id: chatId,
      text,
      disable_web_page_preview: true,
    }),
  }).catch(() => null);
}
