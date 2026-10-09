# Whitenow — Firebase & Backend Audit for Mobile

> **Reference update (10 Oct 2026):** commit hashes in this document refer to the **`whitenow-revamp`** repository, not `whitenow-mobile`. The original snapshot `eb10728` no longer exists in that repository's history; the current reference is `b1c1b99` (Firebase security hardening documentation, `prod`). Statements affected by the 9 Oct 2026 hardening are corrected inline; see `whitenow-revamp/docs/FIREBASE_SECURITY_HARDENING.md`.

Read-only audit of `whitenow-revamp@b1c1b99` (client code, `backend/`, `docs/`). Firebase itself was **not** modified.
The live Firebase Console (rules, indexes, Storage rules, registered apps) was **not** inspected: the Firebase CLI on this
machine is signed in but has no active project, and selecting one would change local CLI configuration. Items that need
the console are marked **INFORMATION NEEDED**.

Firebase project used by the web app: **`white-now-erp`** (`white-now-erp.firebaseapp.com`, bucket `white-now-erp.firebasestorage.app`).
An older project `white-now-5e137` also has a committed service-account key.

---

## 1. Authentication

| Item | Finding | Evidence |
|---|---|---|
| Providers | Email/password only. `GoogleAuthProvider` created but unused | `Config/firebaseConfig.js:17` |
| Login | `signInWithEmailAndPassword` | `LoginPage.jsx:176` |
| Logout | `signOut(auth)` + clear `localStorage` | `AuthContext.jsx:139` |
| Password reset | `sendPasswordResetEmail` after looking the email up in `admins`, `employees`, `clients` (needs unauthenticated read of those collections — fails under the proposed rules) | `ForgotPassword.jsx:20-49` |
| Email verification | Function exists (`sendEmailVerification`), never triggered, never enforced | `AuthContext.jsx:155`, `VerificationPage.jsx` |
| Persistence | Firebase default (IndexedDB) + `localStorage` profile copy | `AuthContext.jsx:15-20, 85-100` |
| Role determination | Profile lookup by `uid` in `admins` → `employees` → `clients`; `userType` field | `AuthContext.jsx:22-55` |
| Profile lookup | `where("uid","==",uid)` query (doc id equals uid for accounts created by signup/backend) + live `onSnapshot` on the found doc | `AuthContext.jsx:103-114` |
| Account creation | (a) Public signup → client SDK writes `employees/{uid}` or `clients/{uid}`; (b) Admin → backend `/create-user` | `SignupPage.jsx`, `backend/index.js` |
| Account deletion | Employee: backend `/delete-user` (Auth + docs). Client: `deleteDoc` only, Auth user remains. No self-deletion | `AllEmployees.jsx:211`, `Customers.jsx:63` |
| Admin accounts | No UI creates admins. Must be created by hand (the backend only creates Employee/Client and requires an Admin ID token) | — |
| Custom claims | None | — |

**Mobile:** use the Firebase JS SDK v12 with `initializeAuth(app, { persistence: getReactNativePersistence(AsyncStorage) })`.
Keep the same role lookup (prefer `getDoc(admins/{uid})` → `employees/{uid}` → `clients/{uid}` by id, which works with
the proposed rules and avoids three queries).

---

## 2. Firestore

### 2.1 Collections and document shapes (from code)

| Collection | Doc id | Key fields | Written by |
|---|---|---|---|
| `admins` | uid | `uid, email, name, userType:"Admin", profileImageUrl` | manual / backend |
| `employees` | uid | `uid, email, name, dob, phoneNumber, address, coordinates{lat,lng}, userType:"Employee", jobTitle, drivingLicense, maxWorkingHrs, qualifications, availabilityAfterWorkingHrs, drivingWithOwnCars, typeOfContract, workingInCompanySince, leavesTillDate, extraFieldsObject{}, salary, bonus, tax, profileImageUrl, createdAt/dateCreated` | backend, signup, Admin, Payroll |
| `clients` | uid | `uid, email, name, dob, phoneNumber, address, coordinates, userType:"Client", customerType, city, postcode, contactPartner, extraFieldsObject, profileImageUrl, documents[{title,fileName,fileType,fileUrl,storagePath,createdAt,updatedAt}]` | backend, signup, Admin, Documents |
| `projects` | auto | `projectType, projectName, projectDescription, projectAddress, coordinates, projectColor, clientId (client uid), clientName, assignedEmployee[] (employee doc ids), assignedEmployeeName, selectedAssets[], assetQuantities{name:qty}, startDate, endDate, maxWorkingHours, workingDays[], frequency[], status (OnGoing/OnHold/Done), owner, userId, createdAt (ISO), updatedAt, events[], tasks[]` | Admin, Staff (tasks) |
| `projects.events[]` (embedded) | `id` | `eventName, projectName, projectColor, frequency, startDate, endDate, weekdays[], dayOfMonth, recurrenceMonth, status, createdAt, updatedAt` (+ optional `startTime/endTime` read by calendar) | Admin |
| `projects.tasks[]` (embedded) | `id` (uuid) | `subject, description (sanitized HTML), employee{id,name}, status (onGoing/completed/unassigned), EmployeeTaskStatus` | Admin, Staff, (Client — bug) |
| `attendance` | auto | `projectId, projectName, clientId, clientName, employeeId (uid), employeeName, clockInDate, clockInTime, clockOutDate, clockOutTime, workedMinutes, workedHoursLabel, locationValidated, distance, projectAddress, clockInCoordinates{latitude,longitude,accuracy}, projectCoordinates, AttendanceStatus, autoClockOut, checklistItems[{taskId,subject,description,status,remark}], checklistCompletedAt, checklistCompletedBy, clockOutImageUrls[], clockOutImagePaths[], clockOutImageMeta[], clockOutImageUrl, customerSignatureUrl, customerSignaturePath, customerSignerName, customerSignedAt, customerSignatureCapturedBy, customerNotifiedAt, adminEditNote, adminEditedAt, adminEditedBy, createdAt, updatedAt` | Staff, Admin, backend |
| `attendanceAuditLogs` | auto | `action:"delete", reason, attendanceId, recordSnapshot{…}, deletedAt, deletedBy, deletedByName` | Admin |
| `notifications` | auto | `type:"visit_completed", clientId, attendanceId, projectId, projectName, clockInDate, message, read, createdAt` | Staff |
| `leaves` | auto | `employeeName, employeeUid, leaveDate, subject, message, documents[{name,url,size,type}], status, dateApplied, createdAt, updatedAt` | Staff, Admin |
| `employeeDirectory` | uid | names only, for staff names on non-Admin screens (added in `ea24ea6`) | backend, Admin |
| `payroll/{employeeId}/monthwise/{YYYY-MM}` | month key | `salary, bonus, tax (percent), status (pending/paid), proof (URL), proofFileName, proofFileType, timestamp` | Admin |
| `assets` | auto | `name, quantity, assetsInUse, assetsPending` (+ `id` field read by Projects page) | Admin |
| `feedback` | auto | `employeeId, employeeName, project, client, description, date, createdAt` | Staff |
| `clientFeedback` | auto | `clientId, clientName, project, employee, description, imageUrl, date, time, createdAt` | Client |

Relationships: `projects.clientId → clients/{uid}`; `projects.assignedEmployee[] → employees/{id}`;
`projects.tasks[].employee.id → employees.uid`; `attendance.projectId → projects`, `attendance.employeeId → employees.uid`,
`attendance.clientId → clients.uid`; `notifications.attendanceId → attendance`; `payroll/{employeeId}` → `employees/{id}`;
`leaves.employeeUid → employees/{id}`. Feedback stores names/ids as plain strings.

### 2.2 Queries, listeners and indexes

| Query | Where | Index |
|---|---|---|
| `admins/employees/clients where uid ==` | AuthContext, Login | single-field |
| `admins/employees/clients where email ==` | ForgotPassword | single-field |
| `projects where clientId ==` | Job History, Client Feedback | single-field |
| `projects where assignedEmployee array-contains` | Calendar (Staff) | single-field |
| `attendance where employeeId ==` (RT) | Calendar, Attendance (Staff) | single-field |
| `attendance where clockInDate >= & <=` (RT) | Calendar (Admin) | single-field range |
| `attendance where projectId in [≤10]` | Job History | single-field |
| `attendance where projectId ==` | Project viewer | single-field |
| `notifications where clientId ==` (RT) | Client notifications | single-field |
| `notifications where attendanceId == and type ==` | Clock-out duplicate guard | **composite** (`attendanceId`, `type`) — required per `docs/` |
| `assets where name ==` | Project create/edit/delete | single-field |
| `feedback where employeeId ==`, `clientFeedback where clientId ==` (RT) | Feedback pages | single-field |
| Whole-collection reads/listeners: `projects` (RT ×6 screens), `attendance` (RT, Admin), `employees`, `clients`, `assets`, `leaves`, `feedback`, `clientFeedback` | many | none |

No `orderBy`, `limit` or cursor pagination is used anywhere; all sorting is in JS. **No transactions or batched writes** on the client.
The backend uses one `batch` in `deleteUser`.

### 2.3 Writes by type

- **Creates:** `projects`, `attendance`, `attendanceAuditLogs`, `notifications`, `leaves`, `assets`, `feedback`, `clientFeedback`, `payroll/…/monthwise/*`, profile docs (signup).
- **Updates:** `projects` (status, full doc, `tasks`, `events`), `attendance` (clock-out, signature, status, admin edit, notify flag), `assets` counters, `employees` (profile, salary/bonus/tax, avatar), `clients` (profile, documents, avatar), `admins` (avatar), `leaves.status`, `notifications.read`, `payroll` rows.
- **Deletes:** `projects`, `attendance`, `assets`, `clients`, `feedback`, `clientFeedback`, `payroll` month docs.

**Mobile guidance:** replace whole-collection reads with scoped queries per role, add `orderBy` + `limit` + pagination for
lists, and wrap array read-modify-write (`tasks`, `events`, `documents`, asset counters) in `runTransaction`.
These keep the same data shape, so the web app is unaffected.

---

## 3. Storage

| Path | Written by | Content | Displayed via |
|---|---|---|---|
| `profilePics/{uid}/{ts}_{name}` | all roles | avatar image | `profileImageUrl` |
| `attendance/clockout/{uid}/{attendanceId}/{ts}_{name}` | Staff | job photos (JPG/PNG/WebP ≤5 MB, ≤5) | `clockOutImageUrls[]` |
| `attendance/signatures/{uid}/{attendanceId}/{ts}.png` | Staff | customer signature PNG | `customerSignatureUrl` |
| `leave-documents/{uid}/{ts}_{name}` | Staff | pdf/doc/docx/jpg/png | `leaves.documents[].url` |
| `proofs/{employeeId}_{YYYY-MM}_{ts}.{ext}` | Admin | payroll proof | `payroll.proof` |
| `documents/{clientUid}/{ts}_{name}` | Admin | pdf/xlsx/xls/jpg/png/gif | `clients.documents[].fileUrl` |
| `clientFeedback/{uid}/{ts}` | Client | image | `clientFeedback.imageUrl` |

All files are shown through long-lived `getDownloadURL` tokens. Anyone holding a URL can read the file regardless of rules.
Only Admin document replace/delete calls `deleteObject`; nothing else ever deletes Storage files (including when users,
attendance or projects are deleted).

**Storage rules:** not in the repo — **INFORMATION NEEDED**. `docs/firestore-rules-visit-checklist.md` notes that photo
and signature uploads depend on Storage rules that were not reviewed.

---

## 4. Cloud Functions

None. There is no `functions/` directory and the client never calls `httpsCallable`. Server-side logic lives in the
Express backend (§6). The auto clock-out job runs as a `setInterval` inside that server, so it only runs while the server
process is awake (Render free instances sleep — **INFORMATION NEEDED**: hosting plan).

---

## 5. Firebase Cloud Messaging (push)

**Not implemented.** No `firebase/messaging`, service worker, `getToken`, device-token storage or server sender exist.
The only notification system is the in-app `notifications` collection (client visit completed).

Workflows that would benefit from push (recommendation for mobile; none exist today):

| Event | Recipient | Trigger source today |
|---|---|---|
| Visit completed (checklist ready) | Client | `notifications` doc created at clock-out — direct 1:1 mapping |
| New job / schedule change on my project | Staff | `projects.events` / `assignedEmployee` change |
| Task assigned to me | Staff | `projects.tasks` change |
| Leave approved / rejected | Staff | `leaves.status` change |
| Attendance approved / rejected / edited / auto-closed | Staff | `attendance` update, backend auto clock-out |
| Payroll marked paid / proof uploaded | Staff | `payroll` update |
| New document available | Client | `clients.documents` change |
| New leave request, new feedback, out-of-range clock-in | Admin | `leaves` / `feedback` / `attendance` create |
| Reminder: still clocked in | Staff | open `attendance` approaching `maxWorkingHours` |

Implementation needs a server to send pushes (backend endpoint or new Cloud Functions), device tokens per user
(e.g. `users/{uid}/devices/{token}` or a field on the profile), Android `POST_NOTIFICATIONS`, iOS APNs key, and deep links
(`whitenow://client/job-history/{attendanceId}` etc.). Push text must not contain salary or personal details.

---

## 6. Node backend audit

`backend/index.js` — Express 4, `cors({origin: CORS_ORIGIN})`, `body-parser.json()`, Firebase Admin SDK initialised from
`backend/.env` (not committed) — but two full service-account JSON files **are committed** in `backend/`.

| Endpoint | Method | Purpose | AuthN | AuthZ | Request | Response | Errors | Frontend caller | Firebase interaction | Mobile needs it? |
|---|---|---|---|---|---|---|---|---|---|---|
| `/` | GET | Health ("hello world"), declared twice | none | none | — | text | — | none | none | No |
| `/create-user` | POST | Create Auth user + profile doc | **Firebase ID token** (`cc83423`) | **caller must be Admin**; `userType` whitelisted | `{email, password, userType, additionalData{…}}`; `userType` "Employee"→`employees`, "Client"→`clients`, **anything else is used as the collection name** | 201 `{message, uid}` | 400 `{message}` (Admin SDK error text) | `AllEmployees.jsx:147`, `ClientCreateModal.jsx:90` | `auth.createUser`; `db.collection(c).doc(uid).set({uid,email,...additionalData,createdAt})` | **Yes** (Admin: create employee/client) |
| `/delete-user` | DELETE | Delete Auth user + matching docs | **Firebase ID token** (`cc83423`) | **caller must be Admin** | `{uid, userRef}` (`userRef` = collection name) | 200 `{message}` | 400 `{message}` | `AllEmployees.jsx:215` | `auth.deleteUser`; batch-delete `userRef where uid==` | **Yes** (Admin: delete employee; should also be used for clients and for self-service account deletion) |
| `/cron/auto-clockout` | POST | Run auto clock-out now | **none** (still unauthenticated; deferred, not fixed) | **none** | — | 200 `{message, closedCount}` | 500 | none (cron/manual) | reads **all** `attendance`; reads `projects`; updates open records | No (server job) |
| (timer) | — | Same job every 15 min | — | — | — | — | logs | — | as above | No |

**Can mobile use the backend unchanged?** It can call it — there are no cookies, CORS does not apply to native HTTP,
and the JSON contract is simple. **Recommendation:** do not ship a mobile build that calls these endpoints until the
backend verifies a Firebase ID token (`Authorization: Bearer <idToken>` → `admin.auth().verifyIdToken` → caller is in
`admins`) and whitelists `userType`/`userRef`. That is a small, additive backend change that the web app can adopt at the
same time; it is out of scope for this phase and needs your approval. Self-service account deletion (a store requirement)
also needs a new authenticated endpoint (e.g. `DELETE /me`).

Other backend notes:
- `formatPrivateKey` replaces `\n` with `\n` (no-op); it works only because dotenv expands `\n` inside double quotes.
- `runAutoClockOut` builds dates with `new Date(y, m-1, d, h, min)` in the **server's** timezone and writes clock-out time
  in that timezone. Unless the server TZ matches the business TZ, auto clock-out times are shifted.
- `runAutoClockOut` reads the entire `attendance` collection every 15 minutes (cost grows linearly with history).
- No rate limiting, input validation, logging or request IDs.

---

## 7. Security rules

### 7.1 What is in production — INFORMATION NEEDED

`docs/firestore-rules-visit-checklist.md` states that, at review time, production Firestore rules were an open catch-all:

```
match /{document=**} { allow read, write: if request.time < timestamp.date(2030, 6, 19); }
```

It then supplies a stricter replacement (also in `docs/firestore-rules-login-fix.md`). The repo does not show whether that
replacement was published. **We need a copy of the current Firestore and Storage rules from the console.**

### 7.2 Proposed rules (from `docs/`) — role model

- Roles are proven by the existence of `admins/{uid}`, `employees/{uid}`, `clients/{uid}` with matching `userType`.
- Admin: full access; catch-all `/{document=**}` is admin-only.
- Employee: read all `employees`, all `clients`, all `projects`, all `attendance`, all `notifications`, all `assets`, all `leaves`,
  all `feedback`, all `clientFeedback`, all `documents`, `payroll`; update any project; create/update own attendance;
  create/update/delete **any** leave; create feedback; write **own** employee doc.
- Client: read own `clients` doc, own `projects`, own attendance (by `clientId` or project ownership), own notifications
  (may only flip `read`), own `clientFeedback`; create `clientFeedback`; write own client doc.

### 7.3 Concerns with the proposed rules (for the mobile release)

| # | Concern | Effect |
|---|---|---|
| 1 | `match /payroll/{id}` does not cover `payroll/{id}/monthwise/{month}` | **Fixed** (9 Oct 2026): employees can read their own payroll records |
| 2 | Employees can write their own `employees/{uid}` doc, which holds `salary`, `bonus`, `tax`, `userType` | An employee could change their salary defaults or role field |
| 3 | `employees` readable by any signed-in user (incl. Clients) | Exposes staff DOB, phone, home address and salary to clients |
| 4 | `clients` readable by all employees, incl. `documents[]` URLs | Staff can open every client's documents |
| 5 | `leaves` update/delete allowed to any employee for any leave | An employee can approve their own leave |
| 6 | `projects` update allowed to any employee for any field | Staff can change client, team, events |
| 7 | List queries are not filters: Client Projects page (`onSnapshot(collection(projects))`), ForgotPassword (unauthenticated email lookup), public QR page | These **break** when rules are enforced; mobile must use scoped queries |
| 8 | Self-signup creates `employees/{uid}` or `clients/{uid}`, but the write rules require `isEmployee()` / `isClient()`, which check that same doc already exists | **Self-signup fails for both roles** under the proposed rules unless a `create` rule for the user's own doc is added |
| 9 | Signature/photo uploads depend on Storage rules not in the repo | Unknown |

Recommended direction (to discuss, not implemented): role via custom claims set by the backend; payroll subcollection
rule `match /payroll/{employeeId}/monthwise/{month}` readable by that employee; split salary into the payroll tree only;
field-level `affectedKeys()` limits for employee profile and project updates; Storage rules mirroring the paths in §3.

### 7.4 Sensitive collections

`employees` (DOB, phone, home address, salary), `payroll` (salary, tax, proofs), `clients` (addresses, documents),
`attendance` (precise GPS coordinates, photos inside clients' premises, signatures), `leaves` (attachments may be medical).

---

## 8. Mobile Firebase setup checklist (for later phases)

- Register **Android** and **iOS** apps in `white-now-erp` (needs package name / bundle id — see CLIENT_INFORMATION_REQUIRED).
- Restrict the API key to the app ids; consider App Check (Play Integrity / App Attest) once rules are fixed.
- Create a **separate dev/staging Firebase project** for mobile development and store review data; production stays untouched.
- Composite index `notifications(attendanceId, type)` must exist in every project used.
- Add Storage rules and decide on retention for photos/signatures.
