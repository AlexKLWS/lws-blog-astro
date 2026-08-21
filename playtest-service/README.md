# Player signup automation

A single Cloud Run function that runs playtest key giveaways for **any** of my
games. It takes a signup from a form on the website, atomically claims one Steam
key from that game's pool in Firestore, records who got it, and emails the key
with redemption instructions.

GCP project: **`player-signup-automation`**

```
Cloudflare Pages form  ──POST {campaign, name, email, …}──▶  Cloud Run function
                                                                   │
                                                    ┌──────────────┴─────────────┐
                                                    ▼                            ▼
                                        Firestore (per-campaign keys)      Resend (email)
```

## Adding a future game

Nothing in this service is game-specific, so a new game needs **no code changes
and no redeploy**. Three commands and one small page:

```sh
# 1. Create the campaign (this is where all the game's copy lives)
npm run create-campaign -- --campaign=my-next-game \
  --name="My Next Game" \
  --steam=https://store.steampowered.com/app/123456/My_Next_Game/

# 2. Import that game's keys
npm run import-keys -- --campaign=my-next-game ~/keys/next-game-batch1.txt
```

3. Add a page on the site that renders the shared form with the new campaign id
   — copy `src/pages/playtest.astro`, change two constants:

```astro
const CAMPAIGN = 'my-next-game'
const GAME_NAME = 'My Next Game'
```

That's it. Steam URL, feedback form link, sender address and sign-off all come
from the campaign document, and any of them can be omitted — the email adapts.

## Guarantees

- **No key is issued twice.** Claiming runs inside a Firestore transaction, so
  two simultaneous submissions can never receive the same key.
- **One key per email, per campaign.** A repeat submission resends the *same*
  key. The same person can still sign up for a different game, which is the
  behaviour you want.
- **A failed email never loses a key.** The key stays reserved for that address
  and `npm run retry-failed` resends it.
- **Campaigns are isolated.** Keys and signups are subcollections of the
  campaign, so exhausting or deleting one game's pool cannot touch another's.

## Layout

| Path | What it is |
| --- | --- |
| `index.js` | HTTP entry point: CORS, validation, orchestration |
| `src/config.js` | Env vars and constants — nothing game-specific |
| `src/campaigns.js` | Loads a campaign doc, applies defaults, caches briefly |
| `src/validate.js` | Input parsing and validation |
| `src/turnstile.js` | Cloudflare Turnstile verification |
| `src/firestore.js` | The claim transaction, rate limiting, delivery status |
| `src/email.js` | Resend call and the key email templates |
| `scripts/create-campaign.js` | Create or edit a campaign (also `--close` / `--open`) |
| `scripts/list-campaigns.js` | All campaigns with key counts |
| `scripts/import-keys.js` | Load `.txt` key files into a campaign |
| `scripts/stats.js` | Key pool + delivery health for one campaign |
| `scripts/export-signups.js` | Dump a campaign's signups to CSV |
| `scripts/retry-failed.js` | Resend failed emails |

## Firestore shape

```
campaigns/distant-light-prologue
  gameName:        "Distant Light Prologue"
  developer:       "Long Winter Shadows"
  steamAppUrl:     "https://store.steampowered.com/app/4785580/..."
  feedbackFormUrl: null            # optional; email adapts when unset
  fromEmail:       null            # optional; falls back to FROM_EMAIL
  replyTo:         null            # optional
  emailSubject:    null            # optional; defaults to "Your <game> playtest key"
  active:          true            # false = form politely refuses signups
  │
  ├── keys/key-000001
  │     code:      "ABCDE-12345-FGHIJ"
  │     batch:     "batch1.txt"
  │     status:    "available" | "claimed"
  │     seq:       1
  │     claimedBy: { email, name, willFillForm }
  │     claimedAt: <timestamp>
  │
  └── signups/{email}
        campaignId, email, name, willFillForm
        keyId, keyCode
        ip:       <sha256 prefix, not the raw address>
        delivery: { status: "pending"|"sent"|"failed", attempts, lastError, sentAt }
        createdAt

rateLimits/{hashed-ip}
  count, windowStart               # shared across all campaigns
```

No composite index is required. The claim query filters on `status` and orders
by document ID, which Firestore's automatic single-field index already serves.

---

# One-time setup

## 1. GCP project

```sh
# install the CLI first: https://cloud.google.com/sdk/docs/install
gcloud auth login
gcloud config set project player-signup-automation
```

Link a billing account in the console. Everything here sits inside the free tier
at playtest volumes, but Cloud Run and Firestore both require billing enabled.

```sh
gcloud services enable \
  run.googleapis.com \
  firestore.googleapis.com \
  secretmanager.googleapis.com \
  cloudbuild.googleapis.com \
  artifactregistry.googleapis.com
```

## 2. Firestore

```sh
gcloud firestore databases create --location=nam5    # or eur3
```

Native mode is the default and is what this service expects.

## 3. Resend

1. Sign up at <https://resend.com>.
2. Add the domain `longwintershadows.com` and create the DNS records it gives
   you **in Cloudflare** (set those records to *DNS only*, grey cloud, not
   proxied). Wait for verification.
3. Create an API key (sending permission is enough) — this is `RESEND_API_KEY`.

Sending from your verified domain rather than a personal Gmail is what keeps
these out of spam folders. One verified domain covers every future game.

## 4. Turnstile

1. Cloudflare dashboard → **Turnstile** → **Add widget**.
2. Hostnames: `blog.longwintershadows.com` and `localhost`.
3. Widget mode: **Managed**.
4. You get a **site key** (public, goes in the Astro build) and a **secret key**
   (goes in Secret Manager). One widget covers every game's form.

## 5. Store the secrets

```sh
printf 're_YOUR_KEY' | gcloud secrets create resend-api-key --data-file=-
printf '0xYOUR_SECRET' | gcloud secrets create turnstile-secret-key --data-file=-
```

## 6. Service account

```sh
PROJECT=player-signup-automation
gcloud iam service-accounts create playtest-fn --display-name="Player signup function"
SA="playtest-fn@$PROJECT.iam.gserviceaccount.com"

gcloud projects add-iam-policy-binding $PROJECT \
  --member="serviceAccount:$SA" --role="roles/datastore.user"

gcloud secrets add-iam-policy-binding resend-api-key \
  --member="serviceAccount:$SA" --role="roles/secretmanager.secretAccessor"
gcloud secrets add-iam-policy-binding turnstile-secret-key \
  --member="serviceAccount:$SA" --role="roles/secretmanager.secretAccessor"
```

## 7. Deploy

From this directory:

```sh
gcloud run deploy playtest-signup \
  --source . \
  --region europe-west1 \
  --allow-unauthenticated \
  --service-account playtest-fn@player-signup-automation.iam.gserviceaccount.com \
  --min-instances 0 \
  --max-instances 3 \
  --concurrency 10 \
  --timeout 60 \
  --set-env-vars 'ALLOWED_ORIGINS=https://blog.longwintershadows.com,FROM_EMAIL=Long Winter Shadows <playtest@longwintershadows.com>,REPLY_TO_EMAIL=alex@longwintershadows.com' \
  --set-secrets 'RESEND_API_KEY=resend-api-key:latest,TURNSTILE_SECRET_KEY=turnstile-secret-key:latest'
```

`--allow-unauthenticated` is required: the form is called from a browser by
anonymous visitors. Turnstile, the honeypot, the per-IP rate limit and the
one-key-per-email rule are what protect the endpoint.

`--max-instances 3` is a deliberate cost ceiling — no runaway bill if the URL
gets scraped.

Deploy prints a service URL like
`https://playtest-signup-xxxxxxxx-ew.a.run.app`. **This one URL serves every
game** — you never redeploy to add one.

## 8. Point the website at it

In the **Cloudflare Pages** project → Settings → environment variables, add to
the **production** environment:

```
PUBLIC_PLAYTEST_ENDPOINT   = https://playtest-signup-xxxxxxxx-ew.a.run.app
PUBLIC_TURNSTILE_SITE_KEY  = 0xYOUR_SITE_KEY
```

These are baked in at build time, so **redeploy the Pages site** after adding
them. Both values are public by design; neither secret key goes near the site.

## 9. Create the first campaign and load its keys

```sh
gcloud auth application-default login
export GOOGLE_CLOUD_PROJECT=player-signup-automation

npm install

npm run create-campaign -- --campaign=distant-light-prologue \
  --name="Distant Light Prologue" \
  --steam=https://store.steampowered.com/app/4785580/Distant_Light_Prologue/

npm run import-keys -- --campaign=distant-light-prologue --dry-run ~/keys/batch1.txt
npm run import-keys -- --campaign=distant-light-prologue ~/keys/batch1.txt ~/keys/batch2.txt
npm run campaigns
```

The importer skips keys already in that campaign, so re-running is safe and you
can add batches later. It refuses to import into a campaign that does not exist,
so a typo in `--campaign` cannot strand keys somewhere unreachable.

Keep the `.txt` files out of git. `playtest-service/keys/`, `*.keys.txt` and
`signups*.csv` are already gitignored.

## 10. Test it

Open `https://blog.longwintershadows.com/playtest`, sign up with your own
address, and confirm the email arrives. Then:

```sh
npm run stats -- --campaign=distant-light-prologue
```

Available count should have dropped by one. Submit the same email again — you
should get the *same* key back and the count should not move.

---

# Running it

```sh
npm run campaigns                                          # overview of everything
npm run stats -- --campaign=distant-light-prologue
npm run export -- --campaign=distant-light-prologue > signups.csv
npm run retry-failed -- --campaign=distant-light-prologue  # needs RESEND_API_KEY
```

Closing signups when a playtest ends — the form then shows a polite refusal
instead of erroring:

```sh
npm run create-campaign -- --campaign=distant-light-prologue --close
npm run create-campaign -- --campaign=distant-light-prologue --open
```

Adding the feedback form later. Everyone who ticked the box gets the link in
their key email from then on:

```sh
npm run create-campaign -- --campaign=distant-light-prologue --feedback=https://forms.gle/YOURFORM
```

People who signed up *before* you set it still have `willFillForm: true` in
Firestore — `npm run export` gives you their addresses to mail separately.
Campaign edits take up to 60s to take effect (the service caches them briefly).

## Local development

```sh
cp .env.example .env        # fill in your values
gcloud auth application-default login
export $(grep -v '^#' .env | xargs)
npm run dev                 # http://localhost:8080
```

Set `SKIP_TURNSTILE=1` to bypass the captcha locally. Run the site with
`PUBLIC_PLAYTEST_ENDPOINT=http://localhost:8080` to point the form at it.

Note that this talks to the **real** Firestore and will consume real keys. Make
a throwaway campaign with dummy keys for testing the full flow:

```sh
npm run create-campaign -- --campaign=test-campaign --name="Test Game"
printf 'AAAAA-BBBBB-CCCCC\nDDDDD-EEEEE-FFFFF\n' > /tmp/test-keys.txt
npm run import-keys -- --campaign=test-campaign /tmp/test-keys.txt
```

## Costs

At playtest scale this is effectively free: Cloud Run scales to zero, Firestore's
free tier covers tens of thousands of reads/writes a day, Resend gives 3,000
emails a month, and Turnstile is free. Adding more games does not change this.
The only reason a bill appears is abuse, which `--max-instances 3` caps.
