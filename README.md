# Bang Order

Lightweight order recap & fulfillment validation tool for Shopee sellers.
Not an ERP, not accounting, not warehouse software — just: import orders, recap them, validate status.

Stack: vanilla HTML/CSS/JS, Chart.js, SheetJS, Supabase (Auth + Postgres). Hosted on Vercel, source on GitHub.

---

## 1. Set up Supabase

1. Create a project at [supabase.com](https://supabase.com).
2. Go to **SQL Editor** → paste the contents of `sql/schema.sql` → Run.
   This creates `stores`, `orders`, `order_items`, `validations`, the `validation_status` enum, and RLS policies.
3. Go to **Authentication → Users** → **Add user** → create at least one seller/admin login (email + password).
   This app uses simple email/password auth — no public sign-up page, since sellers are added by you.
4. Go to **Project Settings → API** → copy:
   - **Project URL**
   - **anon public key**

## 2. Configure the app

Open `js/config/supabase.config.js` and replace:

```js
const SUPABASE_URL = "https://YOUR_PROJECT_ID.supabase.co";
const SUPABASE_ANON_KEY = "YOUR_SUPABASE_ANON_PUBLIC_KEY";
```

with the values from step 1.4. That's the only config needed — no build step, no environment variables required since this is a static site calling Supabase directly from the browser using the public anon key (safe by design, protected by RLS).

## 3. Push to GitHub

```bash
cd bang-order
git init
git add .
git commit -m "Initial commit — Bang Order"
git branch -M main
git remote add origin https://github.com/<your-username>/bang-order.git
git push -u origin main
```

## 4. Deploy on Vercel

1. Go to [vercel.com/new](https://vercel.com/new) → Import the GitHub repo.
2. Framework preset: **Other** (static site, no build command needed).
3. Root directory: leave as `/`.
4. Deploy.

Vercel will serve `index.html`, `/pages/*.html`, `/css/*`, `/js/*` as static files. No environment variables needed since Supabase keys live in `supabase.config.js` (public anon key is safe to expose; access is controlled by RLS policies in the database, not by hiding the key).

## 5. First login

Visit your Vercel URL → you'll land on `/pages/login.html` → log in with the user you created in step 1.3.

Then:
1. Go to **Settings → Store Management → Add Store** (at least one store is required before importing).
2. Go to **Import**, select the store, upload a Shopee `.xlsx` export.
3. Check **Dashboard** and **Orders** to recap and validate.

---

## Upgrading an existing deployment (v1.0 → v2.0)

If you already deployed Bang Order before, don't re-run the whole `sql/schema.sql` — just apply the new migrations in order:

1. Supabase Dashboard → SQL Editor → paste the contents of `sql/migrations/002_import_history.sql` → Run.
2. Then paste and run `sql/migrations/003_inventory.sql`.
3. Then paste and run `sql/migrations/004_bulk_inventory_upload.sql`.
4. Then paste and run `sql/migrations/005_inventory_image_url.sql`.
5. Then paste and run `sql/migrations/006_returns.sql`.
   (All are safe to re-run — every statement checks "if not exists" first. If the ALTER TYPE statement in 006 errors, run it alone first, then the rest of the file separately.)
6. Then paste and run `sql/migrations/007_branding.sql`.
7. Pull/copy the updated `js/`, `css/`, and `pages/` files into your deployed repo, commit, push — Vercel redeploys automatically.

**What 002 adds:** the `import_batches` table + `orders.batch_id` for the **Riwayat Resi** (Import History) section on the Import page.

**What 003 adds:** the `inventory` + `inventory_movements` tables for the new **Inventory** page — global per-SKU stock, auto-deducted on import, auto-restored when an order is Cancelled, with a full movement history. No existing data is modified or deleted.

**What 004 adds:** a `BULK_SET` movement type, used by the **"Upload from Shopee"** button on the Inventory page — lets you bulk-register/update stock from Shopee's own "Mass Update Sales Info" export instead of adding SKUs one by one.

**What 005 adds:** an optional `image_url` on each SKU — a plain link you paste in manually (from Shopee's CDN, Google Drive, etc.), shown as a small thumbnail. No file upload or storage involved — just a link with a graceful fallback if it's broken.

**What 006 adds:** the **Returns** page — a `RETURNED` order status, plus a `returns` table tracking Shopee's 30-day damage-claim window per order. Resolving a return as "Kondisi Baik" (Good Condition) restores stock to Inventory after confirmation; "Telah Banding" / "Berhasil Diklaim" mark the order Returned without touching stock (damaged/lost goods).

**No migration needed for the language switcher** (Indonesian/English) — it's pure frontend, no database changes.

**What 007 adds:** the **Branding** section in Settings — lets you rename the app (e.g. "Bang Order" → your own product name) and upload a custom logo, shown everywhere the sidebar brand and login screen appear. If you skip this migration, the app still works fine — it just falls back to showing "Bang Order" with the default logo, and Settings shows a notice telling you to run the migration.

**Bug fixes applied after a full logic audit (no new migration needed):**
- Order status dropdown no longer shows a status that failed to save — it reverts if the database write fails.
- If a status change succeeds but the follow-up stock adjustment fails, the app now says so explicitly instead of a generic error (previous behavior could leave stock silently out of sync with no way to retry just that step).
- Import no longer risks "partial success read as total failure" — if orders save successfully but Upload History or Inventory deduction fails afterward, you're told exactly what didn't work instead of a blanket "import failed" (which could previously tempt a re-upload that got silently skipped as duplicates).
- Bulk-uploading SKUs from Shopee now matches existing SKUs case-insensitively (e.g. "w36" in a file now correctly matches an existing "W36" instead of creating a near-duplicate row).
- Store name now shows up when searching for orders to return, so multi-store sellers can tell orders apart if SNs or tracking numbers look similar across stores.

## Language (Indonesian / English)

Bang Order ships with a small built-in translation system (`js/i18n/`) covering the whole app — Indonesian by default, with an English toggle in **Settings → Language**. Only built-in interface text is translated; anything a user types (product names, notes, store names) stays exactly as entered.

- `js/i18n/translations.js` — the dictionary. Every key exists in both `id` and `en`.
- `js/i18n/i18n.js` — the runtime (`t('some.key')`, `I18n.setLocale('en')`), persisted in the browser via `localStorage`.
- Switching language reloads the current page (this isn't a single-page app, so a full reload is the simplest way to re-render every string).

**Adding a new piece of UI text:** add the key to *both* `id` and `en` objects in `translations.js` (same dot-path in each), then reference it with `t('your.new.key')` in the relevant page/component file. If a key is ever missing from the current language, it silently falls back to English, then to the raw key string — it will never crash the page.

## White-labeling (rename + logo)

Settings → Branding lets whoever runs this deployment rename the app and upload their own logo — useful if you're reselling this source code and want each buyer to make it their own product. Implementation notes:

- Stored in a single-row `app_settings` table (`js/services/appSettings.service.js`) — no Supabase Storage needed. The logo is saved as a base64 data URL directly in Postgres, capped at 300 KB client-side, which keeps the whole app dependent on Postgres only.
- The name/logo are readable by anyone (even logged out) since they need to show on the login screen before auth — but only authenticated users can change them. Nothing sensitive is stored here.
- `js/components/Shell.js` fetches and renders this on every page; if migration 007 hasn't been applied yet, it fails safe and falls back to "Bang Order" with the default mark instead of breaking the page.

## Project structure

```
/assets            static images/icons
/css               base.css, layout.css, components.css, /pages/*.css
/js
  /config          supabase.config.js (only file with credentials)
  /i18n            translations.js (ID + EN dictionary), i18n.js (runtime)
  /services        auth, store, order, import, dashboard — all Supabase calls live here
  /components      Toast, StatusBadge, Table, Drawer, ProgressStepper, Dropdown, Shell
  /pages           one controller per page (dashboard/orders/import/settings).page.js
  /utils           formatters, validators, dedupe, excelParser
/pages             login.html, dashboard.html, orders.html, import.html, settings.html
/sql               schema.sql — run once in Supabase SQL Editor
index.html         redirects to /pages/login.html or /pages/dashboard.html based on session
```

## Notes on the Shopee Excel import

`js/utils/excelParser.js` auto-detects and supports **two** export formats:

- **Format A — packed `product_info`** (e.g. bulk/logistics "Daftar Pesanan" exports):
  one row per order, with all SKUs packed into a single `product_info` cell like
  `[1] Nama Produk:...; Harga: Rp 14,500; Jumlah: 1; Nomor Referensi SKU: W36; ...`.
  The parser splits this into one line item per `[n]` block.
- **Format B — classic flat per-SKU export** (Shopee Seller Center's own download):
  one row per SKU already, with columns like `No. Pesanan`, `Nomor Referensi SKU`, `Jumlah`.

The parser checks the header row against both formats and uses whichever matches. If your export uses different header text than either format, add the alias to `FORMAT_A_HEADERS` or `FORMAT_B_HEADERS` in that file.

Duplicate orders (same `order_sn` within the same store) are automatically skipped — this is enforced both at the database level (`unique(store_id, order_sn)`) and pre-checked client-side before insert for a clean "X duplicates skipped" message.
