# ImpactBoard 🏆

A **production-ready GitHub App** that tracks organization contributions and generates motivational artifacts including leaderboards, streaks, ranks, awards, and beautiful SVG badges.

## ✨ Features

- **📊 Contribution Tracking**: Tracks commits, pull requests, issues, and code reviews
- **🏅 Leaderboards**: Automatic weekly/monthly/all-time leaderboards
- **🔥 Streak Tracking**: Current and longest contribution streaks
- **🎖️ Rank System**: Bronze → Silver → Gold → Diamond progression
- **🏆 Monthly Awards**: Top Contributor, Rising Star, Code Reviewer, and more
- **📈 SVG Badges**: Beautiful, embeddable contribution visualizations
- **📝 README Updates**: Auto-updates organization profile README
- **🛡️ Anti-Gaming**: Built-in protection against contribution gaming
- **🔒 Privacy Controls**: Users can opt-out of public display

## 🚀 Quick Start

### Prerequisites

- Node.js 18 or higher
- PostgreSQL 14 or higher
- A GitHub App (see [Creating a GitHub App](#creating-a-github-app))

### Installation

1. **Clone the repository**
   ```bash
   git clone https://github.com/ReWar1311/impact-board.git
   cd impact-board
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Configure environment**
   ```bash
   cp .env.example .env
   # Edit .env with your configuration
   ```

4. **Run database migrations**
   ```bash
   npm run migrate
   ```

5. **Start the application**
   ```bash
   npm run dev    # Development
   npm start      # Production
   ```

## 🔧 Configuration

### Environment Variables

| Variable | Description | Required |
|----------|-------------|----------|
| `GITHUB_APP_ID` | Your GitHub App ID | ✅ |
| `GITHUB_PRIVATE_KEY` | Base64-encoded private key | ✅ |
| `GITHUB_WEBHOOK_SECRET` | Webhook secret for signature verification | ✅ |
| `DATABASE_URL` | PostgreSQL connection string | ✅ |
| `PORT` | HTTP server port | Default: 3000 |
| `NODE_ENV` | Environment (development/production) | Default: development |
| `LOG_LEVEL` | Logging level | Default: info |

### Creating a GitHub App

1. Go to **Settings** → **Developer settings** → **GitHub Apps** → **New GitHub App**

2. Configure the following:
   - **Name**: Your app name (e.g., "Impact Board")
   - **Homepage URL**: (e.g. `https://impact-board.prashantrewar.me`)
   - **Webhook URL**: (e.g. `https://ib-api.prashantrewar.me/webhook`)
   - **Webhook secret**: Generate a secure secret

3. Set **Permissions**:
   - **Repository permissions**:
     - Contents: Read & Write (for README updates)
     - Pull requests: Read
     - Issues: Read
     - Metadata: Read
   - **Organization permissions**:
     - Members: Read

4. Subscribe to **events**:
   - Push
   - Pull request
   - Issues
   - Installation

5. Generate and download the **private key**

6. Encode the private key:
   ```bash
   base64 -w 0 your-app.private-key.pem
   ```

## 📦 Deployment

### Docker

```bash
# Build the image
docker build -t contribution-app .

# Run with docker-compose
docker-compose up -d
```

### Docker Compose

```yaml
version: '3.8'
services:
  app:
    build: .
    ports:
      - "3000:3000"
    environment:
      - DATABASE_URL=postgresql://user:pass@db:5432/contributions
      - GITHUB_APP_ID=${GITHUB_APP_ID}
      - GITHUB_PRIVATE_KEY=${GITHUB_PRIVATE_KEY}
      - GITHUB_WEBHOOK_SECRET=${GITHUB_WEBHOOK_SECRET}
    depends_on:
      - db

  db:
    image: postgres:15-alpine
    volumes:
      - pgdata:/var/lib/postgresql/data
    environment:
      - POSTGRES_USER=user
      - POSTGRES_PASSWORD=pass
      - POSTGRES_DB=impact-board

volumes:
  pgdata:
```

### Production Considerations

- Use a process manager (PM2) or container orchestration (Kubernetes)
- Set up a reverse proxy (nginx, Caddy) with SSL
- Configure proper database backups
- Set up monitoring and alerting
- Use environment-specific configurations

## 📊 API Endpoints

### Health Checks

- `GET /health` - Basic health check
- `GET /ready` - Readiness check (includes database)

### Webhooks

- `POST /webhook` - GitHub webhook endpoint

### Public Badges

- `GET /badge/leaderboard/:installationId` - Leaderboard SVG
  - Query: `?compact=true` for compact version
  - Query: `?limit=10` for top N (max 25)

- `GET /badge/contributor/:installationId/:username` - Contributor card SVG

- `GET /badge/heatmap/:installationId/:username` - Contribution heatmap
  - Query: `?mini=true` for 30-day mini version

### Privacy

- `POST /privacy/opt-out` - Update privacy preferences

## 🎨 Embedding Badges

Add badges to any README:

```markdown
<!-- Leaderboard -->
![Leaderboard](https://your-domain.com/badge/leaderboard/123)

<!-- Contributor Card -->
![My Stats](https://your-domain.com/badge/contributor/123/username)

<!-- Contribution Heatmap -->
![Heatmap](https://your-domain.com/badge/heatmap/123/username)
```

## 🏅 Scoring System

| Activity | Points |
|----------|--------|
| Commit | 1 point |
| Merged PR | 5 points |
| Reviewed PR | 3 points |
| Issue Created | 2 points |
| Issue Closed | 2 points |

### Rank Thresholds

| Rank | Points Required |
|------|-----------------|
| 🥉 Bronze | 0 |
| 🥈 Silver | 100 |
| 🥇 Gold | 500 |
| 💎 Diamond | 2000 |

## 🛡️ Anti-Gaming Rules

The app includes built-in protection against contribution gaming:

- **Commit Filtering**: Excludes trivial commits (whitespace-only, auto-generated)
- **Daily Caps**: Maximum 50 commits per user per day count toward score
- **Bot Detection**: Excludes bot accounts from leaderboards
- **Pattern Detection**: Identifies suspicious contribution patterns
- **Manual Overrides**: Admins can exclude specific users

## 🔒 Privacy

### User Privacy Controls

Users can opt-out of public display:
- Hide from leaderboards
- Hide detailed stats
- Full opt-out

### Data Handling

- Only public contribution data is collected
- No personal information beyond GitHub username/avatar
- Data is scoped to the organization installation
- Full GDPR compliance available upon request

## 🗃️ Database Schema

The app uses PostgreSQL with the following main tables:

- `installations` - GitHub App installations
- `users` - Organization members
- `daily_contributions` - Daily contribution records
- `aggregated_stats` - Pre-computed statistics
- `streaks` - Contribution streaks
- `awards` - Monthly awards
- `user_privacy` - Privacy preferences

## 🔄 README Auto-Update

The app automatically updates your organization's profile README with:

- Current leaderboard
- Active streaks
- Recent awards
- Contribution statistics

Add these markers to your README:

```markdown
<!-- CONTRIBUTION-LEADERBOARD:START -->
<!-- CONTRIBUTION-LEADERBOARD:END -->

<!-- CONTRIBUTION-STREAKS:START -->
<!-- CONTRIBUTION-STREAKS:END -->

<!-- CONTRIBUTION-AWARDS:START -->
<!-- CONTRIBUTION-AWARDS:END -->
```

## 🧪 Development

### Running Tests

```bash
npm test              # Run all tests
npm run test:watch    # Watch mode
npm run test:coverage # With coverage
```

### Linting

```bash
npm run lint          # Check for issues
npm run lint:fix      # Auto-fix issues
```

### Building

```bash
npm run build         # Compile TypeScript
```

## 📁 Project Structure

```
src/
├── app.ts              # Application entry point
├── server.ts           # Express server
├── config/             # Configuration
│   ├── env.ts          # Environment config
│   └── constants.ts    # App constants
├── github/             # GitHub integration
│   ├── auth.ts         # JWT/token auth
│   ├── client.ts       # Octokit wrapper
│   └── queries.ts      # GraphQL queries
├── webhook/            # Webhook handling
│   ├── verifySignature.ts
│   └── handler.ts
├── events/             # Event handlers
│   ├── push.ts
│   ├── pullRequest.ts
│   ├── issues.ts
│   └── installation.ts
├── stats/              # Statistics
│   ├── collector.ts
│   ├── aggregator.ts
│   ├── streaks.ts
│   ├── ranks.ts
│   ├── awards.ts
│   └── antiGaming.ts
├── svg/                # SVG generation
│   ├── leaderboard.ts
│   ├── badges.ts
│   └── heatmap.ts
├── readme/             # README updates
│   ├── template.md
│   ├── renderer.ts
│   └── publisher.ts
├── storage/            # Data layer
│   ├── schema.ts
│   ├── repository.ts
│   └── migrations/
├── types/              # TypeScript types
│   ├── index.ts
│   └── schemas.ts
└── utils/              # Utilities
    ├── logger.ts
    ├── date.ts
    └── validation.ts
```

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 📄 License

MIT License - see [LICENSE](LICENSE) for details.

## 🙏 Acknowledgments

- [Octokit](https://github.com/octokit/octokit.js) - GitHub API client
- [Express](https://expressjs.com/) - Web framework
- [Pino](https://getpino.io/) - Fast logging
- [Zod](https://zod.dev/) - TypeScript-first validation

---

Made with ❤️ for open source communities
