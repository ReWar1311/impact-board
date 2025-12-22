# ImpactBoard YAML Configuration

This document defines the **complete, authoritative YAML configuration** for ImpactBoard.

The YAML file is the **single source of truth** for:

* What ImpactBoard is allowed to do
* Which data can be exposed
* How placeholders behave
* Privacy and anti‑gaming rules
* Which rendering mode is active

README files only **request** data.
**YAML always decides.**

---

## File Location (Fixed)

```
.github/impactboard.yml
```

ImpactBoard will not search for this file elsewhere.

---

# QUICK START

## 1. Minimal Safe Configuration

This is the smallest valid configuration. It enables ImpactBoard without modifying any README.

```yaml
version: v1
mode: assets-only
```

---

## 2. Full README Mode (Most Common)

Use this when you want ImpactBoard to resolve placeholders inside your org README.

```yaml
version: v1
mode: full

readme:
  file: .github/profile/README.md
```

ImpactBoard will:

* Scan the README for placeholders
* Replace only valid placeholders
* Never modify layout or text

---

## 3. Template Mode (Pre‑Made Layouts)

Template mode allows users to select **official ImpactBoard templates**.
ImpactBoard manages the structure, while still respecting privacy and limits.

```yaml
version: v1
mode: template

template:
  name: polished
  version: v1
  target:
    file: .github/profile/README.md
```

Use this mode when:

* You want a polished README quickly
* You trust ImpactBoard’s layout
* You don’t want to manage placeholders manually

---

# HOW YAML INTERACTS WITH README

Execution flow:

```
impactboard.yml
   ↓ (validated)
Policy & limits applied
   ↓
README parsed for placeholders (if allowed)
   ↓
Data fetched once
   ↓
Values injected safely
```

If anything violates YAML rules → **no changes are made**.

---

# SCHEMA OVERVIEW

Top‑level keys:

```
version
mode
readme
template
assets
data
privacy
advanced
```

Unknown keys are rejected.

---

# 1. VERSION

```yaml
version: v1
```

Required.
Used for schema evolution and backward compatibility.

---

# 2. MODE

```yaml
mode: full | assets-only | template
```

Modes:

| Mode        | Description                                 |
| ----------- | ------------------------------------------- |
| full        | Resolve placeholders inside README          |
| assets-only | Only update generated assets (SVGs, badges) |
| template    | Generate README from a predefined template  |

Hard rules:

* `assets-only` → README is never modified
* `template` → README structure is owned by ImpactBoard

---

# 3. FULL MODE CONFIGURATION

Required when `mode: full`.

```yaml
readme:
  file: .github/profile/README.md

  allow:
    entities: [USER, REPO, ORG]

    user_selectors:
      top_max: 5
      allow_username: true

    fields:
      - username
      - commits
      - prs
      - streak
      - loc_added

    max_placeholders: 100
```

This block defines **what placeholders are allowed to resolve**.

---

# 4. ASSETS‑ONLY MODE CONFIGURATION

Required when `mode: assets-only`.

```yaml
assets:
  base_path: assets/impactboard

  svgs:
    leaderboard:
      enabled: true
      max_limit: 10
      window: 30d

    badges:
      enabled: true

    heatmap:
      enabled: false
```

ImpactBoard will only write inside `base_path`.

---

# 5. TEMPLATE MODE CONFIGURATION

Required when `mode: template`.

```yaml
template:
  name: polished
  version: v1

  target:
    file: .github/profile/README.md

  options:
    show_leaderboard: true
    show_awards: true
    show_repositories: true

  overrides:
    window: 30d
    leaderboard_limit: 5
```

Templates are:

* Maintained by ImpactBoard
* Versioned
* Deterministic

Users cannot inject custom layout in template mode.

---

# 6. DATA CONFIGURATION

```yaml
data:
  windows:
    default: 30d
    allowed: [7d, 30d, all]

  scoring:
    commit: 1
    merged_pr: 3
    closed_issue: 2
    loc_weight: 0.01
```

Controls how raw GitHub activity is interpreted.

---

# 7. PRIVACY CONFIGURATION

Privacy is **database‑driven first**, not YAML‑driven.

YAML must **never require naming a private or opted‑out user**, because the YAML file itself is public in most repositories.

There are **two privacy layers**:

1. **Database (authoritative)** – handles full opt‑out and hidden membership
2. **YAML (public & optional)** – handles partial visibility controls only

---

## 7.1 Database‑Controlled Privacy (Authoritative)

Some users or entire organizations may not want:

* Their username stored in a public file
* Any indication that they belong to the organization
* Their contributions rendered anywhere

These users are managed **only in ImpactBoard’s database**.

Characteristics:

* No username appears in YAML
* No username appears in README
* No username appears in generated assets
* README placeholders silently skip them

This is the **only acceptable approach** for private organizations.

YAML can never override database opt‑out.

---

## 7.2 YAML‑Controlled Visibility (Public Users Only)

YAML may optionally define **partial visibility rules** for users who are already public.

These rules are for presentation only.

```yaml
privacy:
  default_visibility: public

  public_users:
    bob:
      hide:
        - rank
        - streak
```

Rules:

* `public_users` may only contain users whose usernames are already public
* YAML **must not** list fully private or opted‑out users
* YAML cannot force visibility on anyone

---

## 7.3 Visibility Rules Summary

* Database opt‑out → absolute, cannot be overridden
* YAML visibility → cosmetic, optional, public‑only
* README placeholders cannot expose private users
* If a placeholder resolves to a private user → fallback is used

README cannot override privacy

---

# 8. ANTI‑GAMING CONTROLS

```yaml
advanced:
  anti_gaming:
    min_loc_change: 5
    max_commits_per_day: 10
    ignore_self_closed_issues: true
```

These rules filter low‑value activity before scoring.

---

# 9. BEHAVIOR & SAFETY FLAGS

```yaml
advanced:
  behavior:
    fail_on_invalid_config: true
```

* `fail_on_invalid_config: true` → no updates on error

---

# REAL‑WORLD CONFIGURATION EXAMPLES

## Example 1: Open‑Source Organization

```yaml
version: v1
mode: full

readme:
  file: .github/profile/README.md

data:
  windows:
    default: 30d

privacy:
  default_visibility: public
```

---

## Example 2: Company with Strict Privacy

```yaml
version: v1
mode: full

readme:
  file: .github/profile/README.md

privacy:
  default_visibility: private

advanced:
  anti_gaming:
    min_loc_change: 10
```

---

## Example 3: SVG‑Only Power User

```yaml
version: v1
mode: assets-only

assets:
  base_path: assets/impactboard
```

---

## Example 4: Template‑Driven Setup

```yaml
version: v1
mode: template

template:
  name: polished
  version: v1

  target:
    file: .github/profile/README.md
```

---

# VALIDATION RULES

Configuration is rejected if:

* `version` is missing or unknown
* `mode` is missing
* Mode‑specific blocks are missing
* Unknown keys are present

When rejected, ImpactBoard performs **no writes**.

---

# DESIGN GUARANTEES

* YAML is authoritative
* README is presentation only
* No implicit behavior
* No silent privilege escalation
* Deterministic output

---

# SUMMARY

* impactboard.yml defines trust boundaries
* README requests, YAML approves
* Template mode offers fast onboarding
* Privacy and safety are enforced centrally

---