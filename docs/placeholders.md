# ImpactBoard Atomic Placeholder System

This documentation is split into **Quick Start** and **Reference** sections.

---

# QUICK START

## 1. What Is ImpactBoard?

ImpactBoard is a GitHub App that **injects verified contribution data** into your README while giving you **full control over layout and design**.

ImpactBoard never decides *how* things look.
It only decides *what the data is*.

---

## 2. How It Works (High Level)

Flow:

1. You install the ImpactBoard GitHub App
2. You add placeholders in your README
3. ImpactBoard reads contribution data
4. ImpactBoard replaces placeholders with values

Nothing else is modified.

---

## 3. Basic Placeholder Example

```text
{{IMPACTBOARD:USER.TOP(1).username}}
```

Renders as:

```text
@alice
```

---

## 4. Your First Custom Section

```text
## 🌟 Top Contributor

User: {{IMPACTBOARD:USER.TOP(1).username}}
Commits: {{IMPACTBOARD:USER.TOP(1).commits}}
Streak: {{IMPACTBOARD:USER.TOP(1).streak}} days
```

You control spacing, emojis, headings, and layout.
ImpactBoard only fills values.

---

## 5. Custom Table Example

```text
| User | Commits | +LOC | Streak |
|------|---------|------|--------|
| {{IMPACTBOARD:USER.TOP(1).username}} | {{IMPACTBOARD:USER.TOP(1).commits}} | {{IMPACTBOARD:USER.TOP(1).loc_added}} | {{IMPACTBOARD:USER.TOP(1).streak}} |
| {{IMPACTBOARD:USER.TOP(2).username}} | {{IMPACTBOARD:USER.TOP(2).commits}} | {{IMPACTBOARD:USER.TOP(2).loc_added}} | {{IMPACTBOARD:USER.TOP(2).streak}} |
```

ImpactBoard never touches table structure.

---

## 6. SVG Asset Example

```text
![Top Contributor]({{IMPACTBOARD:USER.TOP(1).badge_svg}})
```

---

# DIAGRAMS & FLOW

## 7. Data Resolution Flow

```text
README.md
   ↓
ImpactBoard scans placeholders
   ↓
All data fetched once
   ↓
Each placeholder resolved independently
   ↓
README updated safely
```

---

## 8. Trust Boundary Diagram

```text
USER CONTROLS        | IMPACTBOARD CONTROLS
--------------------|----------------------
Layout              | Data accuracy
Tables              | Ranking logic
Narrative            | Anti-gaming rules
Design              | Privacy enforcement
```

---

# REAL ORGANIZATION README EXAMPLES

## 9. Minimal Org README

```text
# Acme Org

Active contributors: {{IMPACTBOARD:ORG.active_users}}
Repositories: {{IMPACTBOARD:ORG.total_repos}}

Top contributor: {{IMPACTBOARD:USER.TOP(1).username}}
```

---

## 10. Culture-Focused README

```text
## 🌱 Team Highlights

🔥 {{IMPACTBOARD:USER.TOP(1).username}} — {{IMPACTBOARD:USER.TOP(1).streak}} day streak

🚀 New contributor: {{IMPACTBOARD:USER.NEW(1).username}}
```

---

## 11. Metrics-Heavy README

```text
## 📊 Monthly Impact

| User | Commits | PRs | +LOC |
|------|---------|-----|------|
| {{IMPACTBOARD:USER.TOP(1).username}} | {{IMPACTBOARD:USER.TOP(1).commits}} | {{IMPACTBOARD:USER.TOP(1).prs}} | {{IMPACTBOARD:USER.TOP(1).loc_added}} |
```

---

# REFERENCE

## 12. Placeholder Syntax

```text
{{IMPACTBOARD:<ENTITY>.<SELECTOR>.<FIELD> | <OPTIONS>}}
```

---

## 13. Entities

USER  → contributor
REPO  → repository
ORG   → organization

---

## 14. USER Selectors

TOP(n)        → nth top contributor by impact
RANK(n)       → nth ranked contributor
USERNAME(x)   → specific GitHub username
NEW(n)        → nth newest contributor
ACTIVE(n)     → nth most active contributor

---

## 15. REPO Selectors

TOP(n)     → nth most active repository
RANK(n)    → nth ranked repository
NAME(repo) → specific repository

---

## 16. USER Fields

username
commits
prs
issues_closed
issues_open
loc_added
loc_removed
streak
rank
impact
repos
last_active

---

## 17. REPO Fields

name
commits
prs
issues
loc_added
contributors
status

---

## 18. ORG Fields

active_users
total_commits
total_prs
total_loc_added
total_repos
health_score

---

## 19. Options

window=7d | 30d | all
format=number | compact | badge | fire | text
fallback=<string>

---

## 20. Safety Rules

* One placeholder resolves to one value
* Unknown placeholders are ignored
* Privacy cannot be overridden
* Layout is never modified

---

## 21. Reserved for Future Use

{{IMPACTBOARD:USER.TOP(1).ai_summary}}
{{IMPACTBOARD:ORG.team_insights}}

---

