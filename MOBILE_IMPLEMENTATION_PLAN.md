# Whitenow — Mobile Implementation Plan

> **Reference update (10 Oct 2026):** commit hashes in this document refer to the **`whitenow-revamp`** repository, not `whitenow-mobile`. The original snapshot `eb10728` no longer exists in that repository's history; the current reference is `b1c1b99` (Firebase security hardening documentation, `prod`). Statements affected by the 9 Oct 2026 hardening are corrected inline; see `whitenow-revamp/docs/FIREBASE_SECURITY_HARDENING.md`.

Recommendation only. Nothing has been initialised or installed. Based on the traced code in `whitenow-revamp@b1c1b99`
(see [MOBILE_MIGRATION_AUDIT.md](MOBILE_MIGRATION_AUDIT.md), [MOBILE_SCREEN_MAP.md](MOBILE_SCREEN_MAP.md),
[FIREBASE_MOBILE_AUDIT.md](FIREBASE_MOBILE_AUDIT.md), [STORE_COMPLIANCE_MATRIX.md](STORE_COMPLIANCE_MATRIX.md)).

Guiding constraints: keep the existing Firebase data model and backend contract (web app keeps working), cover Client,
Staff **and** Admin completely, fastest maintainable path, no over-engineering.

---

## 1. Stack

| Layer | Choice | Why |
|---|---|---|
| Runtime | **Expo (latest SDK targeting Android API 36)**, React Native New Architecture, **TypeScript** | Store target-API requirement; managed builds |
| Navigation | **Expo Router** (file-based, typed routes) | Route groups per role mirror the web layouts |
| Firebase | **Firebase JS SDK v12** (same as web) with `getReactNativePersistence(AsyncStorage)` | Same API as the web code ⇒ fastest port; works in Expo Go and dev builds |
| Server data | **TanStack Query** for one-off reads/mutations + a small `useFirestoreQuery` hook for `onSnapshot` listeners | Caching, retries, loading/error states without a global store |
| Client state | React context for auth/session only; local component state otherwise | Web uses only context; no need for Redux/Zustand |
| Forms | `react-hook-form` + `zod` | Replaces hand-rolled validation; shared schemas |
| UI | RN primitives + a small in-house component kit; optional NativeWind | Keeps the web's Tailwind mental model if desired |
| Lists | `@shopify/flash-list` | Long attendance/task lists |
| Sheets | `@gorhom/bottom-sheet` | Calendar day sheet, filters, pickers |
| Dates | `dayjs` (+ `utc`, `timezone` plugins) | Same lib as web; fixes timezone handling |
| Device | `expo-location`, `expo-image-picker`, `expo-image-manipulator`, `expo-document-picker`, `expo-file-system`, `expo-sharing`, `expo-web-browser`, `expo-clipboard`, `expo-notifications` (phase 9) | See web-only table in the audit §11 |
| Feature libs | `react-native-signature-canvas`, `react-native-qrcode-svg`, `react-native-maps` (or MapLibre), `react-native-render-html`, `@10play/tentap-editor` (Admin rich text), `react-native-webview` (PDF), `react-native-calendars` (or custom grid) | Replace canvas, Leaflet, iframe, contentEditable |
| Toasts | one library (`burnt` or `react-native-toast-message`) | Web uses three |
| Builds | **EAS Build / Submit**, dev client for native modules, **EAS Update** for JS fixes only | Store hygiene |

Use a **development build** (not Expo Go) from the start because signature canvas, maps and PDF need native modules.

---

## 2. Project structure

```
whitenow-mobile/
├── app/                              # Expo Router
│   ├── _layout.tsx                   # providers: Query, Auth, Theme, Toast, ErrorBoundary
│   ├── index.tsx                     # redirect by role
│   ├── (auth)/login.tsx · signup.tsx · forgot-password.tsx
│   ├── (client)/_layout.tsx          # tabs
│   │   ├── projects/index.tsx · [projectId]/index.tsx · [projectId]/tasks.tsx
│   │   ├── jobs/index.tsx · jobs/[attendanceId].tsx
│   │   ├── feedback/index.tsx · new.tsx · [id].tsx
│   │   ├── documents/index.tsx
│   │   └── more/profile.tsx · notifications.tsx · delete-account.tsx
│   ├── (staff)/_layout.tsx           # tabs
│   │   ├── calendar/index.tsx · calendar/[date].tsx · job/[projectId]/[date].tsx
│   │   ├── job/[projectId]/[date]/checklist.tsx · signature.tsx
│   │   ├── tasks/index.tsx · tasks/[projectId]/[taskId].tsx
│   │   ├── attendance/index.tsx
│   │   └── more/leave/… · payroll/… · feedback/… · profile.tsx · delete-account.tsx
│   ├── (admin)/_layout.tsx           # tabs
│   │   ├── calendar/… (shared screens + schedule editor)
│   │   ├── projects/index.tsx · new/[step].tsx · [projectId]/… (overview, edit, tasks, photos, qr)
│   │   ├── people/employees/… · people/clients/…
│   │   ├── hr/attendance/… · hr/leave/… · hr/payroll/…
│   │   └── more/tasks · assets · documents · feedback · locations · profile
│   └── +not-found.tsx
├── src/
│   ├── config/env.ts                 # EXPO_PUBLIC_* parsing (zod)
│   ├── firebase/app.ts · auth.ts · db.ts · storage.ts
│   ├── services/                     # one module per collection, typed, no UI
│   │   ├── profiles.ts · projects.ts · tasks.ts · events.ts · attendance.ts
│   │   ├── notifications.ts · leaves.ts · payroll.ts · assets.ts
│   │   ├── documents.ts · feedback.ts · storage.ts
│   ├── api/client.ts · users.ts      # Node backend (fetch + ID token)
│   ├── domain/                       # pure logic ported from web utils (unit-tested)
│   │   ├── recurrence.ts · calendarDates.ts · attendanceRules.ts
│   │   ├── worktime.ts · checklist.ts · payroll.ts · taskDescription.ts
│   ├── types/                        # Firestore document types + enums
│   ├── hooks/                        # useAuth, useRole, useFirestoreQuery, useCalendarData…
│   ├── components/                   # Button, Card, ListItem, StatusChip, EmptyState, FilterSheet,
│   │                                 # ImageGallery, PhotoPicker, DocumentViewer, SignaturePad,
│   │                                 # AddressSearch, MapPicker, RichTextView, ConfirmSheet…
│   ├── features/                     # role screens' composite components if screens grow large
│   └── theme/
├── assets/
├── app.config.ts · eas.json
└── __tests__/ · e2e/ (Maestro flows)
```

Keep **service functions** the only place that imports Firestore; screens call hooks that call services.
This is the main structural improvement over the web app (where 40+ components call Firestore directly).

---

## 3. Authentication & role-based routing

Derived from `AuthContext.jsx` and `App.jsx`:

```
App start
 → Firebase Auth restores session (AsyncStorage persistence)
 → no user  → (auth)/login
 → user     → getDoc(admins/{uid}) → else getDoc(employees/{uid}) → else getDoc(clients/{uid})
             (doc id == uid; same priority as web: Admin > Employee > Client)
 → profile missing → sign out + "account not set up" message
 → userType "Admin"    → (admin)/calendar   [web lands on Employees; calendar is more useful on phones — confirm]
   userType "Employee" → (staff)/calendar   [web lands on Tasks; clock-in lives in Calendar]
   userType "Client"   → (client)/projects
 → subscribe onSnapshot(profile) for live avatar/name
```

- Each role group's `_layout.tsx` guards with `<Redirect>` if `role` does not match (equivalent to `ProtectedRoute`).
- `(auth)` layout redirects signed-in users to their home (equivalent to `PublicRoute`).
- Profile cached in AsyncStorage for instant cold start, revalidated on launch.
- When the backend adds custom claims later, switch role detection to `getIdTokenResult().claims.role` without touching screens.
- Signup screen behaviour depends on decision #25 in CLIENT_INFORMATION_REQUIRED (recommended default: Client self-signup only; Employees invited by Admin).
- Add **Delete account** in every role's More/Profile (store requirement) once the backend endpoint exists.

---

## 4. Navigation per role (target)

**Client — bottom tabs (4) + More**
1. Projects → Project detail (Overview · Schedule · Tasks [read-only] · Photos · QR)
2. Job History (badge = unread) → Visit detail
3. Feedback → New feedback / Feedback detail
4. Documents → Document viewer
5. More → Profile, Notifications, Privacy policy, Support, Delete account, Logout

**Staff — bottom tabs (4) + More**
1. Calendar (home) → Day sheet → Job detail → Clock in / Checklist & clock out / Customer signature
2. Tasks → Task detail (mark completed)
3. Attendance (history, filters)
4. Leave → Apply / Detail
5. More → Payroll history (→ proof viewer), Feedback, Profile, Privacy, Support, Delete account, Logout

**Admin — bottom tabs (5)**
1. Calendar → Day sheet → Job detail (all staff attendance, checklist, photos, signature) → Edit schedule / Create event
2. Projects → Project detail (Overview · Schedule · Team & Tasks · Photos · QR) → Create/Edit wizard → Task editor
3. People → Employees (list/detail/create/edit/delete) · Clients (list/detail/create/edit/delete) · Locations map
4. HR → Attendance (approve/reject/edit/delete) · Leave (approve/reject) · Payroll (month → employee → edit, proof upload, bulk status)
5. More → Project Tasks overview, Assets, Client Documents, Feedback (employee/client), Profile, Delete account, Logout

All Admin capabilities from the web are kept; only their placement changes.

---

## 5. Services, API, types, errors, environments

- **Firestore services** keep exact field names and string formats used by the web (`clockInDate "YYYY-MM-DD"`,
  `clockInTime "HH:mm"`, `AttendanceStatus`, etc.) so both apps read each other's data.
- **Scoped queries** for non-admins (e.g. client projects `where clientId == uid`, staff projects `array-contains`) so
  they pass strict rules. Admin lists use `orderBy` + `limit` + cursor pagination.
- **Transactions** for array/counter read-modify-write (`tasks`, `events`, `documents`, asset counters, clock-out task sync).
- **Backend client** (`src/api/client.ts`): base URL from env, attaches `Authorization: Bearer <idToken>`, typed responses,
  maps 4xx/5xx to user messages. Calls `/create-user`, `/delete-user` (both require an Admin ID token), and the new `/me` deletion endpoint once approved.
- **Shared types** in `src/types` generated by hand from FIREBASE_MOBILE_AUDIT §2.1; zod schemas for forms and for parsing
  documents defensively (legacy docs have mixed date types).
- **Errors:** root error boundary; query errors → inline retry; Firebase error codes → friendly messages; offline banner
  (Firestore offline cache handles reads; uploads queue with retry).
- **Timezone:** compute "today" and clock times in the business timezone (decision #20), not UTC.
- **Environments:** `development` (staging Firebase project + staging backend), `preview` (internal testers, staging),
  `production` (`white-now-erp`, production backend). `app.config.ts` reads `APP_VARIANT` to change bundle id suffix,
  name, icon badge and Firebase config. Secrets never in the bundle; only `EXPO_PUBLIC_*` public config.

---

## 6. Testing approach

| Level | Tool | Scope |
|---|---|---|
| Unit | Jest | `src/domain/*` — recurrence (all 6 frequencies, month-end clamping), worked time (midnight wrap), clock-in eligibility, checklist snapshot, payroll totals, HTML sanitizer |
| Rules | Firebase Emulator + `@firebase/rules-unit-testing` | Every mobile query per role passes the rules; forbidden access fails |
| Component | React Native Testing Library | Forms (validation), checklist screen, filters |
| E2E | **Maestro** flows on Android emulator + iOS simulator | Login per role; staff clock-in → checklist → photos → clock-out; client sees visit; admin approves; leave round-trip; payroll proof viewing |
| Manual device QA | Real Android + iPhone | Location permission paths (allow/deny/off), camera, signature, PDF, slow network |
| Store pre-checks | merged manifest / Info.plist / privacy report | Permissions and manifests per STORE_COMPLIANCE_MATRIX |

---

## 7. Migration order (adjusted to what the code showed)

The visit workflow (Calendar → clock-in → checklist → photos → signature → client notification) is the highest-dependency,
highest-value path and touches all three roles, so it moves ahead of the generic "client workflows" step.

| Phase | Work | Covers | Depends on | Complexity |
|---|---|---|---|---|
| **0. Pre-work (outside the app, needs approval)** | Rotate committed service-account keys; get current rules; create staging Firebase + backend; agree backend auth + `/me` deletion; decisions in CLIENT_INFORMATION_REQUIRED (#1–12, 20, 25, 26, 33, 34) | Security, store blockers | client | Low effort, **blocking** |
| **1. Foundation** | Expo + TS + Router skeleton, EAS profiles, env config, theme, component kit, error boundary, toasts, Firebase init, types, `domain/` port with unit tests | All | 0 | Medium |
| **2. Authentication** | Login, forgot password (no email enumeration), signup per decision, session restore, profile listener, logout, avatar upload | Shared S1–S7 | 1 | Easy–Medium |
| **3. Role routing & shells** | Role groups, guards, tab bars, More menus, empty screens wired | All | 2 | Easy |
| **4. Shared infrastructure** | Services layer, `useFirestoreQuery`, list/card/filter components, image picker + upload with compression, document picker, file viewer/share, image gallery, HTML renderer, date/time pickers, address search (server or provider geocoding) | All | 3 | Medium |
| **5. Core cross-role workflow: scheduling & visits** | Calendar (week + month + day sheet + job detail) for Staff and Admin; staff clock-in (location, distance, open-session rules); checklist + photos + clock-out; task sync; `visit_completed` notification; customer signature | E4–E9, A24 (view) , W4, W6 | 4 | **Hard** |
| **6. Client workflows** | Projects (scoped query) + detail tabs + read-only tasks; Job History + visit detail; in-app notifications; feedback (+photo); documents | C1–C11 | 5 | Medium |
| **7. Staff workflows** | Tasks list/detail/complete; attendance history; leave apply/list/detail; payroll history + proof; feedback | E1–E3, E10–E15 | 5 | Medium |
| **8. Admin workflows** | 8a People: employees & clients CRUD (backend), view/edit extra fields · 8b HR: attendance approve/reject/edit/delete + audit, leave approve/reject, payroll month editing, proofs, bulk status · 8c Projects: list, status, delete with asset release, **create/edit wizard** (team, assets, events, timeline, QR), project tasks editor (rich text), Project Tasks overview · 8d Calendar schedule create/edit/delete (recurrence UI) · 8e Assets, Client documents (multi-upload/replace/delete), Feedback lists, Locations map | A1–A24 | 5 (and 6/7 for shared viewers) | **Hard** |
| **9. Native functionality polish** | Location pre-permission screen and denied-path fallback; camera flows; QR share/save; deep links (`project/{id}`, job history); maps provider | NDC items | 5–8 | Medium |
| **10. Notifications** | FCM/APNs setup, token registration, backend sender, the agreed push events, notification tap → deep link | §5 of Firebase audit | 9, backend approval | Medium |
| **11. Testing** | Emulator rules tests, Maestro E2E per role, device QA matrix, accessibility pass | All | 5–10 (runs continuously) | Medium |
| **12. Store compliance** | Account deletion UI + endpoint, privacy policy links, privacy manifest, permission strings, blocked permissions, Data safety / App Privacy, demo accounts + data, review notes | Store matrix | 2, 4, backend | Medium |
| **13. Production builds** | EAS production profiles, signing (EAS-managed), versioning, release notes, crash-free check on TestFlight / internal track | — | 11, 12 | Easy |
| **14. Store submission** | TestFlight external + Play closed testing (14-day rule if personal account), submission, review responses | — | 13 | Easy effort, calendar-bound |

### Effort indication (relative, not a time estimate)

- Screens: Shared 7 (easy), Client 11 (mostly easy/medium), Staff 15 (4 hard: calendar, clock-in, checklist, signature),
  Admin 24 (9 hard: attendance list, payroll, project create/edit wizards, task editor, Project Tasks page, documents,
  locations map, calendar scheduling).
- Overall: **large / high complexity**, driven by Admin (≈45% of screens, most of the hard ones) and the visit workflow.
  Client and Staff alone would be medium.

---

## 8. Things deliberately not carried over

- 30 dead files (audit §2), the unreachable staff clock buttons/QR modal on the Attendance page, the duplicate toast libs.
- FullCalendar (installed but unused).
- Client ability to edit project tasks (bug).
- Whole-collection reads for non-admin roles.

## 9. Exact next step

1. Answer the 🏗 items in [CLIENT_INFORMATION_REQUIRED.md](CLIENT_INFORMATION_REQUIRED.md) — especially account/ids,
   self-signup policy, location fallback, timezone, and approval for backend auth + key rotation + rules.
2. Then start **Phase 1 (Foundation)** in this repo on a feature branch.
