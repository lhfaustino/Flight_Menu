# Deploy Flight Menu with GitHub, Cloudflare, and Coolify

This guide publishes the Next.js app from GitHub, points a Cloudflare domain to the server, and deploys the app with Coolify.

Official references:

- Coolify applications: https://coolify.io/docs/applications
- Coolify environment variables: https://coolify.io/docs/knowledge-base/environment-variables
- Cloudflare DNS records: https://developers.cloudflare.com/dns/manage-dns-records/how-to/create-dns-records/
- Cloudflare proxy status: https://developers.cloudflare.com/learning-paths/modules/get-started/onboarding/proxy-dns-records/

## 1. Prerequisites

You need:

- A GitHub account and repository access.
- A server/VPS with Coolify already installed and reachable.
- A domain managed in Cloudflare.
- A Supabase project for production.
- The production domain you want to use, for example `https://flight-menu.example.com`.

Recommended production DNS shape:

- App domain: `flight-menu.example.com`
- Coolify dashboard domain, if needed: `coolify.example.com`

## 2. Prepare Supabase

Open **Supabase Dashboard -> SQL Editor** and run the project SQL files that are not already applied to the production database.

At minimum, this app currently needs:

```text
supabase/repair_flight_schema.sql
supabase/migrations/20260531000000_profile_settings.sql
supabase/migrations/20260531010000_meal_plan_email_ingest.sql
supabase/migrations/20260606000000_disable_email_confirmation.sql
```

Then configure Supabase Auth URLs:

1. Go to **Authentication -> URL Configuration**.
2. Set **Site URL** to your production app URL:
   ```text
   https://flight-menu.example.com
   ```
3. Add **Redirect URLs**:
   ```text
   https://flight-menu.example.com/auth/callback
   http://localhost:3000/auth/callback
   ```

Then disable email confirmation for every email/password user:

1. Go to **Authentication -> Providers -> Email**.
2. Turn off **Confirm email**.
3. Save the provider settings.
4. Run `supabase/migrations/20260606000000_disable_email_confirmation.sql` in the SQL Editor, or run the latest `supabase/repair_flight_schema.sql`, to mark existing email users confirmed.

Copy these Supabase values for Coolify later:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`

Keep the service role key private. It is server-side only.

## 3. Publish to GitHub

From the project folder:

```bash
cd "C:\Users\lyhen\OneDrive\Documentos\flight_menu\Flight menu"
```

Check what will be committed:

```bash
git status
```

Create a new GitHub repository. Do not initialize it with README/license/gitignore if this local project already has files.

If this repo has no remote yet:

```bash
git add .
git commit -m "Prepare Flight Menu deployment"
git branch -M main
git remote add origin https://github.com/YOUR_USER/YOUR_REPO.git
git push -u origin main
```

If the remote already exists:

```bash
git remote -v
git remote set-url origin https://github.com/YOUR_USER/YOUR_REPO.git
git add .
git commit -m "Update Flight Menu deployment"
git push -u origin main
```

After pushing, confirm the files appear in GitHub.

## 4. Configure Cloudflare DNS

In Cloudflare:

1. Select your domain.
2. Go to **DNS -> Records**.
3. Add a record for the app.

If your Coolify server has a fixed public IP:

```text
Type: A
Name: flight-menu
IPv4 address: YOUR_SERVER_IP
Proxy status: Proxied
TTL: Auto
```

If your hosting provider gives a hostname instead of an IP:

```text
Type: CNAME
Name: flight-menu
Target: your-server-hostname.example.com
Proxy status: Proxied
TTL: Auto
```

Cloudflare proxied DNS returns Cloudflare IPs to visitors and forwards traffic to your origin server. This is expected.

## 5. Configure Cloudflare SSL/TLS

In Cloudflare:

1. Go to **SSL/TLS -> Overview**.
2. Set encryption mode to **Full (strict)** if Coolify/your server has a valid certificate.
3. If the first deploy is not serving HTTPS yet, use **Full** temporarily, then switch to **Full (strict)** after Coolify issues the certificate.

Recommended final state:

```text
SSL/TLS mode: Full (strict)
DNS proxy: Proxied
App URL: https://flight-menu.example.com
```

Avoid **Flexible** SSL for this app. It can cause redirect/session issues because the browser uses HTTPS while the origin receives HTTP.

## 6. Create the Coolify Application

In Coolify:

1. Go to your project.
2. Click **New Resource**.
3. Choose **Application**.
4. Select **GitHub Repository**.
5. Connect/install the GitHub App if Coolify asks.
6. Select your repository and branch `main`.
7. Choose the server/destination.
8. Use **Nixpacks** or buildpack auto-detection for Next.js.

Set these commands:

```bash
npm run build
```

```bash
npm run start
```

Set exposed port:

```text
3000
```

## 7. Configure Coolify Environment Variables

In the Coolify application, open **Environment Variables** and add:

```bash
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-supabase-anon-key
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=your-supabase-publishable-key
NODE_ENV=production
NEXT_PUBLIC_APP_URL=https://flight-menu.example.com
SUPABASE_SERVICE_ROLE_KEY=your-supabase-service-role-key
ENCRYPTION_KEY=replace-with-a-secure-32-byte-base64-value
INBOUND_EMAIL_SECRET=replace-with-a-long-random-secret
```

Generate `ENCRYPTION_KEY` locally:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
```

Generate `INBOUND_EMAIL_SECRET` as a long random value. It protects:

```text
/api/inbound/meal-plan-email
```

Inbound email providers should call that endpoint with:

```text
x-inbound-secret: your-long-random-secret
```

## 8. Configure the Coolify Domain

In the Coolify application:

1. Open **Domains**.
2. Add:
   ```text
   https://flight-menu.example.com
   ```
3. Save.
4. Redeploy or restart the application if Coolify asks.

Coolify should route the domain to the app and handle the app container on port `3000`.

## 9. Deploy

In Coolify:

1. Click **Deploy**.
2. Watch the build logs.
3. Confirm `npm run build` completes.
4. Confirm the container starts with `npm run start`.

If the first deploy fails:

- Check missing environment variables.
- Check Supabase URL/key values.
- Check that `SUPABASE_SERVICE_ROLE_KEY` is set only in Coolify/server env.
- Check that the domain is saved as `https://...`, not only the bare hostname.

## 10. Test the Production App

Open:

```text
https://flight-menu.example.com
```

Test:

- `/login`
- login redirects to `/roster-upload`
- `/settings` profile details save correctly
- avatar upload works
- manual PDF upload via `Enviar Arquivos`
- flight rows appear in the Planilha table
- Supabase rows are saved in `flight_leg_details`
- automatic meal plan email webhook returns `success: true`

Example webhook test:

```bash
curl -X POST "https://flight-menu.example.com/api/inbound/meal-plan-email" ^
  -H "content-type: application/json" ^
  -H "x-inbound-secret: your-long-random-secret" ^
  -d "{\"userEmail\":\"user@example.com\",\"text\":\"Download PDF: https://example.com/meal-plan.pdf\"}"
```

On macOS/Linux, replace `^` with `\`.

## 11. Configure Inbound Email Automation

Use an inbound email provider such as Resend, Postmark, SendGrid Inbound Parse, or Mailgun Routes.

Configure the provider to send email payloads to:

```text
https://flight-menu.example.com/api/inbound/meal-plan-email
```

Required header:

```text
x-inbound-secret: your-long-random-secret
```

The payload can be JSON or form-data. It should include:

```json
{
  "userEmail": "user@example.com",
  "subject": "Meal plan",
  "text": "PDF link: https://example.com/path/to/meal-plan.pdf"
}
```

The app will:

1. Match `userEmail` to `profiles.email`.
2. Find a PDF link in `text`, `html`, or `body`.
3. Download the PDF.
4. Parse the catering/meal plan rows.
5. Upsert `catering_rules`.
6. Update matching existing `flight_leg_details`.
7. Save an ingestion record in `meal_plan_sources`.

## 12. Troubleshooting

### Domain does not open

- Confirm Cloudflare DNS record points to the Coolify server.
- Confirm ports `80` and `443` are open on the server/firewall.
- Confirm the domain is added in Coolify.
- Confirm the app container is running.

### HTTPS or redirect issues

- Prefer Cloudflare **Full (strict)** once Coolify has a valid certificate.
- Avoid Cloudflare **Flexible** SSL.
- Confirm `NEXT_PUBLIC_APP_URL` exactly matches the production domain.
- Confirm Supabase Auth redirect URL includes `/auth/callback`.

### Login works locally but not in production

- Check `NEXT_PUBLIC_SUPABASE_URL`.
- Check `NEXT_PUBLIC_SUPABASE_ANON_KEY`.
- Check Supabase Site URL and Redirect URLs.
- Redeploy after changing env vars.

### Avatar upload fails

- Confirm `20260531000000_profile_settings.sql` was applied.
- Confirm the `avatars` storage bucket exists.
- Confirm the file is JPG, PNG, GIF, or WebP and under 1MB.

### Email automation fails

- Confirm `20260531010000_meal_plan_email_ingest.sql` was applied.
- Confirm `INBOUND_EMAIL_SECRET` is set in Coolify.
- Confirm the inbound provider sends the `x-inbound-secret` header.
- Confirm the email body contains a reachable PDF link.
- Check `meal_plan_sources.last_error` in Supabase.
