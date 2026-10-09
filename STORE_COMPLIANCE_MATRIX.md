# Whitenow — Store Compliance Matrix (Google Play + Apple App Store)

Preliminary, design-stage audit (2026-10-07). It is based on the traced behaviour of the web app
(`whitenow-revamp@b1c1b99`, see note below) and the planned Expo app. It was produced with the installed Play policy and App Store
review skills plus the code audit. **It does not predict approval.** Every item must be re-verified against the real
build (merged `AndroidManifest.xml`, generated `Info.plist`, privacy manifest) and the policies current at submission.

> **Reference update (10 Oct 2026):** commit hashes in this document refer to the **`whitenow-revamp`** repository, not `whitenow-mobile`. The original snapshot `eb10728` no longer exists in that repository's history; the current reference is `b1c1b99` (Firebase security hardening documentation, `prod`). Statements affected by the 9 Oct 2026 hardening are corrected inline; see `whitenow-revamp/docs/FIREBASE_SECURITY_HARDENING.md`.

Risk classes: **REQUIRED** (must be done to submit) · **HIGH RISK** · **MEDIUM RISK** · **LOW RISK** · **INFORMATION NEEDED**.

---

## 0. Data actually collected or processed (from code, not assumed)

| Data | Collected? | Source in web app | Who can see it | Notes |
|---|---|---|---|---|
| Name | Yes | signup, admin forms | admin; employees see clients and vice versa | |
| Email | Yes | Auth + profiles | admin; others via profile reads | |
| Phone | Yes | signup, admin forms | admin; readable by other roles under current rules | |
| Date of birth | Yes | signup, admin forms | admin | Not obviously necessary for clients — data minimisation question |
| Home / service address + coordinates | Yes | `AddressField` (geocoded) | admin (map), staff (job address) | Sent to Nominatim (OSM) |
| Precise device location | Yes, once at clock-in | `navigator.geolocation` | admin (distance, coordinates stored on attendance) | Foreground only; stored indefinitely today |
| Photos | Yes | clock-out job photos (≤5), feedback image, profile photo, documents | admin, client (job photos), staff | Taken inside client premises |
| Signature | Yes (optional) | customer signature PNG + signer name | admin, client, staff | |
| Documents / files | Yes | client documents, leave attachments, payroll proofs | client (own), staff (own), admin | Leave attachments may be medical (sick notes) |
| Employment / HR data | Yes | job title, licence, contract type, qualifications, availability, leave balance | admin | |
| Financial (salary, bonus, tax %) | Yes | payroll + employee doc | admin, employee (own) | No payments processed |
| Attendance / work time | Yes | attendance | admin, employee (own), client (visits on own projects) | |
| Feedback text | Yes | feedback / clientFeedback | admin | |
| Device identifiers | Firebase installation id only (SDK) | Firebase SDK | — | FCM token once push is added |
| Analytics / crash data | **No** | — | — | No SDKs present |
| Advertising / tracking | **No** | — | — | |
| Third-party data | OSM tiles, Nominatim geocoding receive IP + addresses | | | Counts as sharing unless proxied |

---

## Google Play

### Permissions (Android)

| Permission | Feature | Sensitive / restricted | Alternative | Play review risk |
|---|---|---|---|---|
| `ACCESS_FINE_LOCATION` + `ACCESS_COARSE_LOCATION` | Clock-in distance check (Staff) | Dangerous (runtime), not restricted while foreground-only | Coarse-only would weaken the 2 km check; fine is justified | LOW if foreground-only; **HIGH** if `ACCESS_BACKGROUND_LOCATION` slips in |
| `ACCESS_BACKGROUND_LOCATION` | none | Restricted (declaration + video) | Not needed | Must be **blocked** |
| `FOREGROUND_SERVICE_LOCATION` | none | Restricted | Not needed | Block |
| `CAMERA` | Job photos, profile photo, feedback image | Dangerous | `launchCameraAsync` via image picker | LOW |
| `READ_MEDIA_IMAGES` / `READ_MEDIA_VIDEO` / `READ_MEDIA_VISUAL_USER_SELECTED` / `READ_EXTERNAL_STORAGE` | Picking existing photos/docs | Photo & Video Permissions policy | **Android Photo Picker** (image picker) + system document picker need none | HIGH if present without declaration → block |
| `RECORD_AUDIO` | none (added by `expo-camera` by default) | Dangerous | Not needed | MEDIUM → block |
| `POST_NOTIFICATIONS` | Push (planned) | Runtime | — | LOW |
| `INTERNET`, `ACCESS_NETWORK_STATE` | everything | Normal | — | None |
| `com.google.android.gms.permission.AD_ID` | none | Declaration required | — | Block; answer "No" |
| `USE_EXACT_ALARM` / `SCHEDULE_EXACT_ALARM` | none | Restricted | — | Block if a library adds it |

### Matrix

| Requirement | Store | Current State | Mobile Requirement | Risk | Action | Verification |
|---|---|---|---|---|---|---|
| Target API level 36 (new apps/updates since 31 Aug 2026) | Play | n/a (web) | `targetSdkVersion 36` | **REQUIRED** | Use an Expo SDK whose default target is 36 or set via `expo-build-properties` | Check `android/app/build.gradle` after prebuild / AAB inspection |
| Account deletion in app | Play | Admin-only; client delete leaves Auth user | In-app "Delete account" for every role + backend deletion of Auth + personal data | **REQUIRED** | Add authenticated `DELETE /me` (or Cloud Function); define retained records (payroll/attendance) | Manual test per role; Firestore/Auth check |
| Account deletion web URL | Play | none | Public web page to request deletion | **REQUIRED** | Publish page; enter URL in Data safety | URL reachable without login |
| Privacy policy (listing + in app) | Play | none found | HTTPS page linked on login/signup and Settings | **REQUIRED** | Client to provide/approve; covers location, photos, signatures, payroll, retention, deletion, OSM | Link opens in app |
| Data safety form accurate | Play | n/a | Declare data in §0 (Personal info, Precise location, Photos, Files & docs, Financial info, App activity? no, Device IDs), encrypted in transit, deletion available | **REQUIRED** | Fill from §0; update when FCM/analytics added | Cross-check against SDK list before each release |
| Foreground-only location | Play | browser geolocation at clock-in | `expo-location` foreground; plugin `isAndroidBackgroundLocationEnabled:false`, `isAndroidForegroundServiceEnabled:false`; block background perms | HIGH (if misconfigured) | Configure plugin + `blockedPermissions` | Merged manifest has no `ACCESS_BACKGROUND_LOCATION` |
| Prominent disclosure before location prompt | Play | none | Short screen: "Location is recorded once when you clock in…" | MEDIUM | Add pre-permission screen | Screenshot in review notes |
| Employee location monitoring disclosure (MUwS / stalkerware) | Play | coordinates stored, admin sees distance | Clear disclosure; never continuous tracking | MEDIUM | Privacy policy + in-app text | Policy review |
| Photo & Video permissions | Play | file inputs | System photo picker + document picker; no media permissions | HIGH if violated | Use `expo-image-picker`, `expo-document-picker`; block media perms; avoid `expo-media-library` | Merged manifest |
| Unused permissions | Play | — | No `RECORD_AUDIO`, `AD_ID` | MEDIUM | `blockedPermissions` | Merged manifest |
| App access for review (login + 3 roles) | Play | n/a | Demo Client, Staff, Admin credentials in App access | **REQUIRED** | Seed demo data in a **staging** project or isolated demo tenant | Reviewer can log in to each role |
| Reviewer can complete clock-in despite 2 km check | Play | clock-in still succeeds out of range (flagged) but **fails if location denied or address cannot be geocoded** | Demo job that works anywhere; fallback when location denied | HIGH | Demo project with stored coordinates; "clock in without location (flagged)" option to be decided | Test from another city with location off/on |
| No hidden review-only bypass | Play | — | Any demo behaviour must be disclosed | MEDIUM | Document in App access notes | — |
| Self-signup as Employee with no approval | Play (User Data security) | yes | Approval/invite flow or remove Employee self-signup | HIGH | Decide; see CLIENT_INFORMATION_REQUIRED | Attempt signup → no data access before approval |
| Secure data handling (rules, backend) | Play (User Data) | *Update 9 Oct 2026:* rules hardened, `/create-user` and `/delete-user` authenticated; `/cron/auto-clockout` still unauthenticated; key rotation unconfirmed | Enforced rules; authenticated backend; rotated keys | **HIGH** | Rotate keys; publish fixed rules; add token check | Rules emulator tests; curl without token → 401 |
| Third-party data sharing (OSM/Nominatim) | Play | browser calls OSM tiles + Nominatim | Declare or proxy; OSM attribution; respect usage policy | MEDIUM | Server-side geocoding; commercial tiles or Apple/Google maps | Network inspection |
| Advertising ID declaration | Play | no ads | Answer "No"; block `AD_ID` | LOW | Console form | — |
| Content rating (IARC) | Play | — | Questionnaire | **REQUIRED** | Fill at submission | — |
| Target audience | Play | workplace app | 18+ | LOW | Declare 18+ | — |
| Financial features declaration | Play | payroll display only | "No financial features" | LOW | Console form | — |
| Health apps declaration | Play | leave attachments may be sick notes | Not a health app; declare health info only if collected | INFORMATION NEEDED | Ask client whether medical notes are uploaded | — |
| Payments / Play Billing | Play | none (physical cleaning service) | None needed | LOW | If invoices/payments added later, use external processor (physical service) | — |
| Cleartext traffic | Play | backend `.env` uses `http://localhost` in dev; prod URL https | HTTPS only; `usesCleartextTraffic=false` in release | MEDIUM | Separate dev/prod config | Release build network test |
| Exported components / intent filters | Play | n/a | Only launcher + deep-link activity exported; verified App Links for `project/{id}` if used | LOW | Review manifest after prebuild | `aapt dump` / manifest review |
| Developer account type and age | Play | unknown | New **personal** accounts must run closed testing (12 testers × 14 days) before production | INFORMATION NEEDED | Confirm account type/date | Play Console |
| Package name | Play | none | Permanent id (e.g. reverse domain) | INFORMATION NEEDED | Client decision | — |
| Store listing assets | Play | none | Icon 512, feature graphic 1024×500, screenshots, descriptions | **REQUIRED** | Client to supply/approve | — |
| Production build hygiene | Play | — | No dev client, no debug logs, EAS-managed keystore | LOW | EAS production profile | Build review |
| Distribution model | Play | — | Public listing vs private (managed Google Play) | INFORMATION NEEDED | Decide; private distribution reduces review exposure for staff-only use | — |

---

## Apple App Store

### Permissions (iOS)

| Capability | Required? | Purpose string (draft — client to approve) | Review implication |
|---|---|---|---|
| Location When In Use (`NSLocationWhenInUseUsageDescription`) | Yes (Staff) | "Whitenow records your location once when you clock in, to confirm you are at the job address. Your manager can see it." | LOW if specific; no "Always", no location background mode |
| Location Always / background mode | **No** | — | Must not be present |
| Camera (`NSCameraUsageDescription`) | Yes | "Take photos of completed work and update your profile picture." | LOW |
| Photo library (`NSPhotoLibraryUsageDescription`) | Only if not using PHPicker-only flow | "Attach photos of completed work, feedback and documents." | Prefer system picker (no full-library access) |
| Photo library add (`NSPhotoLibraryAddUsageDescription`) | Only if saving QR/PDF to Photos | — | Prefer share sheet → not needed |
| Microphone | **No** (disable in `expo-camera`/`expo-image-picker` plugins) | — | Unused permission = rejection risk |
| Notifications | Later (push) | system prompt, ask in context | LOW |
| Contacts, Calendar, Bluetooth, Tracking (ATT) | **No** | — | Not used; no ATT prompt needed |

### Matrix

| Requirement | Store | Current State | Mobile Requirement | Risk | Action | Verification |
|---|---|---|---|---|---|---|
| Account deletion initiated in app (5.1.1(v)) | Apple | admin-only | Same flow as Play; explain retained payroll/legal records | **REQUIRED** | Build `DELETE /me` + UI | Reviewer test on demo account |
| Sign in with Apple (4.8) | Apple | email/password only | Not required while no third-party/social login | LOW | Do not enable Google sign-in without SIWA | — |
| Privacy policy in app + App Store Connect (5.1.1(i)) | Apple | none | Reachable before login and in Settings | **REQUIRED** | Client to provide | Link test |
| App Privacy "nutrition" labels | Apple | n/a | Contact info, precise location, user content (photos, signatures, docs), financial info, identifiers — linked to user, not tracking | **REQUIRED** | Fill from §0 | Match SDK manifests |
| Privacy manifest (`PrivacyInfo.xcprivacy`) | Apple | n/a | `NSPrivacyTracking=false`; required-reason APIs (UserDefaults CA92.1, file timestamp C617.1, boot time 35F9.1, disk space E174.1) via `expo.ios.privacyManifests`; SDK manifests from Firebase/Expo | **REQUIRED** | Configure in `app.json`; use SDK versions that ship manifests | Xcode privacy report on archive |
| Permission purpose strings (5.1.1 / 2.3) | Apple | n/a | Specific strings above; no unused keys | **REQUIRED** | Set in plugins | Inspect generated `Info.plist` |
| Location not mandatory for app use (5.1.5 / 5.1.1(iv)) | Apple | clock-in fails if location denied | Graceful handling; consider "clock in without location (flagged for admin)" | HIGH | Product decision (changes a business rule) | Deny-location test |
| Demo accounts + live backend (2.1) | Apple | n/a | Client/Staff/Admin demo logins in Review Notes; backend and Firebase up during review | **REQUIRED** | Seed demo tenant; keep backend awake (no sleeping free tier) | Reviewer can complete each role flow |
| Reviewer can complete clock-in/out | Apple | 2 km check; geocode at clock-in | Demo job usable anywhere (disclosed) | HIGH | As Play | Test from another location |
| Minimum functionality / business-app distribution (4.2, 3.2) | Apple | single-company ERP | Justify public listing (client portal) or use Custom App / Unlisted distribution | MEDIUM / INFORMATION NEEDED | Decide distribution | — |
| Incomplete features / placeholders (2.1, 2.3) | Apple | web copy like "Connect Firebase to see your documents", login shows "Logo", signup heading "Logo" | Real copy, real logo, no TODO/placeholder | MEDIUM | Replace in mobile UI | UI review |
| Broken links | Apple | forgot-password redirects to missing route | No dead routes | LOW | Fix in mobile flow | QA |
| Crash risks | Apple | null access patterns (e.g. `VerificationPage` uses `currentUser.email` without guard) | Defensive UI, error boundaries | MEDIUM | Error boundary + crash-free QA | TestFlight runs |
| Payments (3.1) | Apple | none; physical cleaning service | No IAP needed; if payments added, physical service → external processor allowed | LOW | — | — |
| Push configuration | Apple | not implemented | APNs key, `aps-environment` entitlement, only `remote-notification` background mode if silent pushes | LOW (when added) | Add in notifications phase | Entitlements check |
| Push content (4.5.4) | Apple | — | App works without push; no salary/personal details in text | MEDIUM | Generic notification copy | Copy review |
| URL scheme / universal links | Apple | QR codes point to web `/project/{id}` | Custom scheme `whitenow://`; optional associated domains for `project/{id}` | LOW | Decide in plan | Link tests |
| Bundle identifier | Apple | none | Permanent reverse-domain id | INFORMATION NEEDED | Client decision | — |
| Deployment target | Apple | n/a | Per Expo SDK minimum (iOS 15.1+ for current SDKs) | LOW | Accept Expo default | — |
| iPad support (2.4.1) | Apple | web is responsive | `supportsTablet` true only if layouts are tested on iPad | MEDIUM | Decide; default phone-only | iPad simulator check |
| Export compliance | Apple | HTTPS only | `ITSAppUsesNonExemptEncryption=false` | LOW | Set in `app.json` | — |
| Data security (1.6) | Apple | *Update 9 Oct 2026:* rules hardened, `/create-user` and `/delete-user` authenticated; `/cron/auto-clockout` still unauthenticated; key rotation unconfirmed | Fix before submission | **HIGH** | Same as Play | Rules tests |
| Third-party content (OSM) | Apple (5.2 / 2.1) | OSM tiles + Nominatim from client | Attribution; avoid public endpoints in production; or Apple Maps on iOS | MEDIUM | Choose map provider | Map shows attribution |
| Apple Developer account type | Apple | unknown | Organization account recommended (company name on listing; needed for Custom App) | INFORMATION NEEDED | Client to confirm | — |
| Age rating | Apple | — | Questionnaire (likely 4+/no objectionable content) | **REQUIRED** | Fill at submission | — |

---

## Cross-store items that affect architecture now

1. **Self-service account deletion** → new authenticated backend endpoint + deletion policy (what is retained).
2. **Backend authentication** → mobile must send Firebase ID tokens; backend must verify (approval needed).
3. **Firestore/Storage rules** → mobile queries must be written to pass strict rules from day one.
4. **Location fallback** → product decision on clock-in when location is denied/unavailable.
5. **Self-signup policy** → keep Client self-signup? remove or gate Employee self-signup?
6. **Map/geocoding provider** → affects libraries, keys and the privacy disclosures.
7. **Demo/staging environment** → separate Firebase project and backend instance for review.
8. **Distribution** → public listings vs private/custom distribution.
