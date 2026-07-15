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

## Project structure

```
/assets            static images/icons
/css               base.css, layout.css, components.css, /pages/*.css
/js
  /config          supabase.config.js (only file with credentials)
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
