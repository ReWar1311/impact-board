# ImpactBoard Edge‑Case Behavior

This document defines **exact, deterministic behavior** for ImpactBoard when edge cases occur — especially around **privacy, ranking, and selectors**.

These rules are **non‑negotiable** and exist to guarantee:

* Privacy safety
* Predictable output
* Reviewer trust
* Zero accidental disclosure

---

## 1. Core Principle

> **Privacy always wins over ranking.**

No placeholder, selector, or template may reveal:

* A private user’s name
* A private user’s rank
* A private user’s existence

If data cannot be shown safely, ImpactBoard must **skip, substitute, or fallback**.

---

## 2. Definitions

### Private User

A user marked as **private or fully opted‑out** in the ImpactBoard database.

Characteristics:

* Username must never appear in README
* Username must never appear in YAML
* Username must never appear in assets

---

### Public User

A user whose username is already public and allowed to appear.

Visibility of *specific fields* may still be restricted via YAML.

---

## 3. Selector Resolution Rules

Selectors such as `TOP(n)`, `RANK(n)`, and `ACTIVE(n)` are resolved **after privacy filtering**.

This means:

1. Build full ranking internally
2. Remove all private users
3. Re‑index remaining users
4. Resolve selector against filtered list

This prevents gaps, leaks, and inference.

---

## 4. Edge Case: TOP(1) Is Private

### Scenario

* True top contributor is private
* README contains:

```
{{IMPACTBOARD:USER.TOP(1).username}}
```

### Correct Behavior

* Private user is removed from ranking
* Next eligible public user becomes `TOP(1)`
* Placeholder resolves normally

### Output

```
@bob
```

### Never Allowed

* Showing a blank row
* Showing "Private User"
* Showing a masked username
* Shifting ranks visibly

---

## 5. Edge Case: Multiple Top Users Are Private

### Scenario

* TOP(1), TOP(2), and TOP(3) are private
* README asks for TOP(1)

### Behavior

* All private users are filtered out
* First public user becomes TOP(1)

If **no public users exist**:

* Placeholder resolves to fallback
* No error is thrown

Example fallback:

```
{{IMPACTBOARD:USER.TOP(1).username | fallback="—"}}
```

---

## 6. Edge Case: Selector Exceeds Public Pool

### Scenario

* Only 2 public users exist
* README requests TOP(3)

### Behavior

* Selector cannot be resolved
* Fallback is used

```
—
```

No warnings in README.
Warnings may be logged internally.

---

## 7. Edge Case: Mixed Public Visibility

### Scenario

* User is public
* YAML hides `rank` and `streak`

Placeholder:

```
{{IMPACTBOARD:USER.TOP(1).rank}}
```

### Behavior

* Field is suppressed
* Fallback is used

Username remains visible.

---

## 8. Edge Case: Templates and Privacy

In `template` mode:

* Templates must use the same resolution rules
* Templates must not assume fixed ranks
* Templates must tolerate missing data

If required template data cannot be resolved safely:

* Section is omitted
* Template continues rendering

---

## 9. SVG Generation Edge Cases

### Rule

SVGs follow the **same privacy filtering** as README placeholders.

* Private users are excluded before ranking
* No visual placeholders for private users

If SVG has no valid data:

* Generate empty but valid SVG
* Do not include usernames

---

## 10. Anti‑Inference Guarantees

ImpactBoard explicitly prevents inference attacks:

* No "holes" in rankings
* No counts of private users
* No masked placeholders
* No visual spacing anomalies

Users must not be able to deduce:

* That a private user exists
* Their approximate rank
* Their contribution level

---

## 11. Logging & Debugging

Privacy‑related skips may be logged internally as:

```
SKIP_PRIVATE_USER
FALLBACK_APPLIED
```

Logs must never contain usernames of private users.

---

## 12. Summary of Guarantees

* Private users are invisible everywhere
* Rankings are recalculated after filtering
* Selectors never leak information
* README output is deterministic
* YAML cannot weaken privacy

---