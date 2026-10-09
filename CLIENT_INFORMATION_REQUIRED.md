# Whitenow — Information Required From the Client

Nothing below has been invented. Each item says **when** it is needed and whether it **affects architecture now**
(🏗 = needed before or during the first implementation phases) or can be **prepared later** (🕓 = before submission).

## 1. Accounts and ownership

| # | Item | Why | Timing |
|---|---|---|---|
| 1 | Apple Developer account (exists? who owns it? team id) | Bundle id registration, push keys, TestFlight | 🏗 |
| 2 | Apple account type: **Organization** or Individual | Listing shows company name; Custom App/Unlisted distribution needs Organization | 🏗 |
| 3 | Google Play Developer account (exists? owner?) | Package registration, internal testing | 🏗 |
| 4 | Google Play account type (Organization / Personal) | — | 🏗 |
| 5 | Google Play account **creation date** | Personal accounts created after Nov 2023 must run closed testing (12 testers, 14 days) before production | 🏗 (affects timeline) |
| 6 | Developer / company legal name and address | Store listings, privacy policy, D-U-N-S for Apple organization | 🕓 |
| 7 | Access to Firebase project `white-now-erp` (owner/editor) and permission to create a **staging** project | Register mobile apps, rules, indexes, push | 🏗 |
| 8 | Backend hosting details (Render? plan? who deploys?) and production URL | Mobile API base URL; review requires backend always on | 🏗 |
| 9 | Expo / EAS account (organization) | Builds, credentials, updates | 🏗 |

## 2. App identity

| # | Item | Why | Timing |
|---|---|---|---|
| 10 | App name (≤30 chars for Apple) and display name on home screen | Listings, `app.json` | 🏗 |
| 11 | **iOS bundle identifier** (e.g. `com.company.whitenow`) — permanent | Firebase iOS app, push, signing | 🏗 |
| 12 | **Android package name** — permanent | Firebase Android app, Play listing | 🏗 |
| 13 | App icon (1024×1024, no transparency for iOS) and splash artwork | `app.json`; the web app currently uses `logo.png` and placeholder "Logo" text | 🏗 (placeholder ok) / 🕓 final |
| 14 | Brand colours / fonts (web uses `#20C2F3`, `#00305D`) | Theme | 🏗 |
| 15 | Domain for deep links (to keep printed project QR codes working) | Universal links / App Links | 🏗 |

## 3. Policy, privacy and legal

| # | Item | Why | Timing |
|---|---|---|---|
| 16 | **Privacy policy URL** (or approval of a draft) covering location at clock-in, photos, signatures, payroll, documents, retention, deletion, third parties (Google/Firebase, OpenStreetMap or chosen map provider) | Both stores require it in-app and in listing | 🕓 (draft early) |
| 17 | **Support URL** and **support email** | Both stores | 🕓 |
| 18 | **Account deletion process** and public **deletion request URL** | Both stores; Play needs a web URL | 🏗 (backend design) |
| 19 | **Data retention rules**: what must be kept after deletion (payroll, attendance, signed visit records) and for how long | Deletion flow design + privacy policy | 🏗 |
| 20 | Country / jurisdiction and **business timezone** | GDPR or other law; fixes the date/timezone bugs (attendance dates, auto clock-out) | 🏗 |
| 21 | Whether employees have consented (contract/policy) to location capture at clock-in | Disclosure wording, legal | 🕓 |
| 22 | Whether leave attachments can contain **medical** information | Health data declarations | 🕓 |
| 23 | Age rating questionnaire answers / content declarations | Both stores | 🕓 |
| 24 | Data Safety (Play) and App Privacy (Apple) sign-off | Must match reality; we will pre-fill from the audit | 🕓 |

## 4. Product decisions that change behaviour

| # | Decision | Options | Timing |
|---|---|---|---|
| 25 | Keep **public self-signup**? | Client only · Client + Employee with admin approval · Invite-only (admins create all accounts) | 🏗 |
| 26 | Clock-in when **location is denied/unavailable** | Block (as web) · Allow but flag for admin review | 🏗 |
| 27 | Keep the **2 km** distance threshold? Per-project radius? | — | 🏗 |
| 28 | Should the **public project QR page** stay public, require login, or open the app? | — | 🏗 |
| 29 | Which **push notifications** are wanted (list in FIREBASE_MOBILE_AUDIT §5) | — | 🏗 (phase planning) |
| 30 | **Distribution**: public App Store / Play listing, or private (Apple Custom/Unlisted, managed Google Play) | — | 🏗 |
| 31 | **iPad** support required? | — | 🕓 |
| 32 | Languages (web is English-only) | i18n setup | 🏗 |
| 33 | Approval to add **authentication to the Node backend** endpoints and a self-deletion endpoint (small additive change shared with the web app). *Update 9 Oct 2026:* `/create-user` and `/delete-user` now require an Admin ID token (`whitenow-revamp@cc83423`); the self-deletion endpoint and `/cron/auto-clockout` authentication are still outstanding | Required for security and store deletion rule | 🏗 |
| 34 | Approval to rotate the committed Firebase **service-account keys** and to publish corrected Firestore/Storage rules. *Update 9 Oct 2026:* hardened rules published to `white-now-erp`; key rotation not confirmed in the docs | Security | 🏗 |
| 35 | Map/geocoding provider (Apple/Google maps, MapTiler, etc.) and who pays for API keys | Replaces public OSM/Nominatim | 🏗 |

## 5. Review and testing

| # | Item | Why | Timing |
|---|---|---|---|
| 36 | **Demo accounts** for Client, Staff and Admin (or approval to create them in a staging project) | App Review / App access | 🕓 (create early) |
| 37 | Demo data: projects, schedules, tasks, documents, payroll month with proof PDF | Reviewer must see every feature | 🕓 |
| 38 | Reviewer instructions text (how to clock in, distance rule, roles) | Review notes | 🕓 |
| 39 | List of internal testers (emails) for TestFlight / Play internal & closed testing | Testing; Play closed-testing rule | 🏗 |
| 40 | A copy of the **current production Firestore and Storage rules** and indexes | Audit could not read the console | 🏗 |

## 6. Store listing content

| # | Item | Timing |
|---|---|---|
| 41 | Short description (Play, 80 chars) and full description (both stores) | 🕓 |
| 42 | Keywords (Apple), promotional text | 🕓 |
| 43 | Screenshots per required device size (we can generate from the app once built) | 🕓 |
| 44 | Play **feature graphic** 1024×500 | 🕓 |
| 45 | Category (e.g. Business / Productivity) | 🕓 |
| 46 | Copyright line / marketing URL | 🕓 |

Items marked 🏗 above should be answered before the Expo foundation phase starts; 1–5, 7–12, 20, 25, 26, 33 and 34 are the most urgent.
