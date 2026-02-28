# Second Circuit Profiles — API Documentation

Base URL: `http(s)://<host>/api`

All responses are `application/json`. Dates are ISO 8601 strings in UTC (e.g. `"2024-03-15T10:30:00Z"`). IDs are MongoDB ObjectId strings (24-character hex).

---

## Table of Contents

- [Authentication](#authentication)
- [Authorization & Roles](#authorization--roles)
- [Common Types](#common-types)
- [Endpoints](#endpoints)
  - [Auth](#auth)
  - [Users](#users)
  - [User Settings](#user-settings)
  - [Skills](#skills)
  - [LLM Providers](#llm-providers)
  - [Companions](#companions)
  - [Images](#images)
  - [Stats](#stats)
  - [Admin](#admin)
- [Error Handling](#error-handling)

---

## Authentication

The API uses **JWT Bearer tokens** obtained via the Discord OAuth2 flow.

Include the token in every protected request:

```
Authorization: Bearer <token>
```

Tokens are valid for **24 hours**.

### Login Flow

1. Call `GET /api/auth/config` to get the Discord authorization URL.
2. Redirect the user to that URL.
3. Discord redirects back to your app with a `?code=...` query parameter.
4. Call `POST /api/auth/callback` with that code to receive a JWT token.

**Important:** The user must be a member of the configured Discord server. Non-members receive `403`.

---

## Authorization & Roles

| Role | How it is determined |
|---|---|
| **Anonymous** | No `Authorization` header |
| **Member** | Valid JWT, any user |
| **Owner** | Valid JWT, and the `slug` in the JWT matches the resource slug |
| **Admin** | Valid JWT with `is_admin: true` — set automatically based on Discord server administrator permissions |

---

## Common Types

### Visibility (enum)

Controls who can see a resource.

| Value | Integer | Who can see it |
|---|---|---|
| `Private` | `0` | Owner and admins only |
| `MembersOnly` | `1` | Any authenticated member, owner, and admins |
| `Public` | `2` | Everyone (including unauthenticated) |

In JSON, visibility is serialized as an **integer**.

### Alignment (enum)

D&D-style alignment. Serialized as an **integer**.

| Value | Integer |
|---|---|
| `LawfulGood` | `0` |
| `NeutralGood` | `1` |
| `ChaoticGood` | `2` |
| `LawfulNeutral` | `3` |
| `TrueNeutral` | `4` |
| `ChaoticNeutral` | `5` |
| `LawfulEvil` | `6` |
| `NeutralEvil` | `7` |
| `ChaoticEvil` | `8` |

Optional field on both users and companions. `null` means not set.

### ExperienceLevel (enum)

Used for LLM experience. Serialized as an **integer**.

| Value | Integer |
|---|---|
| `NoExperience` | `0` |
| `Beginner` | `1` |
| `Advanced` | `2` |
| `Expert` | `3` |

### PaginatedResponse\<T\>

```json
{
  "items": [ /* array of T */ ],
  "page": 1,
  "pageSize": 12,
  "totalCount": 42,
  "totalPages": 4,
  "seed": 1234567
}
```

`seed` is used for deterministic random pagination — pass it back on subsequent page requests to get a stable order. For non-random sort orders, `seed` is still returned but is not required for stable ordering.

### ErrorResponse

```json
{
  "error": "Human-readable error message."
}
```

---

## Endpoints

---

### Auth

#### `GET /api/auth/config`

Returns Discord OAuth2 configuration and the ready-to-use authorization URL.

**Auth:** None required.

**Query Parameters:**

| Name | Type | Description |
|---|---|---|
| `redirectUri` | string | Optional. Override the configured redirect URI. |

**Response `200`:**

```json
{
  "clientId": "123456789",
  "redirectUri": "https://yourapp.com/callback",
  "authorizationUrl": "https://discord.com/api/oauth2/authorize?client_id=...&redirect_uri=...&response_type=code&scope=identify%20guilds"
}
```

---

#### `POST /api/auth/callback`

Exchanges a Discord OAuth2 authorization code for a JWT token. Creates the user account on first login. Updates Discord username and admin status on every subsequent login.

**Auth:** None required.

**Request body:**

```json
{
  "code": "discord_oauth2_code_from_redirect"
}
```

**Response `200`:**

```json
{
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": { /* UserResponse — see below */ }
}
```

**Response `400`:** Discord authentication failed.

**Response `403`:** User is not a member of the required Discord server.

---

#### `GET /api/auth/me`

Returns the currently authenticated user's profile.

**Auth:** Member required.

**Response `200`:** `UserResponse` (see [User object](#user-object)).

**Response `401`:** Missing or invalid token.

---

### Users

#### User object

```json
{
  "slug": "ab3x9k2m",
  "discordUsername": "username#0000",
  "visibility": 2,
  "locationVisibility": 1,
  "dateOfBirthVisibility": 1,
  "profileImageUrl": "abc123.jpg",
  "alternativeName": "Preferred Name",
  "dateOfBirth": "1990-06-15T00:00:00Z",
  "country": "Germany",
  "city": "Berlin",
  "bio": "A short bio.",
  "alignment": 2,
  "isOwnProfile": false,
  "isAdmin": false,
  "skills": [
    { "id": "664f1a2b3c4d5e6f7a8b9c0d", "name": "Backend Coding", "createdAt": "2024-01-01T00:00:00Z" }
  ],
  "llmExperiences": [
    { "llmProviderId": "664f...", "llmProviderName": "GPT-4", "experienceLevel": 2 }
  ],
  "companions": [ /* array of CompanionResponse */ ],
  "links": [
    { "id": "a1b2c3d4-...", "label": "Substack", "url": "https://example.substack.com" }
  ],
  "joinedAt": "2026-02-20T00:00:00Z",
  "createdAt": "2024-01-01T00:00:00Z",
  "updatedAt": "2024-03-15T10:30:00Z"
}
```

In the `auth/me` and `auth/callback` responses, `companions`, `skills`, and `llmExperiences` are always empty arrays. To get those, call `GET /api/users/{slug}` after login.

All optional fields (`alternativeName`, `dateOfBirth`, `country`, `city`, `bio`, `profileImageUrl`, `alignment`) are `null` when not set. `links` is an empty array when none have been added.

**Field-level visibility:** `dateOfBirth`, `country`, and `city` are filtered based on `dateOfBirthVisibility` and `locationVisibility` respectively. If the caller doesn't have sufficient visibility, these fields are returned as `null` even if set.

---

#### `GET /api/users`

Returns a paginated list of user profiles.

**Auth:** None required. Authenticated users see `MembersOnly` profiles as well. Admins see all profiles.

**Query Parameters:**

| Name | Type | Default | Description |
|---|---|---|---|
| `page` | integer | `1` | Page number (min: 1) |
| `pageSize` | integer | `12` | Items per page (min: 1, max: 50) |
| `seed` | integer | random | Seed for deterministic random ordering. **Pass the seed from the first response on all subsequent page calls** to maintain stable pagination. Only relevant when `sort=random`. |
| `search` | string | — | Free-text search across Discord username, alternative name, and companion names. Case-insensitive. |
| `sort` | string | `random` | Sort order. One of: `random`, `name_asc`, `name_desc`, `joined_desc`. |
| `hasProfileImage` | boolean | — | When `true`, only returns users who have a profile image set. |
| `skillIds` | string[] | — | Filter by skills (AND logic). Pass multiple times: `?skillIds=id1&skillIds=id2`. Only users who have **all** specified skills are returned. |
| `llmProviderId` | string | — | Filter by LLM provider ID. **Requires authentication.** |
| `minExperienceLevel` | integer | `1` | Minimum experience level when filtering by LLM (0–3). Defaults to `1` (Beginner) when `llmProviderId` is set. |

**Response `200`:** `PaginatedResponse<UserListItemResponse>`

```json
{
  "items": [
    {
      "slug": "ab3x9k2m",
      "displayName": "Preferred Name",
      "profileImageUrl": "abc123.jpg",
      "companionNames": ["Aria", "Nova"]
    }
  ],
  "page": 1,
  "pageSize": 12,
  "totalCount": 42,
  "totalPages": 4,
  "seed": 1234567
}
```

**Response `401`:** Returned when `llmProviderId` is provided without a valid token.

---

#### `GET /api/users/{slug}`

Returns a single user's full profile including companions.

**Auth:** None required, but visibility rules apply:
- `Private` profiles return `404` for non-owners and non-admins.
- `MembersOnly` profiles return `404` for unauthenticated users.

**Response `200`:** `UserResponse`

**Response `404`:** User not found or not visible.

---

#### `PUT /api/users/{slug}`

Updates a user's profile fields. Only sends the fields you want to change.

**Auth:** Owner or Admin.

**Request body** (all fields optional):

```json
{
  "visibility": 2,
  "locationVisibility": 1,
  "dateOfBirthVisibility": 0,
  "alternativeName": "New Name",
  "dateOfBirth": "1990-06-15T00:00:00Z",
  "country": "Germany",
  "city": "Berlin",
  "bio": "Updated bio.",
  "alignment": 2,
  "clearAlignment": false
}
```

To remove the alignment, send `"clearAlignment": true`. `null` for `alignment` means "don't change".

**Response `200`:** Updated `UserResponse`.

**Response `403`:** Authenticated, but not the owner or an admin.

**Response `404`:** User not found.

---

#### `PUT /api/users/{slug}/skills`

Replaces the user's skill list. Send an empty array to clear all skills.

**Auth:** Owner or Admin.

Admin edits are logged to the audit log.

**Request body:**

```json
{
  "skillIds": ["664f1a2b3c4d5e6f7a8b9c0d", "664f1a2b3c4d5e6f7a8b9c0e"]
}
```

**Response `200`:** Updated `UserResponse`.

**Response `400`:** One or more provided skill IDs do not exist.

**Response `403`:** Not the owner or an admin.

**Response `404`:** User not found.

---

#### `PUT /api/users/{slug}/llm-experiences`

Replaces the user's LLM experience list. Send an empty array to clear all entries. If the same `llmProviderId` appears multiple times, only the last entry is kept.

**Auth:** Owner or Admin.

Admin edits are logged to the audit log.

**Request body:**

```json
{
  "experiences": [
    { "llmProviderId": "664f1a2b3c4d5e6f7a8b9c0d", "experienceLevel": 2 },
    { "llmProviderId": "664f1a2b3c4d5e6f7a8b9c0e", "experienceLevel": 1 }
  ]
}
```

`experienceLevel` values: `0` = NoExperience, `1` = Beginner, `2` = Advanced, `3` = Expert.

**Response `200`:** Updated `UserResponse`.

**Response `400`:** One or more provided LLM provider IDs do not exist.

**Response `403`:** Not the owner or an admin.

**Response `404`:** User not found.

---

#### `POST /api/users/{slug}/image`

Uploads a profile image for the user. Replaces any existing image.

**Auth:** Owner or Admin.

**Request:** `multipart/form-data` with a `file` field.

Accepted formats: `.jpg`, `.jpeg`, `.png`, `.gif`, `.webp`. Max size: **5 MB**.

**Response `200`:**

```json
{
  "profileImageUrl": "generated-filename.jpg"
}
```

Use this filename value to construct the image URL via `GET /api/images/{filename}`.

**Response `400`:** Invalid file type or file too large.

**Response `403`:** Not the owner or an admin.

---

#### `DELETE /api/users/{slug}/image`

Removes the user's profile image.

**Auth:** Owner or Admin.

**Response `204`:** Image deleted.

**Response `403`:** Not the owner or an admin.

---

#### `PUT /api/users/{slug}/links`

Replaces the user's link list. Send an empty array to remove all links.

**Auth:** Owner or Admin.

**Request body:**

```json
{
  "links": [
    { "label": "Substack", "url": "https://example.substack.com" },
    { "label": "X / Twitter", "url": "https://x.com/example" }
  ]
}
```

| Field | Required | Constraints |
|---|---|---|
| `label` | No | Max 100 characters. Empty string is allowed. |
| `url` | Yes | Max 500 characters. |

Maximum **20 links** per user. Each link is assigned a new UUID on every PUT.

**Response `200`:** Updated `UserResponse`.

**Response `400`:** More than 20 links provided.

**Response `403`:** Not the owner or an admin.

**Response `404`:** User not found.

---

### User Settings

User settings are personal key/value pairs for frontend preferences. Only the owner can read and modify their own settings.

---

#### `GET /api/users/{slug}/settings`

Returns all settings for the user.

**Auth:** Owner only.

**Response `200`:**

```json
{
  "theme": "dark",
  "cardLayout": "grid"
}
```

**Response `403`:** Not the owner.

**Response `404`:** User not found.

---

#### `PATCH /api/users/{slug}/settings`

Merges the provided key/value pairs into the user's settings. Set a value to `null` to delete that key.

**Auth:** Owner only.

**Request body:**

```json
{
  "settings": {
    "theme": "dark",
    "someOldKey": null
  }
}
```

**Response `200`:** The complete updated settings object.

**Response `403`:** Not the owner.

**Response `404`:** User not found.

---

### Skills

Skills are labels that admins define (e.g. "Backend Coding", "Psychology"). Users then select which skills apply to their profile.

#### Skill object

```json
{
  "id": "664f1a2b3c4d5e6f7a8b9c0d",
  "name": "Backend Coding",
  "createdAt": "2024-01-01T00:00:00Z"
}
```

---

#### `GET /api/skills`

Returns all available skills, sorted alphabetically.

**Auth:** None required.

**Response `200`:** Array of Skill objects.

```json
[
  { "id": "664f...", "name": "Backend Coding", "createdAt": "2024-01-01T00:00:00Z" },
  { "id": "664f...", "name": "Frontend Coding", "createdAt": "2024-01-01T00:00:00Z" },
  { "id": "664f...", "name": "Psychology", "createdAt": "2024-01-01T00:00:00Z" }
]
```

---

#### `POST /api/skills`

Creates a new skill.

**Auth:** Admin only.

**Request body:**

```json
{
  "name": "Machine Learning"
}
```

`name` is required, max 100 characters.

**Response `201`:** The created Skill object.

**Response `409`:** A skill with that name already exists.

---

#### `DELETE /api/skills/{id}`

Deletes a skill by ID.

**Auth:** Admin only.

> **Note:** Deleting a skill does not automatically remove it from users who have it selected. The skill will silently disappear from their profile's skill list.

**Response `204`:** Deleted.

**Response `404`:** Skill not found.

---

### LLM Providers

Admins maintain a list of LLM providers/models (e.g. "GPT-4", "Claude", "Gemini"). Users can then indicate their experience level with each.

#### LLM Provider object

```json
{
  "id": "664f1a2b3c4d5e6f7a8b9c0d",
  "name": "GPT-4",
  "createdAt": "2024-01-01T00:00:00Z"
}
```

---

#### `GET /api/llm-providers`

Returns all available LLM providers, sorted alphabetically.

**Auth:** None required.

**Response `200`:** Array of LLM Provider objects.

---

#### `POST /api/llm-providers`

Creates a new LLM provider entry.

**Auth:** Admin only.

**Request body:**

```json
{
  "name": "Claude 3.5 Sonnet"
}
```

`name` is required, max 100 characters.

**Response `201`:** The created LLM Provider object.

**Response `409`:** A provider with that name already exists.

---

#### `DELETE /api/llm-providers/{id}`

Deletes an LLM provider by ID.

**Auth:** Admin only.

> **Note:** Deleting a provider does not automatically remove experience entries from users who referenced it.

**Response `204`:** Deleted.

**Response `404`:** Provider not found.

---

### Companions

Companions are secondary profiles (characters, personas) attached to a user account. They are created and managed by the user who owns them.

#### Companion object

```json
{
  "id": "664f1a2b3c4d5e6f7a8b9c0d",
  "visibility": 1,
  "profileImageUrl": "companion-abc.jpg",
  "name": "Aria",
  "platform": "Some Platform",
  "role": "Support",
  "dateOfBirth": "2050-01-01T00:00:00Z",
  "bio": "A helpful companion.",
  "alignment": 0,
  "createdAt": "2024-01-01T00:00:00Z",
  "updatedAt": "2024-03-15T10:30:00Z"
}
```

All optional fields are `null` when not set.

---

#### `GET /api/users/{slug}/companions`

Returns all visible companions for a user, in the user-defined order.

**Auth:** None required. Visibility rules apply (same as for user profiles).

**Response `200`:** Array of Companion objects.

**Response `404`:** User not found.

---

#### `GET /api/users/{slug}/companions/{id}`

Returns a single companion.

**Auth:** None required. Visibility rules apply.

**Response `200`:** Companion object.

**Response `404`:** User or companion not found, or not visible.

---

#### `PUT /api/users/{slug}/companions/order`

Sets the display order of companions. The companions are displayed in the given ID order for all viewers.

**Auth:** Owner only.

**Request body:**

```json
{
  "companionIds": ["id1", "id2", "id3"]
}
```

IDs not belonging to this user are silently ignored. Companions not listed keep their previous order values.

**Response `204`:** Order saved.

**Response `403`:** Not the owner.

**Response `404`:** User not found.

---

#### `POST /api/users/{slug}/companions`

Creates a new companion for the user.

**Auth:** Owner only (admins cannot create companions on behalf of users).

**Request body:**

```json
{
  "visibility": 0,
  "name": "Nova",
  "platform": "Some Platform",
  "role": "Scout",
  "dateOfBirth": "2045-06-01T00:00:00Z",
  "bio": "A fast companion.",
  "alignment": 5
}
```

| Field | Required | Default |
|---|---|---|
| `name` | Yes | — |
| `visibility` | No | `0` (Private) |
| `platform` | No | `null` |
| `role` | No | `null` |
| `dateOfBirth` | No | `null` |
| `bio` | No | `null` |
| `alignment` | No | `null` |

**Response `201`:** Created Companion object.

**Response `403`:** Not the owner.

---

#### `PUT /api/users/{slug}/companions/{id}`

Updates a companion. All fields are optional.

**Auth:** Owner or Admin.

**Request body** (same fields as create, all optional):

```json
{
  "visibility": 2,
  "name": "Nova v2",
  "bio": "Updated bio.",
  "alignment": 2,
  "clearAlignment": false
}
```

To remove the alignment, send `"clearAlignment": true`.

**Response `200`:** Updated Companion object.

**Response `403`:** Not the owner or an admin.

**Response `404`:** Companion not found.

---

#### `DELETE /api/users/{slug}/companions/{id}`

Deletes a companion and its profile image.

**Auth:** Owner or Admin.

**Response `204`:** Deleted.

**Response `403`:** Not the owner or an admin.

**Response `404`:** Companion not found.

---

#### `POST /api/users/{slug}/companions/{id}/image`

Uploads a profile image for a companion. Replaces any existing image.

**Auth:** Owner or Admin.

**Request:** `multipart/form-data` with a `file` field.

Accepted formats: `.jpg`, `.jpeg`, `.png`, `.gif`, `.webp`. Max size: **5 MB**.

**Response `200`:**

```json
{
  "profileImageUrl": "generated-filename.jpg"
}
```

**Response `400`:** Invalid file type or file too large.

---

#### `DELETE /api/users/{slug}/companions/{id}/image`

Removes a companion's profile image.

**Auth:** Owner or Admin.

**Response `204`:** Image deleted.

---

### Images

#### `GET /api/images/{filename}`

Returns an image file. The `filename` value comes from `profileImageUrl` in user or companion objects.

**Auth:** None required.

Responses are cached for **24 hours** (`Cache-Control: public, max-age=86400`).

**Response `200`:** Image binary (content type varies by file format).

**Response `404`:** Image not found.

---

### Stats

#### `GET /api/stats`

Returns community-wide statistics. Only counts non-private (visibility ≥ `MembersOnly`) users and companions.

**Auth:** None required.

**Response `200`:**

```json
{
  "totalUsers": 42,
  "totalCompanions": 87
}
```

---

### Admin

All admin endpoints require an Admin token.

---

#### `GET /api/admin/audit`

Returns a paginated, reverse-chronological list of admin actions.

**Auth:** Admin only.

**Query Parameters:**

| Name | Type | Default | Max |
|---|---|---|---|
| `page` | integer | `1` | — |
| `pageSize` | integer | `20` | `100` |

**Response `200`:** `PaginatedResponse<AuditLogEntry>`

```json
{
  "items": [
    {
      "id": "664f...",
      "adminDiscordId": "123456789",
      "adminDiscordUsername": "admin_user",
      "action": "UpdateUser",
      "targetType": "User",
      "targetId": "ab3x9k2m",
      "details": null,
      "previousValues": { "visibility": 0, "bio": null },
      "newValues": { "visibility": 2, "bio": "New bio." },
      "timestamp": "2024-03-15T10:30:00Z"
    }
  ],
  "page": 1,
  "pageSize": 20,
  "totalCount": 5,
  "totalPages": 1,
  "seed": null
}
```

**Logged actions:**

| Action | TargetType | Triggered by |
|---|---|---|
| `UpdateUser` | `User` | Admin edits another user's profile |
| `UpdateUserImage` | `User` | Admin uploads/replaces a user's image |
| `DeleteUserImage` | `User` | Admin removes a user's image |
| `UpdateUserSkills` | `User` | Admin changes a user's skills |
| `UpdateUserLlmExperiences` | `User` | Admin changes a user's LLM experiences |
| `UpdateCompanion` | `Companion` | Admin edits a companion |
| `UpdateCompanionImage` | `Companion` | Admin uploads/replaces a companion's image |
| `DeleteCompanionImage` | `Companion` | Admin removes a companion's image |
| `DeleteCompanion` | `Companion` | Admin deletes a companion |

---

## Error Handling

| HTTP Status | Meaning |
|---|---|
| `400 Bad Request` | Invalid input (validation error, bad file, unknown ID in request) |
| `401 Unauthorized` | Missing or invalid JWT token |
| `403 Forbidden` | Authenticated, but not authorized for this action |
| `404 Not Found` | Resource does not exist, or is not visible to the caller |
| `409 Conflict` | Unique constraint violation (e.g. duplicate skill name) |

All error responses use the [ErrorResponse](#errorresponse) format.

Resources that are not visible to the caller return `404` (not `403`) to avoid leaking the existence of private profiles.
