# ImpactBoard YAML Reference

This document is the **complete reference** for every field, keyword, and value that can appear in `impactboard.yml`.

It is intended for:

* Power users
* Auditors
* Maintainers
* Marketplace reviewers

This file is **descriptive, not tutorial**. For examples and onboarding, see the Quick Start docs.

---

## File Location

```
.github/impactboard.yml
```

This location is fixed and non-configurable.

---

# TOP-LEVEL FIELDS

| Field    | Type   | Required    | Description                        |
| -------- | ------ | ----------- | ---------------------------------- |
| version  | string | yes         | YAML schema version                |
| mode     | enum   | yes         | Rendering mode selector            |
| readme   | object | conditional | Configuration for full README mode |
| template | object | conditional | Configuration for template mode    |
| assets   | object | conditional | Configuration for assets-only mode |
| data     | object | no          | Data windows and scoring rules     |
| privacy  | object | no          | Public visibility controls         |
| advanced | object | no          | Safety, anti-gaming, logging       |

---

# version

```
version: v1
```

Schema version identifier.

Allowed values:

* v1

Unknown versions cause configuration rejection.

---

# mode

```
mode: full | assets-only | template
```

Controls how ImpactBoard operates.

| Value       | Meaning                                  |
| ----------- | ---------------------------------------- |
| full        | Resolve placeholders in README           |
| assets-only | Only generate/update assets              |
| template    | Generate README from predefined template |

---

# readme (mode: full)

```
readme:
  file: <path>
  allow: <object>
```

### readme.file

```
file: .github/profile/README.md
```

Explicit path to the README file managed by ImpactBoard.

---

### readme.allow

Defines what placeholders are allowed to resolve.

```
allow:
  entities: [USER, REPO, ORG]
  user_selectors:
    top_max: 5
    allow_username: true
  fields: [username, commits, prs]
  max_placeholders: 100
```

#### allow.entities

Allowed values:

* USER
* REPO
* ORG

---

#### allow.user_selectors

| Field          | Type    | Meaning                |
| -------------- | ------- | ---------------------- |
| top_max        | number  | Max TOP(n) allowed     |
| allow_username | boolean | Allow USER.USERNAME(x) |

---

#### allow.fields

List of atomic fields allowed to be rendered.

Examples:

* username
* commits
* prs
* streak

---

#### allow.max_placeholders

Maximum number of placeholders allowed in README.

---

# template (mode: template)

```
template:
  name: <string>
  version: <string>
  target: <object>
  options: <object>
  overrides: <object>
```

---

### template.name

Name of the ImpactBoard-provided template.

Examples:

* polished
* minimal
* open-source

---

### template.version

Template version identifier.

---

### template.target.file

Path to the README file to generate.

---

### template.options

Template feature toggles.

Common options:

* show_leaderboard
* show_awards
* show_repositories

---

### template.overrides

Allows limited parameter overrides.

Examples:

* window
* leaderboard_limit

---

# assets (mode: assets-only)

```
assets:
  base_path: <path>
  svgs: <object>
```

---

### assets.base_path

Root directory for generated assets.

ImpactBoard will never write outside this path.

---

### assets.svgs

Controls SVG generation.

```
svgs:
  leaderboard:
    enabled: true
    window: 30d
    max_limit: 10

  badges:
    enabled: true

  heatmap:
    enabled: false
```

---

# data

```
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

---

### data.windows

| Field   | Meaning               |
| ------- | --------------------- |
| default | Default time window   |
| allowed | Allowed window values |

Allowed windows:

* 7d
* 30d
* all

---

### data.scoring

Defines impact weights.

| Field        | Meaning                 |
| ------------ | ----------------------- |
| commit       | Weight per commit       |
| merged_pr    | Weight per merged PR    |
| closed_issue | Weight per closed issue |
| loc_weight   | Weight per LOC change   |

---

# privacy

```
privacy:
  default_visibility: public
  public_users: <object>
```

---

### privacy.default_visibility

Controls default visibility for public users.

Values:

* public
* private

---

### privacy.public_users

Public users with partial visibility rules.

```
public_users:
  bob:
    hide:
      - rank
      - streak
```

This section must never include fully private users.

---

# advanced

```
advanced:
  anti_gaming: <object>
  behavior: <object>
```

---

### advanced.anti_gaming

```
anti_gaming:
  min_loc_change: 5
  max_commits_per_day: 10
  ignore_self_closed_issues: true
```

---

### advanced.behavior

```
behavior:
  fail_on_invalid_config: true
```


# ENUM & KEYWORD INDEX

Entities:

* USER
* REPO
* ORG

Modes:

* full
* assets-only
* template

Windows:

* 7d
* 30d
* all

Visibility:

* public
* private

---

# DESIGN GUARANTEES

* YAML is authoritative
* Unknown fields are rejected
* README cannot escalate permissions
* Privacy is enforced before rendering

---

End of document.
