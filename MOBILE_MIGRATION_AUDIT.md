# Whitenow — Mobile Migration Technical Audit

Phase 1 discovery. Nothing in the web app, the Node backend or Firebase was changed.
Audited on 2026-10-07 against the local checkout described below.

> **Reference update (10 Oct 2026):** commit hashes in this document refer to the **`whitenow-revamp`** repository, not `whitenow-mobile`. The original snapshot `eb10728` no longer exists in that repository's history; the current reference is `b1c1b99` (Firebase security hardening documentation, `prod`). Statements affected by the 9 Oct 2026 hardening are corrected inline; see `whitenow-revamp/docs/FIREBASE_SECURITY_HARDENING.md`.

Companion documents:
[MOBILE_SCREEN_MAP.md](MOBILE_SCREEN_MAP.md) ·
[FIREBASE_MOBILE_AUDIT.md](FIREBASE_MOBILE_AUDIT.md) ·
[STORE_COMPLIANCE_MATRIX.md](STORE_COMPLIANCE_MATRIX.md) ·
[MOBILE_IMPLEMENTATION_PLAN.md](MOBILE_IMPLEMENTATION_PLAN.md) ·
[CLIENT_INFORMATION_REQUIRED.md](CLIENT_INFORMATION_REQUIRED.md)

---

## 1. Which repository is the source of truth

Two candidate repositories sit next to `whitenow-mobile` in `~/Github Projects`:

| Folder | Remote | Checked-out branch | Last commit | Verdict |
|---|---|---|---|---|
| `whitenow-revamp` | `github.com/jidatit/whitenow-revamp` | `prod` (= `origin/prod` = `origin/dev`) | `b1c1b99` (see note above; originally audited at `eb10728`) | **Source of truth** |
| `whitenow` | `github.com/jidatit/whitenow` | `prod` | `644f0ec` 2025-10-15 | Older generation, not audited further |

`whitenow-revamp` is a year newer, has the calendar/attendance/checklist/signature work, and its `docs/` folder describes the
current production Firebase project (`white-now-erp`). Every finding below refers to `whitenow-revamp` at `b1c1b99`, with hardening corrections inline.

Repository layout:

```
whitenow-revamp/
├── client/          React 19 + Vite 7 SPA (the web app)
├── backend/         Express 4 + firebase-admin (the Node backend)
├── docs/            Client-facing notes + proposed Firestore rules
└── README.md
```

There is **no** `firebase.json`, `firestore.rules`, `storage.rules`, `firestore.indexes.json` or `functions/` directory.
Firebase rules are managed by hand in the Firebase Console (see `docs/firestore-rules-*.md`).

---

## 2. Frontend stack (client/)

| Concern | Implementation | Evidence |
|---|---|---|
| Framework | React 19.2, JavaScript (JSX), no TypeScript | `client/package.json` |
| Build | Vite 7, `@vitejs/plugin-react`, `@` alias → `src/` | `client/vite.config.js` |
| Styling | Tailwind CSS 4 (+ MUI 7 and Emotion in places) | `package.json`, `index.css` |
| Routing | `react-router-dom` 7, `BrowserRouter`, nested layout routes per role | `src/main.jsx`, `src/App.jsx` |
| State | React context only (`AuthContext`, `ClientNotificationsContext`) + component state. No Redux/Zustand/React Query | `src/contexts/*` |
| Data access | Firebase JS SDK v12 called **directly from components** (no service layer) | 40+ files import `firebase/firestore` |
| Forms | Hand-rolled state + manual validation, toasts for errors | e.g. `AllEmployees.jsx:95` |
| Toasts | Three libraries in use at once: `react-hot-toast`, `sonner`, `react-toastify` | imports across pages |
| Dates | `dayjs`, MUI X date pickers, `react-datepicker`, native `Date` | `utils/attendanceUtils.js` |
| Calendar | Custom calendar shell (week strip + month grid); FullCalendar is installed but the live calendar no longer renders it | `pages/Calendar/Component/CalendarShell/*` |
| Maps | Leaflet + react-leaflet with public OpenStreetMap tiles; Nominatim for geocoding | `Components/AddressField`, `EmployeeClientLocations.jsx` |
| QR | `qrcode.react` (`QRCodeSVG`) | `ProjectForm.jsx`, `QRCodeModal.jsx` |
| Rich text | Custom `contentEditable` editor using `document.execCommand`, sanitizer built on `DOMParser` | `Admin/components/RichTextEditor.jsx`, `utils/taskDescription.js` |
| Icons | `lucide-react`, `react-icons` | |
| Animation | `framer-motion` (loader) | `Components/AnimatedLoader` |

### Live vs dead code

An import-graph walk from `src/main.jsx` (comments stripped) reaches **99 of 129** source files. These 30 files are not
reachable and should **not** be migrated:

`Components/ActionMenu`, `AttendanceStatsCard`, `ColourPickerr`, `DatePicker`, `Modals/CreateEvent`, `Modals/ProjectCreation`,
`Modals/ProjectCreationComplete`, `Modals/QRCode`, `Modals/Timeline`, `MultiSelectDropdown/index.jsx`, `MultiStep`,
`ProjectRow`, `SearchBar`, `SimpleInput`, `Table`, `TimePicker`; `Dashboard/Admin/components/PayrollActions.jsx`;
`Calendar/Component/AddNewEvent`, `CalendarShell/DaySummary.jsx`, `Calendar/Component/DatePicker`, `DropdownInput`,
`TimePicker`; `Admin/pages/EmployeesLeaves.jsx`; `Dashboard/Client/pages/Projects.jsx`;
`Dashboard/Client/components/ProjectDetailViewer.jsx`; `Employee/components/DayEventsPickerModal.jsx`;
`hooks/useProjects.js`; `Navbar`; `Pages/CreateProject`; `RoutesFile`.

Note: `App.jsx` imports **the Admin `Projects` page for the Client route** (`// import ClientProjects …` is commented out).
The dedicated client projects page is dead code; clients see the Admin page in read-only mode.

---

## 3. Routing and role handling

`src/App.jsx` defines four route trees. Paths come from `src/global/navPaths.jsx`.

| Tree | Base path | Guard | Landing |
|---|---|---|---|
| Auth | `/auth` (`login`, `Signup`, `verification`, `forgotPassword`) | `PublicRoute` (redirects signed-in users to their role home) | `/auth/login` |
| Employee (Staff) | `/employeeLayout` | `ProtectedRoute allowedRoles={["Employee"]}` | `/employeeLayout/Tasks` |
| Client | `/clientLayout` | `ProtectedRoute allowedRoles={["Client"]}` | `/clientLayout/projects` |
| Admin | `/adminLayout` | `ProtectedRoute allowedRoles={["Admin"]}` | `/adminLayout/employees` |
| Public | `/project/:id` | **none** (unauthenticated QR landing page) | — |

Role check: `currentUser.userType` must be in `allowedRoles`; otherwise redirect to `/`.
Navigation chrome: `global/Header.jsx` (logo, logout, avatar → profile) and `global/TopBarNavigation.jsx`
(category buttons with dropdowns; Admin categories are HR Manager, Project Manager, Feedback, Location, Clients, Calendar, Profile).

Admin route quirks found in `App.jsx`:
- `Attendance`, `employees` and `LeaveManagement` all render the `Employees` tab container, which picks the tab from the URL.
- `LeaveManagement` is declared twice (first match is the tab container).
- `Feedbacks`, `ClientFeedback`, `EmployeeFeedback` all render the `Feedbacks` tab container.
- `Location`, `ClientsLocations`, `EmployeesLocations` all render the `Locations` tab container.

---

## 4. Authentication (traced)

Files: `contexts/AuthContext.jsx`, `auth/pages/LoginPage.jsx`, `SignupPage.jsx`, `ForgotPassword.jsx`, `VerificationPage.jsx`,
`Config/firebaseConfig.js`, `backend/index.js`.

- **Provider:** Firebase Auth email/password only. `GoogleAuthProvider` is instantiated in `firebaseConfig.js` but never used.
- **Login:** `signInWithEmailAndPassword`, then queries `admins`, `employees`, `clients` for `where("uid","==",uid)` and navigates.
  Note the login page navigates up to three times if a uid were in several collections (no `return` after each match).
- **Session restore:** `onAuthStateChanged` → `getUserInfo(uid)` checks `admins` → `employees` → `clients` (first hit wins) →
  sets `currentUser` (the Firestore profile + `id`) → subscribes to that profile doc with `onSnapshot` so avatar changes are live.
- **Role:** `currentUser.userType` ∈ `Admin | Employee | Client`, read from the profile document. There are no custom claims.
- **Persistence:** Firebase's default browser persistence + a copy of the profile in `localStorage` (`currentUser`, `isEmailVerified`, `userType`).
- **Logout:** `signOut(auth)`, clears `localStorage`, navigates to `/`.
- **Password reset:** `ForgotPassword` first looks the email up in all three collections (`where("email","==",email)`), then `sendPasswordResetEmail`.
  Redirect after success goes to `/signIn`, which does not exist (lands on the 404 page).
- **Email verification:** `verifyEmail()` exists, `VerificationPage` exists, but **nothing sends a verification email on signup and nothing enforces verification**.
- **Self sign-up:** public `/auth/Signup` lets **anyone** create a **Client or Employee** account
  (`createUserWithEmailAndPassword` + `setDoc(collection, uid)` from the browser). There is no approval step.
- **Admin-created accounts:** Admin → Employees / Clients → "Create" calls `POST {VITE_API_URL}/create-user` (Node backend).
- **Account deletion:**
  - Employees: `DELETE /delete-user` (backend deletes Auth user + profile docs).
  - Clients: `deleteDoc(clients/{id})` from the browser only — **the Firebase Auth user is left behind**.
  - No self-service deletion for any role.

---

## 5. Data layer summary

Full detail in [FIREBASE_MOBILE_AUDIT.md](FIREBASE_MOBILE_AUDIT.md). Collections in use:

`admins`, `employees`, `clients`, `projects` (with embedded `tasks[]` and `events[]`), `attendance`, `attendanceAuditLogs`,
`notifications`, `leaves`, `payroll/{employeeId}/monthwise/{YYYY-MM}`, `assets`, `feedback`, `clientFeedback`.
Client documents are an array field on `clients/{uid}.documents`. There is **no** `documents` collection in use.

Storage prefixes: `profilePics/`, `attendance/clockout/`, `attendance/signatures/`, `leave-documents/`, `proofs/`,
`documents/{clientUid}/`, `clientFeedback/{uid}/`.

Characteristics that matter for mobile:
- Most screens read **entire collections** (`getDocs(collection(db,"projects"))`, `onSnapshot(collection(db,"attendance"))`) and filter in JS.
- Many writes are read-modify-write of whole arrays (`projects.tasks`, `projects.events`, `clients.documents`) without transactions.
- Dates are stored as strings (`"YYYY-MM-DD"`, `"HH:mm"`) mixed with `serverTimestamp()`, ISO strings and JS `Date`.
- No pagination anywhere except client-side table paging.

---

## 6. Node backend (backend/)

Single file `backend/index.js` (Express 4, port 10000) + `services/autoClockOut.js`. Full endpoint table in
[FIREBASE_MOBILE_AUDIT.md §6](FIREBASE_MOBILE_AUDIT.md#6-node-backend-audit).

| Endpoint | Purpose | Auth |
|---|---|---|
| `GET /` | health text | none |
| `POST /create-user` | Admin SDK `createUser` + `set` profile doc in `employees`/`clients` (`userType` whitelisted) | **Admin Firebase ID token** (`cc83423`) |
| `DELETE /delete-user` | Admin SDK `deleteUser` + delete profile docs | **Admin Firebase ID token** (`cc83423`) |
| `POST /cron/auto-clockout` | close open attendance after project `maxWorkingHours` | **none** (still unauthenticated; hardening deferred, not fixed) |
| `setInterval` every 15 min | same auto clock-out job | n/a |

- CORS is limited to `CORS_ORIGIN`, which only restricts browsers. A mobile app (or `curl`) sends no `Origin` and is unaffected.
- Deployed URL in comments: `https://whitenow.onrender.com/` (current `.env` points at `http://localhost:10000`).
- **Can mobile use it unchanged?** Technically yes (plain JSON over HTTPS, no cookies). It **should not ship unchanged**:
  at audit time anyone who knows the URL could create an `admins` user or delete any user. *Update:* `/create-user` and
  `/delete-user` now require an Admin ID token (`cc83423`); `/cron/auto-clockout` is still unauthenticated. See the recommendation in the implementation plan.

---

## 7. Environment variables and third-party services

| Variable | Where | Purpose | Mobile equivalent |
|---|---|---|---|
| `VITE_API_KEY`, `VITE_AUTH_DOMAIN`, `VITE_PROJECT_ID`, `VITE_STORAGE_BUCKET`, `VITE_MESSAGING_SENDER_ID`, `VITE_APP_ID` | `client/.env` | Firebase web config (`white-now-erp`) | `EXPO_PUBLIC_FIREBASE_*` or native `google-services.json` / `GoogleService-Info.plist` with new Android + iOS Firebase apps |
| `VITE_API_URL` | `client/.env` | Node backend base URL | `EXPO_PUBLIC_API_URL` |
| `VITE_PROJECT_URL` | `client/.env` | Base URL encoded in project QR codes (`{url}project/{id}`) | `EXPO_PUBLIC_WEB_URL` (keep pointing to the web app so existing printed QR codes keep working) |
| `VITE_ENV_CHECK` | `client/.env` | unused marker | drop |
| `CORS_ORIGIN`, `project_id`, `private_key_id`, `private_key`, `client_email`, … | `backend/.env` | Admin SDK credentials | backend only — never in the app |

Third-party services (all called directly from the browser):

| Service | Used for | Files |
|---|---|---|
| Firebase Auth / Firestore / Storage | everything | everywhere |
| OpenStreetMap tile server | map tiles in address picker and Locations | `AddressField`, `EmployeeClientLocations` |
| Nominatim (OSM) | forward + reverse geocoding (address autocomplete, project address → coordinates at **every clock-in**, location maps) | `AddressField`, `attendanceUtils.getCoordinatesFromAddress`, `EmployeeClientLocations` |
| `api.qrserver.com` | used only to enable the Download/Share buttons in `QRCodeModal` (the QR shown is rendered locally) | `Employee/components/QRCodeModal.jsx` |
| Render.com (assumed host) | Node backend | `client/.env` comment |

No analytics, crash reporting, ads, payment SDK (Stripe/PayPal), Firebase Cloud Messaging, Cloud Functions, App Check or reCAPTCHA were found.

---

## 8. Important business logic (traced, not inferred from names)

| Rule | Where | Notes for mobile |
|---|---|---|
| Staff can clock in **only for today**, only once per project per day, and only if no older session for that project is still open | `CalendarAttendanceModal.jsx:171-175`, `attendanceUtils.findOpenAttendance` | Port as pure functions in `src/domain/attendance.ts` |
| Clock-in requires device location **and** geocoding the project address via Nominatim; distance ≤ **2000 m** sets `locationValidated: true`, otherwise the clock-in still succeeds but is flagged | `CalendarAttendanceModal.jsx:191-225` | Use stored project `coordinates` first; fall back to geocoding |
| Clock-out always goes through the **Visit Checklist** (Completed / N/A / Not marked + optional remark per task, up to 5 photos ≤ 5 MB JPG/PNG/WebP) | `TaskCheckListModal.jsx` | Camera + picker on mobile |
| Worked minutes = clock-out − clock-in from string date/time; negative wraps +24h | `TaskCheckListModal.jsx:224-239` | Same algorithm, timezone-aware |
| On clock-out, tasks marked Completed set `projects.tasks[i].EmployeeTaskStatus = "completed"` | `TaskCheckListModal.syncProjectTaskStatuses` | Should become a transaction |
| On clock-out, one `notifications` doc of type `visit_completed` per attendance (duplicate guard query `attendanceId + type`) and `attendance.customerNotifiedAt` | `utils/visitNotifications.js` | Ideal FCM trigger |
| Customer signature is optional; requires an attendance record for that date; stored as PNG in Storage, URL on the attendance doc; can be replaced | `CustomerSignaturePad.jsx`, `JobDetail.jsx` | Native signature component |
| Auto clock-out after project `maxWorkingHours` (default 8) by the backend every 15 min; sets `autoClockOut: true` | `backend/services/autoClockOut.js` | No mobile change; see timezone risk |
| Admin approve/reject/edit attendance; delete writes an `attendanceAuditLogs` entry first | `AllAttendance.jsx:230-420` | |
| Recurrence: Daily, Every Other Day, Weekly (1 weekday), Twice a week (exactly 2 weekdays), Monthly (day of month, clamps to last day), Yearly (month + day). No end date ⇒ 1 year; hard cap 500 days iterated | `utils/calendarRecurrence.js`, `CreateEvent/index.jsx:214-226` | Port verbatim; unit-test |
| Staff calendar shows projects where `assignedEmployee array-contains <employee doc id>` | `hooks/useCalendarData.js:86-91` | |
| Staff see only tasks where `task.employee.id == uid` | `Tasks.jsx:78`, `checklistUtils.filterEmployeeProjectTasks` | |
| Project create reserves assets: `assetsInUse += qty`, `assetsPending = quantity - assetsInUse`; edit applies the difference; delete releases | `ProjectForm.jsx:176-214`, `ProjectEditor.jsx:419-470`, `ProjectTable.jsx:49-79` | Non-transactional today |
| Payroll month docs are auto-created (salary 0) for every employee the first time an admin opens a month; on the 1st of a month, salary/bonus/tax carry over from employee doc / previous month | `AdminPayroll.jsx:125-225` | Admin-only side effect of *viewing* |
| Payroll edits on a `paid` month update the employee defaults only, not the month row | `AdminPayroll.jsx:242-326` | |
| Project status values `OnGoing`, `OnHold`, `Done`; task status `onGoing`, `completed`, `unassigned`; attendance `pending`, `approved`, `rejected`; leave `pending`, `approved`, `rejected` | various | Shared enums in `src/types` |

---

## 9. Defects and risks found in the current web app

These are reported, **not fixed** (out of scope for this phase). Several directly affect the mobile port.

| # | Severity | Finding | Evidence | Mobile impact |
|---|---|---|---|---|
| 1 | **Critical** | Two Firebase Admin service-account JSON files (with private keys) are **committed to git** (`white-now-erp` and older `white-now-5e137`) | `git ls-files backend/` | Rotate keys before anything else; never bundle in the app |
| 2 | **Critical** | Backend `/create-user` and `/delete-user` have **no authentication**. `/create-user` writes to the collection named in `userType`, so `userType:"admins"` creates an admin | `backend/index.js:34-118` | **Fixed** in `cc83423`: both require an Admin ID token and whitelist inputs |
| 3 | **Critical** | Production Firestore rules were documented on the review date as an **open catch-all until 2030** (`docs/firestore-rules-visit-checklist.md`). Whether the stricter rules were since published is unknown | docs | Any app user can read/write everything |
| 4 | High | Public self-signup can create **Employee** accounts with no approval; employees can read all clients, all projects, payroll | `SignupPage.jsx` | Gate or remove self-signup for Employee on mobile |
| 5 | High | Client "Projects" page lists **all projects** client-side then filters; also downloads all `clients` and `assets` | `Admin/pages/Projects.jsx:43-110` | Under strict rules this query fails; mobile must use `where("clientId","==",uid)` |
| 6 | High | Clients can open **Project Tasks** and add/edit/delete tasks (no role check in `ProjectChecklistModal`) | `ProjectTable.jsx:286`, `ProjectChecklistModal.jsx` | Mobile Client view must be read-only |
| 7 | High | Client deletion removes only the Firestore doc; the Auth account remains | `Customers.jsx:63-78` | Store "account deletion" requirement |
| 8 | High | Salary/bonus/tax are stored on `employees/{id}`, which every signed-in user can read (proposed rules) and the employee can write | `AdminPayroll.jsx:257`, rules doc | Data exposure; employee could edit own salary field |
| 9 | Medium | Proposed rules match `/payroll/{id}` but data lives in `/payroll/{id}/monthwise/{month}` ⇒ employees would be **denied** their payroll history once those rules are published | rules doc vs `PayrollHistory.jsx:81` | **Fixed** by the 9 Oct 2026 hardening: employees can read their own payroll records |
| 10 | Medium | Public QR page `/project/:id` reads a project without sign-in; works only under open rules | `QrCodeDetails` | Decide whether QR stays public |
| 11 | Medium | Date handling mixes UTC (`toISOString().split("T")[0]` in `EmployeeAttendance.jsx`, `AllAttendance.jsx`) and local (`dayjs()` in calendar). The backend auto clock-out parses `"YYYY-MM-DD HH:mm"` in the **server** timezone | multiple | Wrong "today" near midnight; wrong auto clock-out offset |
| 12 | Medium | XSS risk: leave attachment preview builds `innerHTML` with uploaded file name/URL | `AdminLeaveManagement.jsx:434`, `EmployeeLeave.jsx:634` | Not applicable in RN, but data may contain HTML |
| 13 | Medium | Read-modify-write on arrays (`tasks`, `events`, `documents`) and asset counters without transactions ⇒ lost updates when two people edit at once | multiple | Use transactions on mobile writes |
| 14 | Low | Leave attachments stored at `leave-documents/{timestamp}_{name}` (no user folder) ⇒ hard to secure per user | `EmployeeLeave.jsx:151` | **Fixed**: new uploads use `leave-documents/{uid}/…` (`ea24ea6`) |
| 15 | Low | Staff Attendance page is "history only"; the QR button and clock actions there are unreachable for employees (`isAdmin` checks a `role` field that is never set) | `EmployeeAttendance.jsx:115-118, 928` | Do not port the dead branch |
| 16 | Low | `ForgotPassword` redirects to non-existent `/signIn`; reveals whether an email is registered | `ForgotPassword.jsx:53` | Fix in mobile flow |
| 17 | Low | Three toast libraries, duplicated helper functions (`parseDateTimeToMs` ×4) | — | Consolidate in mobile |
| 18 | Info | `docs/ATTENDANCE_GUIDE_FOR_CLIENT.md` says staff clock in on the Attendance page; the code now requires the Calendar | code vs docs | Use code as truth |

---

## 10. What can be reused vs rewritten

**Reusable almost as-is (pure logic, port to TypeScript):**
`utils/calendarRecurrence.js`, `utils/calendarDates.js`, `utils/calendarSearch.js`, `utils/attendanceUtils.js`
(except `getCurrentLocation`), `utils/checklistUtils.js`, `utils/visitNotifications.js`, the worked-time and payroll math,
status enums, and the Firestore data shapes. `hooks/useCalendarData.js` logic transfers with minor changes.
`utils/taskDescription.js` needs a non-DOM HTML parser on mobile (it relies on `DOMParser`).

**Reusable unchanged:** the Firebase project, Firestore collections and fields, Storage paths, the Node backend endpoints
(after adding auth — a backend change that needs a separate decision).

**Must be rewritten:** every screen and component (all JSX uses DOM elements + Tailwind classes), tables, modals, the
rich-text editor, maps/address picker, file pickers, PDF preview, downloads, QR download/share, signature canvas,
geolocation, toasts, routing/navigation, and local persistence.

---

## 11. Web-only technology and its Expo / React Native replacement

Format: **current web implementation → why it does not transfer → recommended approach.** Nothing is implemented yet.

| Area | Current web implementation | Why it does not transfer | Recommended Expo / RN approach |
|---|---|---|---|
| DOM / HTML elements | All screens use `div`, `table`, `input`, `select`, `button` with Tailwind classes | RN has no DOM | Rebuild with RN primitives; NativeWind if the team wants Tailwind-style classes, otherwise `StyleSheet` |
| `window` / `document` | `document.addEventListener('mousedown')` for dropdowns, `document.body.style.overflow`, `window.addEventListener('keydown')` (Esc), `document.getElementById('qr-code')`, `document.createElement('a'/'canvas'/'div')` | No globals | Bottom sheets / modals with built-in dismissal; hardware back via Expo Router |
| `localStorage` | `currentUser`, `isEmailVerified`, `userType` cache | Not available | Firebase Auth persistence via `getReactNativePersistence(AsyncStorage)`; profile cache in AsyncStorage; secrets (if any) in `expo-secure-store` |
| HTML tables | `ReusableTable` (search, sort, paging, row actions) on almost every page | Wide tables are unusable on phones | `FlashList`/`FlatList` of cards, search bar, filter chips, infinite scroll, swipe or "⋯" row actions |
| Modals / multi-step dialogs | `ReusableModal`, `ConfirmationModal`, 4–5 step project wizards | Desktop-sized centred dialogs | Full-screen stack screens for forms/wizards; bottom sheets (`@gorhom/bottom-sheet`) for pickers and quick actions; `Alert.alert` for confirmations |
| Hover | Tooltips on icon buttons (`group-hover`), hover row highlight | No hover on touch | Text labels on actions, long-press hints |
| Top bar with dropdown menus | `TopBarNavigation` | Not mobile navigation | Bottom tabs per role + "More" stack for overflow (see plan §4) |
| Drag and drop | Admin document upload drop zone (`handleDrag/handleDrop`) | No DnD | `expo-document-picker` (multiple) |
| Browser file pickers | `<input type="file">` for photos, leave docs, payroll proofs, client documents, profile picture, feedback image | No file input | `expo-image-picker` (camera + system photo picker), `expo-document-picker` for PDF/XLSX |
| Image validation | `file.type`, `file.size`, `file.lastModified` | Different asset object | Use `asset.mimeType`, `asset.fileSize`; compress with `expo-image-manipulator` before upload |
| Upload | `uploadBytes(ref, File/Blob)` | Blob from `fetch(uri)` works but is memory-heavy | `uploadBytesResumable` with blob from local URI, progress UI, retry |
| Rich text editor | `contentEditable` + `document.execCommand` + `DOMParser` sanitizer | None exist in RN | Admin authoring: `@10play/tentap-editor` (or a WebView editor). Display: `react-native-render-html` with the same whitelist. Port the sanitizer with a non-DOM parser (e.g. `htmlparser2`) |
| `dangerouslySetInnerHTML` | Task descriptions | Not available | `react-native-render-html` |
| PDF preview | `<iframe src=pdfUrl>` | No iframe | `react-native-webview` (iOS renders PDF natively; Android needs Google viewer or `react-native-pdf` in a dev build) or open with `expo-web-browser` |
| Browser downloads | `<a download>` for payroll proofs, documents, leave attachments, QR PNG | No downloads folder access | `expo-file-system` download → `expo-sharing` share sheet (save to Files) |
| Web Share / clipboard | `navigator.share`, `navigator.clipboard` (QR) | Different APIs | `expo-sharing` / RN `Share`, `expo-clipboard` |
| QR rendering + PNG export | `QRCodeSVG` + SVG→canvas→PNG | No canvas | `react-native-qrcode-svg` + `toDataURL` or `react-native-view-shot` |
| Signature capture | `<canvas>` with mouse/touch handlers, `toBlob` PNG | No canvas | `react-native-signature-canvas` (WebView) or a Skia/SVG pad; export PNG and upload to the same Storage path |
| Geolocation | `navigator.geolocation.getCurrentPosition` with high-accuracy then low-accuracy retry | Browser API | `expo-location` foreground only (`requestForegroundPermissionsAsync`, `getCurrentPositionAsync`) with the same retry policy |
| Maps | Leaflet + OSM tiles; `MapContainer`, click-to-pick marker | Leaflet is DOM-based | `react-native-maps` (Apple Maps on iOS, Google Maps on Android — needs an Android Maps API key) or MapLibre with a commercial tile provider |
| Geocoding | Direct `fetch` to Nominatim from the browser at clock-in | Works technically but violates Nominatim usage policy at scale and leaks addresses to a third party | Use stored `projects.coordinates` (already saved by the address picker); geocode server-side only when missing |
| Calendar | Custom month grid + week strip; FullCalendar installed but unused | DOM | Rebuild the shell with `react-native-calendars` (marked dots per date) or a custom grid; reuse recurrence logic |
| Date pickers | MUI X `DatePicker`, `react-datepicker`, native `<input type=date/time>` | DOM | `@react-native-community/datetimepicker` (or `react-native-modal-datetime-picker`) |
| Toasts | `react-hot-toast`, `sonner`, `react-toastify` | DOM | One library: `burnt` or `react-native-toast-message` |
| Browser notifications | Not used | — | `expo-notifications` + FCM (new) |
| URL redirects | `navigate()`, `<Navigate>`, `/project/:id` links in QR codes | Different router | Expo Router redirects; deep links for `project/[id]` via scheme + universal/app links |
| External links | `<a target="_blank">` to Storage URLs | — | `expo-web-browser` / `Linking.openURL` |
| `alert()` | Calendar event form validation | Blocks UI on web, ugly on mobile | Inline field errors |
| Printing | Not used | — | — |
| Camera | Not used directly (file input only) | — | `expo-image-picker.launchCameraAsync` for job photos |
| `URL.createObjectURL` | Image previews | Not available | Use the local `uri` from the picker |
| Third-party web SDKs | none besides Firebase JS SDK | — | Firebase JS SDK works in Expo (recommended for speed); `@react-native-firebase` only needed if native FCM/Crashlytics are required |

---

## 12. Mobile UX migration analysis

The goal is to keep functionality, business rules, information architecture, workflows, permissions and data while
changing presentation and interaction.

| Web pattern | Where | Mobile redesign |
|---|---|---|
| Top bar with category dropdowns | all roles | Bottom tabs (4–5) + "More" list screen per role |
| Desktop data tables with many columns | Tasks, Attendance (both), Leaves, Payroll, Projects, Assets, Employees, Clients, Feedback, Documents | Card lists with the 2–3 most important fields, status chip, tap → detail screen; filters move to a filter sheet with chips |
| Stats cards that toggle filters | Tasks, Attendance, Projects | Horizontally scrollable stat chips at top of the list, same toggle behaviour |
| Inline row editing | Admin Payroll (salary/bonus/tax/status in the table) | Per-employee payroll detail screen with numeric inputs and a sticky Save; bulk "Mark all paid" in header menu |
| Multi-step modal wizards | Create/Edit Project (4 steps), Project Viewer (5 steps) | Stack screens with a step header and persistent Next/Back footer; viewer becomes a tabbed detail screen (Overview / Schedule / Team & Tasks / Photos / QR) |
| Centred modals | Leave apply, feedback, task add, asset CRUD, document upload | Full-screen form screens (keyboard-aware) |
| Confirmation modals | delete, approve, clock in/out | Native `Alert` or a bottom-sheet confirm |
| Calendar month grid + jobs overlay + job detail drawer | Calendar | Already mobile-inspired: keep week strip + month grid; day jobs as bottom sheet; job detail as a pushed screen |
| Clock-out checklist modal | Staff | Full-screen checklist with large tap targets per task (Completed / N/A), remark field, photo strip with camera + library buttons, sticky "Clock out" |
| Signature pad modal | Staff | Full-screen landscape-friendly pad, Clear / Save, name field |
| Image gallery modal | Admin attendance, project viewer, job detail, job history | Swipeable full-screen viewer with pinch zoom |
| Maps with many markers | Admin Locations | Map screen with clustered markers + list toggle |
| Address autocomplete + map picker | Signup, employee/client/project forms | Search field with debounced suggestions (server-side geocoding) + optional map pin screen |
| Rich text editor | Admin task authoring | Simple formatting toolbar above keyboard; render read-only HTML elsewhere |
| PDF/document preview | Payroll proof, client docs, leave attachments | Open in in-app viewer with Share/Save |
| Hover tooltips | icon buttons | Visible labels; min 44×44 pt touch targets |
| Loading spinners / "Connect Firebase to see your documents" empty copy | many | Skeletons, pull-to-refresh, real empty states ("No documents yet"), offline banner, retry on error |
| Toast-only errors | everywhere | Inline field errors for forms; toast only for background results |
| Keyboard | — | `KeyboardAvoidingView`/`react-native-keyboard-controller`, correct `keyboardType` (email, phone, numeric for hours/salary), return-key chaining |
