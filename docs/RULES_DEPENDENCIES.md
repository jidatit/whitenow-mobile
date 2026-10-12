# Firestore rules dependencies — role resolution

The mobile role resolver (`src/auth/resolveRole.ts`) relies on the behaviour below of the
**published** Firestore rules for project `white-now-erp`. If those rules change, re-check this
note and the resolver tests before releasing.

## Published ruleset

| Item | Value |
|---|---|
| Release | `projects/white-now-erp/releases/cloud.firestore` (default database; no named databases) |
| Active ruleset | `b35bcf47-5de3-4eb9-9445-c1fd4b20174c` |
| Ruleset created / release updated | 2026-10-09 22:17:25Z / 2026-10-09 22:17:26Z |
| `firestore.rules` SHA-256 | `7e8ff2d72354b49d1a392a0c9515d3410d4f5100d2c5818c5acdb26fcf294fbf` |
| Retrieved | 2026-10-12, read-only via the Firebase Rules API (`releases.list`, `rulesets.get`) |

The full rule text is not stored in this repository. Note: the published file still opens with a
`// PROPOSAL ONLY - not deployed` comment; that comment is out of date — this ruleset is the live one.

## Rule excerpts the resolver depends on

```
function signedIn() { return request.auth != null; }
function roleDoc(col) { return /databases/$(database)/documents/$(col)/$(request.auth.uid); }

function isAdmin()    { return signedIn() && exists(roleDoc('admins'))
                          && get(roleDoc('admins')).data.userType == 'Admin'; }
function isEmployee() { return signedIn() && exists(roleDoc('employees'))
                          && get(roleDoc('employees')).data.userType == 'Employee'; }
function isClient()   { return signedIn() && exists(roleDoc('clients'))
                          && get(roleDoc('clients')).data.userType == 'Client'; }

function isOwnRoleDoc(userId) {
  return signedIn() && (request.auth.uid == userId || resource.data.uid == request.auth.uid);
}

match /admins/{userId}            { allow read: if isAdmin() || isOwnRoleDoc(userId); }
match /employees/{userId}         { allow read: if isAdmin() || isOwnRoleDoc(userId); }
match /clients/{userId}           { allow read: if isAdmin() || isEmployee() || isOwnRoleDoc(userId); }
match /employeeDirectory/{userId} { allow read: if signedIn(); }
```

(Write rules omitted.) There are no global read conditions: no email-verification, custom-claim or
time-based checks. The catch-all `match /{document=**}` only adds Admin access.

## Behaviour the resolver relies on

1. **Roles are defined by document id.** A user is Admin/Employee/Client when
   `<collection>/{auth uid}` exists with `userType` `'Admin'`/`'Employee'`/`'Client'`.
   The resolver therefore reads `admins/{uid}`, `employees/{uid}`, `clients/{uid}` by id (in that
   precedence order) and never uses collection queries.
2. **Own role documents are always readable when signed in.** For `getDoc(<col>/{auth uid})`,
   `request.auth.uid == userId` is true, so the read is allowed whether or not the document
   exists (`||` short-circuits before `resource.data` is used). An empty snapshot is therefore
   a genuine "absent", and the resolver moves to the next role only in that case.
3. **`permission-denied` is never "not this role".** Under this ruleset it can only mean there
   was no authenticated user on the request (signed out, token missing/expired) or a cause outside
   the rules (App Check enforcement, which the Rules API does not show; wrong project/database in
   the app config). The resolver returns `error: permission` and stops.
4. **`userType` must match the collection**, because the role helpers require it. A document with
   a missing or different `userType` grants no role, so the resolver returns `profile-invalid`
   instead of falling through to a lower role.
5. **`uid` is optional.** The rules accept either the document id or a matching `uid` field for
   own-document reads, and do not require `uid` to exist. The backend (`/create-user`) and web
   signup always write `uid`; Admin documents are created by hand. The resolver accepts a profile
   without `uid`, but if `uid` is present it must be a string equal to the document id; otherwise
   it returns `profile-invalid`.
6. **Reads come from the server** (`getDocFromServer`), so an offline device yields `unavailable`
   (network error) rather than a cached "absent".
7. **`employeeDirectory/{uid}`** (staff names only) is readable by any signed-in user; it is not
   read by the resolver but is available for the profile header afterwards.

## Not covered by this note

- App Check enforcement status (Console setting, not part of the ruleset).
- Storage rules (ruleset `a71f88d9-92a1-4516-b7c7-eaf0d2a68f40`, published 2026-10-09 22:19:47Z);
  they matter for upload features in later phases.
