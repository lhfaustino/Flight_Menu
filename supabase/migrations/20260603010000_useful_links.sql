-- Useful links managed by the administrator.

CREATE TABLE IF NOT EXISTS public.useful_links (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  href TEXT NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS useful_links_href_unique_idx
  ON public.useful_links (href);

CREATE INDEX IF NOT EXISTS useful_links_active_sort_idx
  ON public.useful_links (is_active, sort_order, title);

ALTER TABLE public.useful_links ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated users can view active useful links" ON public.useful_links;
CREATE POLICY "Authenticated users can view active useful links"
  ON public.useful_links FOR SELECT
  TO authenticated
  USING (is_active = TRUE);

INSERT INTO public.useful_links (title, href, sort_order)
VALUES
  ('Acesso ao CrewLink', 'https://crewlink.prd.glo.weur.cloud.lhsystems.com/auth/realms/netline/protocol/openid-connect/auth?client_id=CREWLINK&response_type=code&redirect_uri=https%3A%2F%2Fcrewlink.prd.glo.weur.cloud.lhsystems.com%2Fcrew%2Fglo%2Fcrewlink%2FclApp%2Foauth2callback%3FcrewlinkService%3DcrewlinkForCrew%26crewlinkOperation%3DloadMainFrameSet', 10),
  ('Portal CAT2', 'https://portalcat2.voegol.com.br/login', 20),
  ('Troca de Senha', 'https://passwordreset.microsoftonline.com/Default.aspx', 30),
  ('RH Online', 'https://rhonlinegol.com.br/Corpore.Net/Login.aspx?autoload=false&ReturnUrl=%2fCorpore.Net%2fMain.aspx%3fActionID%3dFopPerFFActionWeb%26SelectedMenuIDKey%3dEnvelopeRH', 40),
  ('FORMS - DM, NC e Reembolso Alim.', 'https://forms.office.com/pages/responsepage.aspx?id=PHj9YEj690qUFvBqInyt9tAwwTP4gIpCm_QlY_hIYnxUQ0NKSzk0NldEVVdHR01DT1VaOVBFV0JGRS4u&route=shorturl', 50),
  ('FPO - mínimo de 60 dias pra solicitar', 'https://forms.office.com/Pages/ResponsePage.aspx?id=PHj9YEj690qUFvBqInyt9rBxSO-N4MBGq1RZRGUtibpUNjJERktEVFRUVkdJWFBLUFI3T01XMUYzRy4u', 60),
  ('Troca Escala', 'https://trocaescala.voegol.com.br/', 70),
  ('Portal do Conhecimento', 'https://portaldoconhecimentogol-account.neolude.com.br/Account/Login?ReturnUrl=%2f', 80),
  ('Benefício Viagem', 'https://novobeneficioviagem.voegol.com.br/account/login', 90),
  ('Chamados JIRA', 'https://centraldeservicos.golsmiles.com.br/login', 100),
  ('Pedido de Folgas', 'https://folgas.voegol.com.br/mLogin.aspx', 110),
  ('IADP', 'https://lsyiadp.voegol.com.br/#/login', 120),
  ('CAO - Comissários', 'https://wa.me/+5511986998609', 130),
  ('Colaborador Mobile', 'https://novocolaboradormobile.voegol.com.br/', 140),
  ('My ID Travel', 'https://www.myidtravel.com/myidtravel/rui/login', 150),
  ('Solicitar Férias - Banco de DM - POWER BI', 'https://app.powerbi.com/', 160),
  ('Gal (whats)', 'https://wa.me/+5511991566944', 170),
  ('Passe Livre - Azul', 'https://passelivre.voeazul.com.br/login', 180),
  ('Passe Livre - LATAM', 'https://passelivre.appslatam.com/#/', 190),
  ('Whats Escala', 'http://wa.me/+5511992027273', 200),
  ('Catering Report - Form', 'https://pt.surveymonkey.com/r/CATERING_REPORT', 210),
  ('GRU - AMS - Info de Voos', 'https://ams.gru.com.br/', 220),
  ('ANAC - CHT', 'https://sso.anac.gov.br/auth/realms/producao/protocol/openid-connect/auth?client_id=client-novacht&redirect_uri=https%3A%2F%2Fnovacht.anac.gov.br%2FNOVACHT%2Fowin%2Fcallback&response_type=code%20token%20id_token&scope=openid&state=OpenIdConnect.AuthenticationProperties%3DvFJVqxVOo3vROauko98Qq6B4osPw3VTJNLnWporWxHu2yjNopcCh1cVk9kbe7Z6lw6ka_5XBx_WPgtgSxGihc1QKr1Qg6T12VjhmGWd0eHFdZm1R3UnFX477C6zDfmzTPNwjDea5iM6fBo0ubE0l0LQswCIB-twLvBgbOL7xRyC_OLhtt7RLMgMqudDDL3azYD2fFqNkwcdKzYly3l-0qi2g-jwMIDUUP3S_JNypEGMVGFLc7UJzEsRRkcxCuMzj&response_mode=form_post&nonce=639076313944912612.MDFjY2I5MzMtMzE3ZC00OWZjLTlhNjYtNDQ1MzdjN2Y1NDE5ZGE2NjBkODMtYjA3ZC00MjBjLTk5ODItNThhMDI4ZjViNWFi&x-client-SKU=ID_NET461&x-client-ver=5.3.0.0', 230),
  ('Benefícios de Escala - Form', 'https://grupogol.mybeehome.com/wiki/266/detail', 240),
  ('Portal Preferência de Escala', 'https://portal-escala.voegol.com.br/', 250),
  ('Porta casaco / Tag (Douglas)', 'https://wa.me/554191244129', 260),
  ('Portal de Uniformes', 'https://portalc2i.com.br/gol', 270),
  ('Biblioteca Trip. Com. / Planilhas Beehome', 'https://grupogol.mybeehome.com/wiki/258/detail', 280)
ON CONFLICT (href) DO UPDATE SET
  title = EXCLUDED.title,
  sort_order = EXCLUDED.sort_order,
  updated_at = NOW();
