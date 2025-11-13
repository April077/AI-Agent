# Email Agent

An AI-powered email management system that automatically summarizes emails, extracts tasks and meetings, and prioritizes them with intelligent tagging.

## Purpose

Email Agent helps you manage inbox overload by:
- **Summarizing emails** - Get concise summaries of lengthy email threads
- **Extracting tasks** - Automatically identifies action items from your emails
- **Meeting detection** - Finds and extracts meeting information
- **Priority tagging** - Categorizes emails as High, Medium, or Low priority
- **Gmail integration** - Works seamlessly with your Gmail account

## Project Structure

```
.
├── apps/
│   ├── web/              # Next.js frontend application
│   └── server/           # Express API server
├── packages/
│   └── db/               # Shared database schemas and utilities
├── docker-compose.yml    # Multi-container orchestration
└── README.md
```

## Tech Stack

- **Frontend**: Next.js (React framework)
- **Backend**: Node.js + Express
- **Database**: PostgreSQL, Prisma
- **Queue System**: Redis (for background job processing)
- **Email Integration**: Gmail API
- **AI Processing**: groq
- **Containerization**: Docker & Docker Compose
- **Monorepo**: Yarn Workspaces

## Prerequisites

- Node.js v18 or higher
- Yarn package manager
- Docker and Docker Compose
- Gmail API credentials
- AI API key - groq

## Setup

### 1. Clone the Repository

```bash
git clone <repository-url>
cd email-agent
```

### 2. Install Dependencies

```bash
yarn install
```

### 3. Configure Environment Variables

**apps/web/.env**
```env
NEXT_PUBLIC_API_URL=http://localhost:4000
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

**apps/server/.env**
```env
PORT=4000
DATABASE_URL=postgresql://postgres:password@localhost:5432/email_agent
REDIS_URL=redis://localhost:6379

# Gmail API
GMAIL_CLIENT_ID=your_client_id
GMAIL_CLIENT_SECRET=your_client_secret
GMAIL_REDIRECT_URI=http://localhost:4000/auth/google/callback

# AI Service (e.g., OpenAI)
OPENAI_API_KEY=your_api_key

# Session
SESSION_SECRET=your_session_secret
```

### 4. Set Up Gmail API

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project
3. Enable Gmail API
4. Create OAuth 2.0 credentials
5. Add authorized redirect URIs
6. Copy Client ID and Client Secret to your `.env` file

### 5. Run with Docker (Recommended)

```bash
docker-compose up
```

This starts:
- **Web app** on `http://localhost:3000`
- **API server** on `http://localhost:4000`
- **PostgreSQL** database
- **Redis** queue

### 6. Run Locally (Without Docker)

**Terminal 1 - Database & Redis:**
```bash
# Start PostgreSQL and Redis (using Docker)
docker run -d -p 5432:5432 -e POSTGRES_PASSWORD=password postgres
docker run -d -p 6379:6379 redis
```

**Terminal 2 - Server:**
```bash
cd apps/server
yarn dev
```

**Terminal 3 - Web:**
```bash
cd apps/web
yarn dev
```

### 7. Database Setup

```bash
cd packages/db
yarn migrate    # Run database migrations
yarn seed       # (Optional) Seed with sample data
```

## Usage

### Getting Started

1. **Navigate to the app**: Open `http://localhost:3000`
2. **Connect Gmail**: Click "Connect Gmail Account" and authorize access
3. **Wait for sync**: The app will fetch and process your emails
4. **View dashboard**: See your summarized emails with extracted tasks and meetings

### Features

**Email Summaries**
- View AI-generated summaries of your emails
- Expandable to see full email content

**Task Extraction**
- Automatically detected action items from emails
- Mark tasks as complete
- Filter by priority (High/Medium/Low)

**Meeting Detection**
- Extracted meeting dates, times, and participants
- Calendar integration ready

**Priority Filtering**
- Filter emails by priority level
- Smart categorization based on content and sender

### API Endpoints

```
POST   /auth/google           # Initiate Gmail OAuth
GET    /auth/google/callback  # OAuth callback
GET    /api/emails            # List emails with summaries
GET    /api/emails/:id        # Get single email details
GET    /api/tasks             # List extracted tasks
GET    /api/meetings          # List extracted meetings
PATCH  /api/tasks/:id         # Update task status
```

## Docker Images

Pre-built images available on Docker Hub:

| Service | Image | Pull Command |
|---------|-------|--------------|
| Web | `tanmaydocker2024/email-agent-web` | `docker pull tanmaydocker2024/email-agent-web` |
| Server | `tanmaydocker2024/email-agent-server` | `docker pull tanmaydocker2024/email-agent-server` |

### Running Individual Containers

**Web Application:**
```bash
docker run -p 3000:3000 \
  -e NEXT_PUBLIC_API_URL=http://localhost:4000 \
  tanmaydocker2024/email-agent-web
```

**Server:**
```bash
docker run -p 4000:4000 \
  -e DATABASE_URL=postgresql://postgres:password@host.docker.internal:5432/email_agent \
  -e REDIS_URL=redis://host.docker.internal:6379 \
  tanmaydocker2024/email-agent-server
```

### Building Images

```bash
# Build web
docker build -f apps/web/Dockerfile -t tanmaydocker2024/email-agent-web .

# Build server
docker build -f apps/server/Dockerfile -t tanmaydocker2024/email-agent-server .

# Push to Docker Hub
docker push tanmaydocker2024/email-agent-web
docker push tanmaydocker2024/email-agent-server
```

## Development

### Common Commands

```bash
yarn install           # Install all dependencies
yarn build            # Build all apps and packages
yarn dev              # Run all apps in development mode
yarn test             # Run tests
yarn lint             # Lint code
yarn format           # Format code with Prettier
```

### Working with the Database

```bash
cd packages/db
yarn generate         # Generate Prisma client
yarn migrate          # Run migrations
yarn studio           # Open Prisma Studio (DB GUI)
```

### Queue Management

The app uses Redis Bull queues for:
- Email fetching and processing
- AI summarization jobs
- Task and meeting extraction

Monitor queue status in Redis or implement a queue dashboard.

## Troubleshooting

**Gmail API not working:**
- Verify OAuth credentials are correct
- Check redirect URI matches Google Cloud Console
- Ensure Gmail API is enabled in your project

**Database connection errors:**
- Confirm PostgreSQL is running
- Check DATABASE_URL format and credentials

**Redis connection issues:**
- Ensure Redis is running on port 6379
- Verify REDIS_URL in environment variables

## License

MIT License - See LICENSE file for details

## Author

Tanmay - [@tanmaydocker2024](https://hub.docker.com/u/tanmaydocker2024)