# Dead Code Analysis Report

**Project:** record-app
**Date:** 2026-02-16
**Analyzer:** Claude Opus 4.6 (manual analysis with depcheck)
**Note:** Gemini agent unavailable (429 rate limit), analysis performed directly by Claude Opus

---

## Summary

| Category | Count |
|----------|-------|
| Unused Exports | 3 |
| Unused Files | 0 |
| Unused Dependencies | 0 (all used, but see notes) |
| Duplicate Code | 2 patterns |
| Unreachable Code | 0 |
| Orphan Test Files | 0 |
| API Route Inconsistency (Bug) | 1 |

---

## 1. DEAD_CODE: Unused Exports

### 1.1 `isGeminiAvailable()` in `lib/gemini.js` (line 109)

- **Category:** SAFE
- **Reason:** Exported but never imported anywhere. Only `isGeminiAvailableAsync()` (line 118) and `transcribeAudio()` / `generateProposals()` are used.
- **Callers of async version:** `app/api/health/route.js`
- **Callers of sync version:** NONE
- **Recommendation:** Remove `isGeminiAvailable()`. The async version `isGeminiAvailableAsync()` provides a superset of functionality (checks both env var and DB).

### 1.2 `STT_MAX_ATTEMPTS` in `lib/constants.js` (line 65)

- **Category:** SAFE
- **Reason:** Exported constant `STT_MAX_ATTEMPTS = 3` is defined but never imported anywhere in the codebase. No file references this constant.
- **Recommendation:** Remove. If retry logic is added later, it can be re-introduced.

### 1.3 `getCurrentWeekKey()` in `lib/validators.js` (line 193)

- **Category:** SAFE
- **Reason:** Exported function but never imported anywhere outside `lib/validators.js` itself. Not used by any service, API route, or test.
- **Recommendation:** Remove. Week key generation is not used by any feature currently.

---

## 2. DUPLICATES: Duplicate / Overlapping Code

### 2.1 Error Handling Duplication: `lib/errors.js` `errorResponse()` vs `lib/middleware.js` `handleApiError()`

- **Category:** CAUTION
- **Files:**
  - `lib/errors.js` lines 49-80: `errorResponse(error)`
  - `lib/middleware.js` lines 148-177: `handleApiError(error)`
- **Analysis:** Both functions perform nearly identical logic:
  - Check for `AppError` and return appropriate status code
  - Handle Prisma error codes `P2002` (conflict) and `P2025` (not found)
  - Return generic 500 for unknown errors
- **Difference:** `handleApiError` wraps in `{ success: false, error: ... }` envelope, while `errorResponse` uses `{ error: ... }` without `success` field.
- **Usage:**
  - `handleApiError`: Used internally by `withApi` middleware (all routes using `withApi`)
  - `errorResponse`: Used only by `app/api/segments/[id]/route.js` (which does NOT use `withApi`)
- **Recommendation:** Migrate `app/api/segments/[id]/route.js` to use `withApi` middleware, then remove `errorResponse()` from `lib/errors.js`. This would also fix the API inconsistency noted in section 5.

### 2.2 Segment Listing Duplication: `app/api/transcribe/route.js` GET vs `app/api/segments/route.js` GET

- **Category:** CAUTION
- **Files:**
  - `app/api/transcribe/route.js` lines 86-103: GET handler lists segments
  - `app/api/segments/route.js`: GET handler lists segments via `listSegments()` service
- **Analysis:** Both endpoints return segment lists filtered by userId and optionally by sessionId. The transcribe route duplicates the segment listing inline rather than delegating to the segment service.
- **Recommendation:** Consider removing the GET from `transcribe/route.js` since it duplicates `segments/route.js`. The entire transcribe endpoint is marked as deprecated (line 17).

---

## 3. UNUSED_DEPS: Dependency Analysis

### 3.1 All dependencies are technically used

depcheck reports all dependencies as used. However, the following deserve attention:

| Package | Used In | Notes |
|---------|---------|-------|
| `@supabase/supabase-js` | `lib/supabase.js` | Only used by `lib/middleware.js` for JWT auth. If `DEV_AUTH_BYPASS=true` or Supabase not configured, this package is never exercised at runtime. Needed for production auth. |
| `@upstash/ratelimit` | `lib/rate-limit.js` | Dynamic import. If `UPSTASH_REDIS_REST_URL` not set, package is never loaded. Needed for production rate limiting. |
| `@upstash/redis` | `lib/rate-limit.js` | Same as above. |
| `dotenv` | `vitest.setup.js` | devDependency, used only in test setup. Correct placement. |

**Recommendation:** No dependencies to remove. All are legitimately used or planned for production.

---

## 4. CONSOLIDATION: API Route Inconsistency

### 4.1 `app/api/segments/[id]/route.js` does NOT use `withApi` middleware

- **Category:** DANGER (potential bug)
- **Analysis:** This is the ONLY API route that does not use the `withApi` middleware. Instead, it:
  - Manually checks `if (!prisma)` (lines 16-21, 39-44)
  - Uses `errorResponse()` instead of the middleware's `handleApiError()`
  - Does NOT perform authentication (no userId extraction)
  - Does NOT perform rate limiting
  - Calls `getSegment(id)` with only 1 argument, but the service expects `getSegment(userId, id)` with 2 arguments
  - Calls `updateSegmentSttStatus(id, { sttStatus, text })` with 2 arguments, but the service expects `updateSegmentSttStatus(userId, id, { sttStatus, text })` with 3 arguments
- **Impact:** This route is essentially broken -- it passes `id` as `userId` to the service, causing incorrect behavior. Additionally, it has no authentication, so anyone can access/modify segments.
- **Recommendation:** Rewrite to use `withApi` middleware and fix the argument mismatch. This is a bug fix, not dead code removal.

---

## 5. Additional Findings

### 5.1 `scripts/migrate-user-ids.mjs` - One-time Migration Script

- **Category:** SAFE
- **Analysis:** Standalone script for migrating mock-user-001 to Supabase Auth UUID. Not imported by any other file. Intended as a one-time migration tool.
- **Recommendation:** Keep for now (needed when Supabase Auth is implemented per Issue #4). Can be removed after migration is complete.

### 5.2 `MOCK_USER_ID` defined in two places

- **Category:** CAUTION
- **Files:**
  - `lib/constants.js` line 6: `export const MOCK_USER_ID = 'mock-user-001'`
  - `lib/middleware.js` line 15: `const MOCK_DEV_USER_ID = 'mock-user-001'`
- **Analysis:** The `MOCK_USER_ID` exported from `lib/constants.js` is NOT imported by any file. `lib/middleware.js` defines its own local `MOCK_DEV_USER_ID` with the same value.
- **Recommendation:** Either import from `lib/constants.js` in middleware, or remove the export from `lib/constants.js` if it's only documented for reference.

### 5.3 `NODE_TYPE` and `RULE_TREE_MAX_DEPTH` exports from `lib/constants.js`

- **Category:** SAFE (internal use only)
- **Analysis:** Both are exported from `lib/constants.js` but only imported by `lib/validators.js`. No other file uses them directly.
- **Recommendation:** These are legitimately used by validators. No action needed.

---

## 6. Categorized Deletion Candidates

### SAFE (Low Risk - Can Delete)

| Item | File | Line(s) | Type | Reason |
|------|------|---------|------|--------|
| `isGeminiAvailable()` | `lib/gemini.js` | 108-111 | Unused Export | Never imported; async version is used instead |
| `STT_MAX_ATTEMPTS` | `lib/constants.js` | 65 | Unused Export | Never imported anywhere |
| `getCurrentWeekKey()` | `lib/validators.js` | 193-200 | Unused Export | Never imported anywhere |
| `MOCK_USER_ID` | `lib/constants.js` | 6 | Unused Export | Never imported; middleware defines its own copy |

**Estimated impact:** 4 exports removed, ~20 lines removed, 0 files deleted.

### CAUTION (Medium Risk - Needs Careful Review)

| Item | File | Type | Reason |
|------|------|------|--------|
| `errorResponse()` | `lib/errors.js` | Duplicate Function | Only used by 1 route that should use `withApi` instead |
| GET handler in transcribe | `app/api/transcribe/route.js` | Duplicate Endpoint | Duplicates `segments/route.js`; entire endpoint is deprecated |

**Note:** These require code changes beyond simple deletion (route migration to `withApi`, endpoint deprecation).

### DANGER (High Risk - Do Not Delete Without Further Analysis)

| Item | File | Type | Reason |
|------|------|------|--------|
| `app/api/segments/[id]/route.js` | API Route | Bug/Inconsistency | Does not use middleware; has argument mismatch bug. Needs rewrite, not deletion. |

---

## 7. Test Coverage Notes

All test files have corresponding implementation targets:

| Test File | Tests For | Status |
|-----------|-----------|--------|
| `__tests__/api/sessions.test.js` | `app/api/sessions/` routes | Valid |
| `__tests__/api/transcribe.test.js` | `app/api/transcribe/route.js` | Valid |
| `__tests__/lib/authorization.test.js` | Service-level userId isolation | Valid |
| `__tests__/lib/crypto.test.js` | `lib/crypto.js` | Valid |
| `__tests__/lib/middleware.test.js` | `lib/middleware.js` | Valid |
| `__tests__/lib/validators.test.js` | `lib/validators.js` | Valid |
| `__tests__/services/rule-tree-service.test.js` | `lib/services/rule-tree-service.js` | Valid |
| `__tests__/integration/api-routes.test.js` | Integration tests | Valid |
| `__tests__/integration/service-lifecycle.test.js` | Integration tests | Valid |

No orphan test files detected.

---

## 8. Verification Commands

To verify these findings independently:

```bash
# Check isGeminiAvailable usage (should only show definition)
grep -rn "isGeminiAvailable[^A]" --include="*.js" --include="*.mjs" .

# Check STT_MAX_ATTEMPTS usage (should only show definition)
grep -rn "STT_MAX_ATTEMPTS" --include="*.js" --include="*.mjs" .

# Check getCurrentWeekKey usage (should only show definition)
grep -rn "getCurrentWeekKey" --include="*.js" --include="*.mjs" .

# Check MOCK_USER_ID import usage (should be 0 imports)
grep -rn "import.*MOCK_USER_ID" --include="*.js" --include="*.mjs" .

# Check errorResponse usage (should only be segments/[id])
grep -rn "errorResponse" --include="*.js" --include="*.mjs" .
```

---

## 9. Next Steps

1. **Immediate (SAFE):** Remove 4 unused exports listed in Section 6 SAFE category
2. **Short-term (CAUTION):** Migrate `segments/[id]/route.js` to use `withApi` middleware, fixing the authentication and argument mismatch bugs
3. **Medium-term (CAUTION):** Remove duplicate `errorResponse()` after route migration
4. **Evaluate:** Whether the deprecated `GET /api/transcribe` endpoint should be removed in favor of `GET /api/segments`
