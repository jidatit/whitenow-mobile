# Whitenow — Mobile Screen & Feature Map

> **Reference update (10 Oct 2026):** commit hashes in this document refer to the **`whitenow-revamp`** repository, not `whitenow-mobile`. The original snapshot `eb10728` no longer exists in that repository's history; the current reference is `b1c1b99` (Firebase security hardening documentation, `prod`). Statements affected by the 9 Oct 2026 hardening are corrected inline; see `whitenow-revamp/docs/FIREBASE_SECURITY_HARDENING.md`.

Complete inventory of the live web app (`whitenow-revamp@b1c1b99`, 99 reachable source files) for all three mandatory roles.
Admin is fully in scope for mobile.

**Legend**

- Complexity: **EASY**, **MEDIUM**, **HARD**
- Mobile type: **STD** = Standard mobile UI · **MSI** = Mobile-specific interaction · **NDC** = Native device capability · **CPX** = Complex migration
- Flags: 📎 files/photos · 🔔 notifications · 📅 dates/scheduling · 📍 location · 🌐 external service
- R = read, C = create, U = update, D = delete. "RT" = real-time `onSnapshot` listener.
- Paths are relative to `client/src/`.

Counts: **Shared 7 · Client 11 · Staff 15 · Admin 24** (57 items). Cross-role workflows are in §5.

---

## 1. Shared (all roles)

| # | Screen / feature | Web route | Purpose | Components · hooks · services | Firestore / Storage / API | Rules & validation | Flags | Cx | Type |
|---|---|---|---|---|---|---|---|---|---|
| S1 | Login | `/auth/login` | Email + password sign-in, role redirect | `auth/pages/LoginPage.jsx`, `AuthContext` | Auth `signInWithEmailAndPassword`; R `admins`/`employees`/`clients` where `uid==` | Both fields required; role picked by collection order admins→employees→clients | — | EASY | STD |
| S2 | Sign up | `/auth/Signup` | Public self-registration as **Client or Employee** | `SignupPage.jsx`, `Components/AddressField` | Auth `createUserWithEmailAndPassword`; C `clients/{uid}` or `employees/{uid}` {uid,name,email,dob,userType,phoneNumber,address,coordinates?,dateCreated} | All fields required; password ≥6 and confirm match; no approval, no email verification | 📍(address map) 🌐 Nominatim/OSM | MEDIUM | STD (+ address picker) |
| S3 | Forgot password | `/auth/forgotPassword` | Send reset email | `ForgotPassword.jsx` | R all 3 role collections `where email==`; Auth `sendPasswordResetEmail` | Refuses unknown emails (enumeration); redirects to non-existent `/signIn` | — | EASY | STD |
| S4 | Email verification page | `/auth/verification` | "Check your inbox", resend | `VerificationPage.jsx`, `AuthContext.verifyEmail` | Auth `sendEmailVerification` | Not linked from any flow; logout button does nothing | 🔔 email | EASY | STD (decide keep/drop) |
| S5 | Session restore + role routing | `/` | Restore login, route to role home, live profile updates | `App.jsx` (`RootRedirect`, `ProtectedRoute`, `PublicRoute`), `AuthContext` | Auth state; R role collections; RT own profile doc; `localStorage` cache | Admin→`/adminLayout/employees`, Employee→`/employeeLayout/Tasks`, Client→`/clientLayout/projects` | — | MEDIUM | STD |
| S6 | Profile (+ avatar upload) | `/{role}Layout/Profile` | View name/email/role, change profile photo | `Dashboard/Profile/ProfilePage.jsx`, `global/Header.jsx` | Storage `profilePics/{uid}/{ts}_{name}`; U `{role}/{id}.profileImageUrl` | Image only | 📎 | EASY | NDC (camera/photo picker) |
| S7 | Logout | header icon | Confirm then sign out | `Header.jsx`, `ConfirmationModal` | Auth `signOut`; clears cache | — | — | EASY | STD |
| S8* | Public project QR page | `/project/:id` (no auth) | Landing page encoded in project QR codes | `Components/Modals/QrCodeDetails` | R `projects/{id}` unauthenticated | Works only if rules allow public read | — | EASY | Keep on **web**; mobile deep-links to it (see plan) |
| S9* | 404 | `*` | Not found | `Components/NotFoundPage` | — | — | — | EASY | STD |

\* Not counted in the 7: S8 stays a web page, S9 is generic.

---

## 2. CLIENT (11)

Navigation today: Projects · Job History (unread dot) · Feedback · Documents · Profile.

| # | Screen / feature | Web route | Purpose / entry | Components · hooks | Firestore reads | Firestore writes | Storage / API | Business rules / permissions | Depends on | Flags | Cx | Type |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| C1 | Projects list | `/clientLayout/projects` (landing) | See own projects with status counts (Total/Active/Deactive), search, date-range filter, pagination | **`Admin/pages/Projects.jsx`** (shared with Admin), `Admin/components/ProjectTable.jsx`, `ReusableTable`, `StatsCard` | RT **all** `projects` then JS filter `clientId==uid`; R all `clients`, all `assets` | — | — | Read-only (`isActionShow=false`): actions = View details, Tasks. Mobile must query `where("clientId","==",uid)` | S5 | 📅 | MEDIUM | STD |
| C2 | Project details viewer | C1 → "View all Details" | 5-step read-only viewer: details & assets & team, events, timeline, clock-out images by date, QR code | `Admin/components/ProjectDetailViewer.jsx`, `qrcode.react` | R `projects/{id}`, all `employeeDirectory` (names), `attendance where projectId==` | — | QR encodes `{VITE_PROJECT_URL}project/{id}` | Client sees all photos for the project | C1 | 📎 📅 | MEDIUM | STD (tabs) + image viewer |
| C3 | Project tasks (view) | C1 → "Tasks" | View recurring task list and responsible employee | `Admin/components/ProjectChecklistModal.jsx` | RT `projects/{id}`; R all `employees` | **Today: Client can add/edit/assign/delete tasks (no role check) — bug** | — | Mobile: read-only for Client | C1 | — | EASY | STD |
| C4 | Job History list | `/clientLayout/JobHistory` | Completed visits grouped by month; notification panel with unread count | `Client/pages/ClientJobHistory.jsx`, `ClientNotificationsContext`, `utils/checklistUtils` | R `projects where clientId==uid`; R `attendance where projectId in [≤10]` (chunked); filters `clockOutTime` and `clientId` in JS | — | — | Only clocked-out visits; defence-in-depth `clientId` match | W6 | 🔔 📅 | MEDIUM | STD |
| C5 | Visit detail | C4 → tap visit / notification | Checklist results (Completed / N/A / Not marked + remarks), photos, worked time, employee, customer signature | `ClientJobHistory.jsx`, `Components/VisitChecklistView` | R `attendance/{id}` (from notification) | — | Storage image URLs | Ownership check before display | C4 | 📎 📅 | MEDIUM | STD + image viewer |
| C6 | In-app notifications | nav dot + C4 panel | "Your cleaning visit has been completed" | `ClientNotificationsContext.jsx` | RT `notifications where clientId==uid`; JS sort | U `notifications/{id}.read=true` | — | Only `type=="visit_completed"` used | W6 | 🔔 | EASY | STD → add push (NDC) |
| C7 | Feedback list | `/clientLayout/ClientFeedback` | Own feedback history | `Client/pages/ClientFeedback.jsx`, `ReusableTable` | RT `clientFeedback where clientId==uid`; RT `projects where clientId==uid`; R all `employeeDirectory` (names) | — | — | — | — | 📅 | EASY | STD |
| C8 | Submit feedback | C7 → "Add" | Feedback about a project/employee with optional photo | same | — | C `clientFeedback` {clientId,clientName,project,employee,description,imageUrl,date,time,createdAt} | Storage `clientFeedback/{uid}/{ts}` | Project, description, date, time required | C7 | 📎 📅 | EASY | NDC (photo) |
| C9 | Feedback detail | C7 → view | Read one feedback | same | — | — | — | — | C7 | 📎 | EASY | STD |
| C10 | Documents | `/clientLayout/Documents` | Documents admins uploaded for this client; filter by date range/type; preview; download | `Client/pages/ClientDocuments.jsx` | R `clients/{currentUser.id}.documents[]` | — | Storage `documents/{clientUid}/…` URLs | Read-only | W11 | 📎 📅 | MEDIUM | NDC (viewer/share) |
| C11 | Profile & logout | S6/S7 | | | | | | | | 📎 | EASY | NDC |

---

## 3. STAFF / Employee (15)

Navigation today: Tasks · Payroll · Feedback · Leave · Attendance · Calendar · Profile.
**Clock-in/clock-out happens only from the Calendar job detail** (Attendance page is history-only for employees).

| # | Screen / feature | Web route | Purpose / entry | Components · hooks | Firestore reads | Firestore writes | Storage / API | Business rules / validation | Depends on | Flags | Cx | Type |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| E1 | Tasks list | `/employeeLayout/Tasks` (landing) | Tasks assigned to me across projects; Ongoing/Completed stat toggles; filters by project type, project, start/end date; search | `Employee/pages/Tasks.jsx`, `MultiSelectDropdown`, `ReusableDatePicker`, `ReusableTable` | RT **all** `projects` → keep tasks where `task.employee.id==uid`; R all `projects` again for type list | — | — | — | W5 | 📅 | MEDIUM | STD |
| E2 | Task details | E1 → eye icon | Project name/description, task subject, status, employee status, rich-text description, project dates/type | `Tasks.jsx` modal, `utils/taskDescription` | R `projects/{id}` | — | — | HTML sanitized before render | E1 | 📅 | MEDIUM | MSI (HTML render) |
| E3 | Mark task completed | E1 → check icon | Set my task completed | `Tasks.jsx` | R `projects/{id}` | U `projects/{id}.tasks` (sets `status` and `EmployeeTaskStatus` = `completed`) | — | Disabled if already completed; whole-array write | E1 | — | EASY | STD |
| E4 | Calendar (month + week) | `/employeeLayout/Calendar` | My scheduled jobs; colour dots per project per day; search; month total recorded time | `Calendar/Component/Calender`, `CalendarShell/*`, `hooks/useCalendarData`, `utils/calendarRecurrence` | R `projects where assignedEmployee array-contains <employee doc id>`; RT `attendance where employeeId==uid` | — | — | Events expanded client-side (see recurrence rules) | W4 | 📅 | HARD | CPX |
| E5 | Day jobs sheet | E4 → tap date | Jobs for the day with recorded time and signature indicator | `CalendarShell/JobsOverlay`, `JobList`, `JobRow` | (from E4) | — | — | — | E4 | 📅 | MEDIUM | MSI (bottom sheet) |
| E6 | Job detail | E5 → tap job | Client, project, scheduled vs recorded time, description, my tasks, visit checklist results, photos, location, attendance actions, customer signature | `CalendarShell/JobDetail.jsx`, `VisitChecklistView` | (from E4) | — | — | Employee sees only own attendance and own tasks | E5 | 📎 📅 📍 | MEDIUM | STD |
| E7 | Clock in | E6 → "Clock In" → confirm | Start a visit | `Employee/components/CalendarAttendanceModal.jsx`, `utils/attendanceUtils` | R `employees where uid==` | C `attendance` {projectId, projectName, clientName, clientId, employeeId, employeeName, clockInTime "HH:mm", clockInDate "YYYY-MM-DD", locationValidated, distance, projectAddress, clockInCoordinates{lat,lng,accuracy}, projectCoordinates, AttendanceStatus:"pending", createdAt} | 🌐 Nominatim geocode of project address | Only for **today**; blocked if an older session on the project is open or today already completed; distance ≤2000 m ⇒ validated, otherwise allowed but flagged; location denied ⇒ fails | E6 | 📍 📅 🌐 | HARD | NDC |
| E8 | Clock out + visit checklist | E6 → "Clock Out" → confirm | Mark each of my project tasks Completed / N/A (default Not marked) with optional remark; attach up to 5 photos; finish visit | `TaskCheckListModal.jsx`, `utils/checklistUtils`, `utils/visitNotifications` | R `attendance/{id}`; R `notifications where attendanceId== & type==` | U `attendance/{id}` {clockOutTime, clockOutDate, workedMinutes, workedHoursLabel, checklistItems[], checklistCompletedAt, checklistCompletedBy, clientId, clockOutImageUrls[], clockOutImagePaths[], clockOutImageMeta[], clockOutImageUrl}; U `projects/{id}.tasks` (EmployeeTaskStatus); C `notifications` (visit_completed); U `attendance.customerNotifiedAt` | Storage `attendance/clockout/{uid}/{attendanceId}/{ts}_{name}` | JPG/PNG/WebP ≤5 MB, max 5, dedupe; photo upload failure does not block clock-out; can clock out a previous day's open session | E7 | 📎 🔔 📅 | HARD | NDC + CPX |
| E9 | Customer signature | E6 → "Add/Replace customer signature" | Capture client name + signature | `CustomerSignaturePad.jsx` | — | U `attendance/{id}` {customerSignatureUrl, customerSignaturePath, customerSignerName, customerSignedAt, customerSignatureCapturedBy} | Storage `attendance/signatures/{uid}/{attendanceId}/{ts}.png` | Optional; requires an attendance record for that date; name and ink required; PNG ≤5 MB | E7 | 📎 | HARD | NDC |
| E10 | Attendance history | `/employeeLayout/Attendance` | My records; Approved/Pending/Rejected today stats; today's and filtered worked hours; filter by project and date range | `Employee/pages/EmployeeAttendance.jsx`, `DateFilter`, `FilterDropdown` | RT `projects` (all, filtered by `assignedEmployee`); RT `attendance where employeeId==uid`; R all `employees` | — (history-only; clock actions unreachable for employees) | — | Banner tells staff to use Calendar | W8 | 📅 | MEDIUM | STD |
| E11 | Leave list | `/employeeLayout/EmployeeLeave` | My leave applications with status filter and date range | `Employee/pages/EmployeeLeave.jsx` | R `employees/{id}`; R **all** `leaves` → JS filter `employeeUid==id` | — | — | — | W9 | 📅 | EASY | STD |
| E12 | Apply for leave | E11 → "Apply" | Request a day off with optional attachments | same | — | C `leaves` {employeeName, employeeUid, leaveDate, subject, message, documents[{name,url,size,type}], status:"pending", dateApplied, createdAt} | Storage `leave-documents/{uid}/{ts}_{name}` | Date, subject, message required; accepts .pdf .doc .docx .jpg .jpeg .png | E11 | 📎 📅 | MEDIUM | NDC (document picker) |
| E13 | Leave detail | E11 → view | Status, message, attachment preview/download | same | — | — | Storage URL | DOM-built image preview | E11 | 📎 | EASY | NDC (viewer) |
| E14 | Payroll history | `/employeeLayout/Payroll` | Monthly salary, bonus, tax %, status, proof document; month filter | `Employee/pages/PayrollHistory.jsx`, `PdfPreviewModal` | R `employees/{id}`; R own `payroll/{id}/monthwise/*` (allowed by hardened rules) | — | Storage `proofs/…` (PDF iframe or download) | — | W10 | 📎 📅 | MEDIUM | NDC (PDF) |
| E15 | Feedback (list, submit, detail) | `/employeeLayout/EmployeeFeedback` | Submit feedback about a client/project; see own | `Employee/pages/EmployeeFeedback.jsx` | RT `feedback where employeeId==uid`; RT **all** `projects`; RT **all** `clients` | C `feedback` {employeeId, employeeName, project, client, description, date, createdAt} | — | All fields required | W12 | 📅 | EASY | STD |
| E16 | Profile & logout | S6/S7 | | | | | | | | 📎 | EASY | NDC |

(E16 is the shared profile and is not counted separately; Staff total = 15.)

Unreachable for employees today and **not** to be ported: Attendance-page Clock In/Out/Scan QR buttons and `QRCodeModal`
(`EmployeeAttendance.jsx` returns no actions when `isHistoryOnly`).

---

## 4. ADMIN (24)

Navigation today: HR Manager (Employees, Attendance, Leave Management, Payroll) · Project Manager (Projects, Project Tasks,
Assets, Documents) · Feedback (Feedbacks, Client Feedback, Employee Feedback) · Location (Location, Client Locations,
Employee Locations) · Clients · Calendar · Profile.

| # | Screen / feature | Web route | Purpose / entry | Components · hooks | Firestore reads | Firestore writes | Storage / API | Business rules / validation | Depends on | Flags | Cx | Type |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| A1 | Employees list | `/adminLayout/employees` (landing) | All employees, search, paging | `Admin/pages/Employees.jsx` (tabs) → `AllEmployees.jsx` | R all `employees` | — | — | — | — | — | EASY | STD |
| A2 | Create employee | A1 → "Create New Employee" | Create login + profile | `AllEmployees.jsx` (`EmployeeForm`), `AddressField` | — | (backend writes `employees/{uid}`) | **API `POST /create-user`** {email,password,userType:"Employee",additionalData{address,dob,name,phoneNumber,userType,jobTitle,drivingLicense,maxWorkingHrs,qualifications}} | name, email, dob, phone, address, password ≥6, confirm | backend | 📍 🌐 | MEDIUM | STD |
| A3 | View / edit employee | A1 → eye / pencil | Details incl. HR fields and free-form extra fields | `AllEmployees.jsx` (`ViewEmployeeDetails`, `EmployeeForm`) | — | U `employees/{id}` {…form, extraFieldsObject} | — | Email read-only on edit | A1 | — | MEDIUM | STD |
| A4 | Delete employee | A1 → trash | Remove login + profile | `AllEmployees.jsx` | — | (backend deletes `employees where uid==`) | **API `DELETE /delete-user`** {uid,userRef:"employees"} | Confirm dialog; attendance/payroll/leaves are not deleted | backend | — | EASY | STD |
| A5 | Attendance (all) | `/adminLayout/Attendance` | All attendance; today's Approved/Pending/Rejected and present/absent stats; filters by employee/project/status/date | `AllAttendance.jsx`, `FilterDropdown`, `DateFilter`, `ReusableTable` | RT **all** `attendance`; RT all `projects`; R all `employees` | — | — | — | W6 | 📅 📍 | HARD | STD (cards) |
| A6 | Approve / reject attendance | A5 row action | Set status | `AllAttendance.jsx` | — | U `attendance/{id}` {AttendanceStatus, updatedAt} | — | Confirm | A5 | — | EASY | STD |
| A7 | Edit attendance | A5 row action | Correct clock-in/out date+time and worked time, add note | `AllAttendance.jsx` | — | U `attendance/{id}` {clockInDate, clockInTime, clockOutDate, clockOutTime, workedMinutes, workedHoursLabel, adminEditNote, adminEditedAt, adminEditedBy} | — | Worked minutes entered manually (0–59) | A5 | 📅 | MEDIUM | MSI (date/time pickers) |
| A8 | Delete attendance (audited) | A5 row action | Remove a record with reason | `AllAttendance.jsx` | — | C `attendanceAuditLogs` {action, reason, attendanceId, recordSnapshot, deletedAt, deletedBy, deletedByName}; D `attendance/{id}` | — | Optional reason | A5 | — | EASY | STD |
| A9 | Visit checklist + photo viewer | A5 row actions | See checklist results and clock-out images (carousel) | `VisitChecklistView`, `AllAttendance.jsx` | (from A5) | — | Storage URLs | — | A5 | 📎 | MEDIUM | MSI (gallery) |
| A10 | Leave management | `/adminLayout/LeaveManagement` | All leaves; filter by employee/status/date; detail with attachments; Approve/Reject | `AdminLeaveManagement.jsx` | R all `employees`; R all `leaves` | U `leaves/{id}` {status, updatedAt} | Storage URLs | — | W9 | 📎 📅 | MEDIUM | STD |
| A11 | Payroll | `/adminLayout/Payroll` | Per-month table of all employees: salary, bonus, tax %, status; totals; edit inline; mark all paid/pending; delete month row | `AdminPayroll.jsx` | R all `employees`; R `payroll/{emp}/monthwise/{month}` per employee | **C** missing month docs on view (salary 0); U `payroll/…` {salary,bonus,tax,status,timestamp}; U `employees/{id}` {salary[,bonus,tax]}; D month doc | — | Last 12 months selectable; paid months only update employee defaults; on the 1st, carry-over logic | W10 | 📅 | HARD | MSI |
| A12 | Payroll proof upload / preview | A11 row action | Attach payslip/report; preview PDF or download | `AdminPayroll.jsx`, `PdfPreviewModal` | — | U `payroll/…` {proof, proofFileName, proofFileType} | Storage `proofs/{empId}_{month}_{ts}.{ext}` | — | A11 | 📎 | MEDIUM | NDC |
| A13 | Projects list | `/adminLayout/projects` | All projects; Total/Active/Deactive tabs; search; date-overlap filter; status change (OnGoing/OnHold/Done); delete | `Admin/pages/Projects.jsx`, `ProjectTable.jsx` | RT all `projects`; R all `clients`; R all `assets` | U `projects/{id}.status`; D `projects/{id}` + U `assets` (release qty) | — | Delete confirm restores asset counts | W3 | 📅 | MEDIUM | STD |
| A14 | Create project wizard | A13 → "Create a New Project" | Step 1 details (type, client, address+coords, name, description, colour, team multi-select, assets + qty); Step 2 events (recurrence); Step 3 timeline (start/end, max working hours, working days, frequency); Step 4 QR (download/share) | `ProjectForm.jsx`, `Components/ProjectDetails`, `EventsForm`, `TimelineForm`, `RecurrenceFields`, `QRCodeDisplay`, `StepDots` | R all `employees`, all `assets`, `assets where name==` | C `projects` {…form, events[], createdAt ISO, userId, owner, clientName, clientId, assignedEmployee[], status:"OnGoing"}; U `assets` {assetsInUse, assetsPending} | QR → `{VITE_PROJECT_URL}project/{id}` | Step 1 all required incl. ≥1 asset and team; events optional (incomplete dropped); step 3 required | A13 | 📍 📅 🌐 📎(QR export) | HARD | CPX |
| A15 | Edit project wizard | A13 → edit | Same steps, recomputes asset diffs | `ProjectEditor.jsx` (1483 lines) | R `projects/{id}`, `clients`, `employees`, `assets` | U `projects/{id}`; U `assets` (difference) | — | Start ≤ end validation | A13 | 📍 📅 | HARD | CPX |
| A16 | Project details viewer | A13 → eye | Same as C2 for admin | `ProjectDetailViewer.jsx` | as C2 | — | — | — | A13 | 📎 📅 | MEDIUM | STD |
| A17 | Project tasks (checklist template) | A13 → "Tasks" | Add / edit / change responsible / delete project tasks; rich-text description; warns if employee not on team | `ProjectChecklistModal.jsx`, `RichTextEditor` | RT `projects/{id}`; R all `employees` | U `projects/{id}.tasks` | — | Name + responsible required; tasks = clock-out checklist | W5 | — | HARD | CPX (rich text) |
| A18 | Project Tasks page | `/adminLayout/AssignTasks` | Month overview of projects with task/employee counts; all-tasks table with filters; add task; change status; change responsible; view details | `AssignTasks.jsx`, `ProjectTasksOverview.jsx`, `ProjectTaskAssignment.jsx`, `RichTextEditor` | RT all `projects`; R all `employees` | U `projects/{id}.tasks` | — | Project, employee, description required | W5 | 📅 | HARD | CPX |
| A19 | Assets | `/adminLayout/Assets` | Inventory: name, quantity, in use, pending; create/edit/delete | `AssetManagement.jsx` | RT all `assets` | C/U/D `assets` | — | Quantity numeric; pending defaults to quantity | W3 | — | EASY | STD |
| A20 | Client documents | `/adminLayout/Documents` | Upload documents to a client (multi-file, title each), filter by client/date/type, preview, replace file/title, delete | `AdminDocumentsManagement.jsx` | R all `clients` (documents arrays) | U `clients/{uid}.documents` (arrayUnion/arrayRemove) | Storage `documents/{clientUid}/{ts}_{name}` upload/delete; accepts pdf, xlsx, xls, jpg, jpeg, png, gif | Title required per file | W11 | 📎 📅 | HARD | NDC |
| A21 | Feedback (employee + client tabs) | `/adminLayout/Feedbacks`, `EmployeeFeedback`, `ClientFeedback` | Lists with filters by project/client/employee; view; delete | `Feedbacks.jsx`, `Admin/pages/EmployeeFeedback.jsx`, `Admin/pages/ClientFeedback.jsx` | RT all `feedback`, all `clientFeedback`, all `projects`, `employees`, `clients` | D `feedback/{id}`, D `clientFeedback/{id}` | image URL | — | W12 | 📎 | EASY | STD |
| A22 | Locations map (employees / clients) | `/adminLayout/Location`, `EmployeesLocations`, `ClientsLocations` | Map of home/billing addresses with list and detail modal | `Locations.jsx`, `EmployeeClientLocations.jsx` (react-leaflet) | R all `employees` or `clients` | — | 🌐 Nominatim geocoding for missing coordinates, OSM tiles | Addresses, **not** live tracking | — | 📍 🌐 | HARD | NDC (maps) |
| A23 | Clients | `/adminLayout/Clients` | List; create (backend); view; edit (name, customerType, city, postcode, contactPartner, address, extra fields; email read-only); delete | `Customers.jsx`, `ClientCreateModal`, `CustomerViewModal`, `CustomerEditModal`, `AddressField` | R all `clients` | U `clients/{id}`; **D `clients/{id}` (Auth user not deleted)** | **API `POST /create-user`** {userType:"Client", additionalData{address,coordinates,dob,name,phoneNumber,userType}} | password ≥6 + confirm | backend | 📍 🌐 | MEDIUM | STD |
| A24 | Calendar + scheduling | `/adminLayout/Calendar` | All projects' recurring visits; search; day sheet; job detail with every employee's attendance, checklist, photos, signature; **Create Event**; **Edit Schedule** / delete event | Same calendar shell as E4 + `Calendar/Component/CreateEvent`, `RecurrenceFields`, MUI date pickers | R all `projects`; RT `attendance where clockInDate in [month range]` | U `projects/{id}.events` (arrayUnion new event {id, eventName, projectName, projectColor, frequency, startDate, endDate, weekdays, dayOfMonth, recurrenceMonth, status, createdAt, updatedAt}; map-replace on edit; filter on delete) | — | Weekly needs exactly 1 weekday; Twice a week exactly 2; end ≥ start | W4 | 📅 | HARD | CPX |
| A25 | Profile & logout | S6/S7 | | | | | | | | 📎 | EASY | NDC |

(A25 is the shared profile; Admin total counted as A1–A24 = 24.)

---

## 5. Cross-role workflows (13)

Each step: USER ACTION → UI → frontend logic → Firebase/API → mutation → event → effect on others → resulting UI.

### W1 Account provisioning
- **Admin creates Employee/Client** → A2/A23 form → validation → `POST /create-user` → backend `auth.createUser` + `set {collection}/{uid}` (+ `createdAt`) → no event → new user can log in → list refreshes.
- **Self sign-up** → S2 → validation → `createUserWithEmailAndPassword` + `setDoc` from the browser → no approval, no email → Firebase signs the user in at once; `AuthContext` may look up the profile before `setDoc` finishes (race), in which case the user lands on Login and signs in again → role home (Client or **Employee**).
- Side effects: none on other users; Admin sees the new person next time A1/A23 loads.

### W2 Login and role routing
Login → S1 → Auth → AuthContext queries role collections → `currentUser.userType` → role home. Profile doc listener keeps avatar live.

### W3 Project setup (Admin → Staff, Client)
Admin A14 → wizard → asset availability check → `assets where name==` reads → `addDoc(projects)` + `updateDoc(assets)` per asset →
no notification → **Staff** in `assignedEmployee[]` see the project's events on their Calendar (E4) and can clock in; **Client** sees it in Projects (C1) →
QR step shows a link to the public page.

### W4 Scheduling recurring visits (Admin → Staff)
Admin A24 "Create Event" or wizard step 2 → recurrence validation → `projects/{id}.events` arrayUnion → no notification →
Staff calendar recomputes instances (E4/E5) → Admin calendar shows dots. Edit/delete rewrites the array.

### W5 Task / checklist templates (Admin → Staff, Client)
Admin A17/A18 → add task (subject, rich-text description, responsible employee) → `projects/{id}.tasks` rewrite →
Staff see it in Tasks (E1) and as a checklist line at clock-out (E8); Client sees it in project tasks (C3).
Staff "Mark completed" (E3) or checklist Completed (E8) sets `EmployeeTaskStatus` → Admin sees it in A18.

### W6 Visit execution (Staff → Client, Admin) — the core workflow
1. Staff E4 Calendar → E5 day → E6 job → **Clock In** (E7) → confirm → open-session/today checks → device location → Nominatim geocode → distance → `addDoc(attendance)` (`AttendanceStatus:"pending"`).
2. Optional **customer signature** (E9) → PNG → Storage → `updateDoc(attendance)`.
3. **Clock Out** (E8) → checklist + photos → Storage uploads → `updateDoc(attendance)` (times, worked minutes, checklist snapshot, photos, clientId) → `updateDoc(projects.tasks)` (completed tasks) → duplicate-guard query → `addDoc(notifications {type:"visit_completed"})` → `updateDoc(attendance.customerNotifiedAt)`.
4. Effects: **Client** gets the unread dot (RT listener) and the visit in Job History (C4/C5) with checklist, photos, signature. **Admin** sees the record in Attendance (A5) and the Calendar job detail (A24) with "Out of range" flag if distance > 2 km.
5. If staff never clock out: **backend auto clock-out** (W7).

### W7 Auto clock-out (Backend → Staff, Admin)
`setInterval` 15 min (or `POST /cron/auto-clockout`) → scans **all** attendance → for open sessions older than project `maxWorkingHours` (default 8) → sets clock-out at clock-in + max hours, `autoClockOut:true` → Staff/Admin see "Auto closed". No checklist and **no client notification** are produced.

### W8 Attendance review (Admin → Staff)
Admin A6/A7/A8 → approve/reject/edit/delete (with audit log) → Staff E10 shows the new status (RT) and Admin stats update. No notification to staff.

### W9 Leave (Staff → Admin → Staff)
Staff E12 → upload attachments → `addDoc(leaves)` → Admin A10 (loads on page open, not RT) → Approve/Reject → `updateDoc(leaves)` → Staff E11 sees status on next load. No notification.

### W10 Payroll (Admin → Staff)
Admin A11 opens a month → missing month docs auto-created → edits salary/bonus/tax/status → uploads proof (A12) → Staff E14 sees the month and proof. No notification.

### W11 Client documents (Admin → Client)
Admin A20 → upload files → Storage → `clients/{uid}.documents` arrayUnion → Client C10 sees them on next load. Replace/delete update Storage and the array. No notification.

### W12 Feedback (Client/Staff → Admin)
Client C8 → `clientFeedback` (+ optional image) / Staff E15 → `feedback` → Admin A21 (RT) can view and delete. No reply path back to the author.

### W13 User removal (Admin → Employee/Client)
Employee: A4 → backend deletes Auth user and profile; their attendance, leaves and payroll remain.
Client: A23 delete → only the Firestore profile is deleted; the Auth login remains, projects keep `clientId`.

Also cross-role but minor: profile photo (S6) appears in the header and wherever the profile is shown; project QR (A14) opens the public page (S8).
