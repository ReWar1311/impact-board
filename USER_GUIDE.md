# 🏆 ImpactBoard - User Guide

**Celebrate your team's contributions with beautiful leaderboards, streaks, ranks, and badges!**

Transform your GitHub organization into a gamified contribution platform that motivates developers and recognizes their hard work.

![Leaderboard Example](https://img.shields.io/badge/dynamic-leaderboard-brightgreen?style=for-the-badge)
![Streaks](https://img.shields.io/badge/🔥_streaks-tracked-orange?style=for-the-badge)
![Ranks](https://img.shields.io/badge/ranks-bronze_to_diamond-blue?style=for-the-badge)

---

## ✨ What Does This App Do?

ImpactBoard is a GitHub App that automatically tracks contributions across your organization and provides:

| Feature | Description |
|---------|-------------|
| 📊 **Live Leaderboards** | Real-time ranking of contributors with beautiful SVG badges |
| 🔥 **Streak Tracking** | Track consecutive days of contributions |
| 🎖️ **Rank System** | Bronze → Silver → Gold → Platinum → Diamond rankings |
| 🏅 **Monthly Awards** | Automatic recognition for top performers |
| 📈 **Contribution Heatmaps** | GitHub-style activity visualization |
| 🔒 **Privacy Controls** | Contributors can opt-out anytime |
| 📝 **Auto README Updates** | Automatically update your org's README with stats |

---

## 🚀 Quick Start

### Step 1: Install the App

1. **[Click here to install](https://github.com/apps/impactboard)** (or search for "ImpactBoard" on GitHub Marketplace)
2. Select your **organization**
3. Choose which repositories to track:
   - **All repositories** - Track everything
   - **Select repositories** - Choose specific repos
4. Click **Install**

That's it! The app starts tracking immediately.

---

### Step 2: Find Your Installation ID

You'll need your **Installation ID** to use badges. Here's how to find it:

1. Go to your organization's **Settings**
2. Click **GitHub Apps** (under Integrations section)
3. Click **Configure** next to ImpactBoard
4. Look at the URL - the number at the end is your Installation ID:
   ```
   github.com/organizations/YOUR-ORG/settings/installations/12345678
                                                            ^^^^^^^^
                                                            This is your Installation ID
   ```

---

### Step 3: Add Badges to Your README

#### 🏆 Leaderboard Badge

Display your top contributors:

```markdown
![Leaderboard](https://YOUR-APP-URL/badge/leaderboard/INSTALLATION_ID)
```

**Options:**

| Parameter | Description | Default |
|-----------|-------------|---------|
| `compact=true` | Smaller, compact view | `false` |
| `limit=5` | Number of contributors (max 25) | `10` |

**Examples:**
```markdown
<!-- Full leaderboard with top 10 -->
![Leaderboard](https://YOUR-APP-URL/badge/leaderboard/12345678)

<!-- Compact with top 5 -->
![Top 5](https://YOUR-APP-URL/badge/leaderboard/12345678?compact=true&limit=5)

<!-- Top 3 contributors -->
![Top 3](https://YOUR-APP-URL/badge/leaderboard/12345678?limit=3)
```

---

#### 👤 Contributor Card

Show individual contributor stats:

```markdown
![Contributor](https://YOUR-APP-URL/badge/contributor/INSTALLATION_ID/USERNAME)
```

**Example:**
```markdown
![John's Stats](https://YOUR-APP-URL/badge/contributor/12345678/johndoe)
```

This displays:
- 🎖️ Current rank (Bronze → Diamond)
- 📊 Contribution score
- 🔥 Current streak
- 📈 Total commits, PRs, and issues

---

#### 📅 Activity Heatmap

GitHub-style contribution heatmap:

```markdown
![Heatmap](https://YOUR-APP-URL/badge/heatmap/INSTALLATION_ID/USERNAME)
```

**Options:**

| Parameter | Description | Default |
|-----------|-------------|---------|
| `mini=true` | 30-day mini heatmap | `false` (365 days) |

**Examples:**
```markdown
<!-- Full year heatmap -->
![Activity](https://YOUR-APP-URL/badge/heatmap/12345678/johndoe)

<!-- Last 30 days mini version -->
![Recent Activity](https://YOUR-APP-URL/badge/heatmap/12345678/johndoe?mini=true)
```

---

## 🎖️ Rank System

Contributors earn ranks based on their weighted contribution score:

| Rank | Score Required | Badge |
|------|----------------|-------|
| 🥉 **Bronze** | 0+ | ![Bronze](https://img.shields.io/badge/rank-Bronze-cd7f32) |
| 🥈 **Silver** | 100+ | ![Silver](https://img.shields.io/badge/rank-Silver-c0c0c0) |
| 🥇 **Gold** | 500+ | ![Gold](https://img.shields.io/badge/rank-Gold-ffd700) |
| 💎 **Platinum** | 1,500+ | ![Platinum](https://img.shields.io/badge/rank-Platinum-00d4aa) |
| 👑 **Diamond** | 5,000+ | ![Diamond](https://img.shields.io/badge/rank-Diamond-b9f2ff) |

### How Scores Are Calculated

| Activity | Points |
|----------|--------|
| Commit | 1 point |
| Pull Request Merged | 5 points |
| Issue Closed | 3 points |
| Code Review | 2 points |

*Scores include anti-gaming measures to ensure quality contributions are valued over quantity.*

---

## 🔥 Streak Tracking

Streaks track consecutive days with at least one contribution:

| Metric | Description |
|--------|-------------|
| **Current Streak** | Days in a row you've contributed |
| **Longest Streak** | Your all-time record |
| **Streak Start Date** | When your current streak began |

### Streak Rules

- ✅ A day counts if you have **any** contribution (commit, PR merge, issue close)
- ⏰ Streaks reset at **midnight UTC**
- 📅 Weekends count! Keep that streak alive 🔥
- 🌍 Based on UTC timezone, not your local time

---

## 🏅 Monthly Awards

At the end of each month, ImpactBoard automatically recognizes top performers:

| Award | Criteria | Badge |
|-------|----------|-------|
| 🏆 **Top Contributor** | Highest overall score | Gold trophy |
| 🔥 **Streak Master** | Longest streak of the month | Fire badge |
| 📝 **PR Champion** | Most pull requests merged | Purple star |
| 🐛 **Bug Squasher** | Most issues closed | Green bug |
| ⭐ **Rising Star** | Most improved from last month | Rising star |
| 🤝 **Team Player** | Most code reviews given | Handshake |

Awards appear on contributor cards and the leaderboard!

---

## 📊 Statistics Periods

View stats for different time periods using the leaderboard:

| Period | Description |
|--------|-------------|
| **7d** | Last 7 days |
| **30d** | Last 30 days (default) |
| **90d** | Last quarter |
| **all-time** | Since app installation |

---

## 🔒 Privacy & Opt-Out

**We respect contributor privacy.** Any contributor can opt out of public display.

### How to Opt Out

Comment on any issue in a tracked repository:

```
/impactboard opt-out
```

To opt back in:

```
/impactboard opt-in
```

### What Happens When You Opt Out

| Visible | Hidden |
|---------|--------|
| ✅ Org totals still include your work | ❌ Your name on leaderboards |
| ✅ You can opt back in anytime | ❌ Your personal badges |
| ✅ Your data remains (just hidden) | ❌ Your heatmap |

### What Data We Collect

| Data | Purpose | Stored |
|------|---------|--------|
| GitHub username & avatar | Identification | While app installed |
| Public contribution events | Statistics | While app installed |
| Contribution timestamps | Streak calculation | While app installed |

**We do NOT access:**
- ❌ Your code or file contents
- ❌ Private repository names or details
- ❌ Personal information beyond public GitHub profile
- ❌ Your email or contact information

---

## ⚙️ Organization Configuration

Organization admins can customize ImpactBoard by creating a `.github/impactboard.yml` file:

```yaml
# .github/impactboard.yml

# Customize point values
scoring:
  commit: 1
  pullRequest: 5
  issue: 3
  review: 2

# Leaderboard display options
leaderboard:
  showStreaks: true
  showRanks: true
  maxEntries: 25
  
# Privacy defaults
privacy:
  defaultOptIn: true          # New contributors are visible by default
  
# Auto-update your org's README
readme:
  enabled: true
  path: "profile/README.md"   # Path to your org's README
  section: "## 🏆 Top Contributors"
  updateFrequency: "daily"    # daily, weekly, or on-contribution

# Exclude bot accounts
excludeUsers:
  - dependabot[bot]
  - renovate[bot]
  - github-actions[bot]
  - codecov[bot]

# Exclude specific repositories
excludeRepos:
  - archived-project
  - internal-tools
  - test-repo
```

---

## 📝 Auto README Updates

Automatically showcase top contributors in your organization's profile README!

### Setup Instructions

1. **Create the config file** `.github/impactboard.yml`:
```yaml
readme:
  enabled: true
  path: "profile/README.md"
  section: "## 🏆 Top Contributors"
```

2. **Add placeholder to your README** (in your `.github` repo's `profile/README.md`):
```markdown
## 🏆 Top Contributors

<!-- IMPACTBOARD:START -->
<!-- Auto-updated by ImpactBoard - Do not edit manually -->
<!-- IMPACTBOARD:END -->
```

3. **Done!** ImpactBoard will automatically update this section with a fresh leaderboard.

---

## 🎨 Badge Styling Tips

### Centering Badges

```markdown
<p align="center">
  <img src="https://YOUR-APP-URL/badge/leaderboard/12345678" alt="Leaderboard">
</p>
```

### Linking Badges

```markdown
[![Leaderboard](https://YOUR-APP-URL/badge/leaderboard/12345678)](https://github.com/orgs/YOUR-ORG)
```

### Side by Side Badges

```markdown
<p align="center">
  <img src="https://YOUR-APP-URL/badge/contributor/12345678/alice" alt="Alice" width="300">
  <img src="https://YOUR-APP-URL/badge/contributor/12345678/bob" alt="Bob" width="300">
</p>
```

### In Tables

```markdown
| Contributor | Stats |
|-------------|-------|
| Alice | ![Alice](https://YOUR-APP-URL/badge/contributor/12345678/alice) |
| Bob | ![Bob](https://YOUR-APP-URL/badge/contributor/12345678/bob) |
```

---

## 🤔 Frequently Asked Questions

### How quickly do contributions appear?

Contributions appear within **1-2 minutes** of the GitHub event (push, PR merge, issue close).

---

### Why isn't my contribution showing?

Check that:
- ✅ The repository has ImpactBoard installed
- ✅ You haven't opted out of tracking
- ✅ The contribution was to a tracked branch
- ✅ You're not in the `excludeUsers` list
- ✅ The repo isn't in the `excludeRepos` list

---

### Can I use this for private repositories?

**Yes!** ImpactBoard works with both public and private repositories. Badge data only shows aggregated scores and counts, never code content or repository names.

---

### Does this work with GitHub Enterprise?

Currently, ImpactBoard supports **GitHub.com** only. GitHub Enterprise Server support is planned for a future release.

---

### Can multiple organizations use this?

**Yes!** Each organization gets its own separate:
- Leaderboard
- Statistics
- Configuration
- Installation ID

Install ImpactBoard on each organization separately.

---

### How do I transfer ownership of the installation?

Organization owners can transfer ImpactBoard to a different org:
1. Uninstall from current org
2. Install on new org
3. Note: Historical data is not transferred

---

### What happens to my data if I uninstall?

When you uninstall ImpactBoard:
- All organization data is marked for deletion
- Data is permanently deleted within **30 days**
- Badges will return 404 errors immediately

---

### Can I see historical data from before installation?

**No.** ImpactBoard only tracks contributions that occur **after** installation. It cannot retroactively fetch historical contribution data.

---

### How do I report a bug or request a feature?

- 🐛 **Bug Reports**: [Open an issue](https://github.com/YOUR-USERNAME/impact-board/issues/new?template=bug_report.md)
- 💡 **Feature Requests**: [Submit an idea](https://github.com/YOUR-USERNAME/impact-board/issues/new?template=feature_request.md)

---

## 📊 Example Badge Gallery

### Leaderboard Styles

**Full Leaderboard:**
```
https://YOUR-APP-URL/badge/leaderboard/12345678
```

**Compact Leaderboard:**
```
https://YOUR-APP-URL/badge/leaderboard/12345678?compact=true
```

**Top 3 Only:**
```
https://YOUR-APP-URL/badge/leaderboard/12345678?limit=3
```

### Contributor Cards

**Standard Card:**
```
https://YOUR-APP-URL/badge/contributor/12345678/username
```

### Heatmaps

**Full Year:**
```
https://YOUR-APP-URL/badge/heatmap/12345678/username
```

**Mini (30 days):**
```
https://YOUR-APP-URL/badge/heatmap/12345678/username?mini=true
```

---

## 🔗 Quick Links

| Resource | Link |
|----------|------|
| 📥 Install App | [GitHub Marketplace](https://github.com/apps/impactboard) |
| 📖 Developer Docs | [README.md](./README.md) |
| 🐛 Report Bug | [Issues](https://github.com/YOUR-USERNAME/impact-board/issues) |
| 💬 Discussions | [Community](https://github.com/YOUR-USERNAME/impact-board/discussions) |
| 📜 Privacy Policy | [Privacy](https://YOUR-URL/privacy) |
| 📋 Terms of Service | [Terms](https://YOUR-URL/terms) |

---

## 💡 Pro Tips

1. **Pin the leaderboard** to your org's profile README for maximum visibility
2. **Use compact mode** in repo READMEs to save space
3. **Celebrate milestones** - share when someone reaches a new rank!
4. **Weekly shoutouts** - highlight the weekly top contributor in team meetings
5. **Gamify sprints** - use the 7-day view during sprint reviews

---

<p align="center">
  <b>Made with ❤️ for open source communities</b>
  <br><br>
  <sub>Motivate contributions. Celebrate developers. Build better together.</sub>
</p>

---

<p align="center">
  <a href="https://github.com/apps/impactboard">
    <img src="https://img.shields.io/badge/Install-ImpactBoard-2ea44f?style=for-the-badge&logo=github" alt="Install ImpactBoard">
  </a>
</p>
