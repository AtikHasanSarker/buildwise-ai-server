# BuildWise AI Server

Backend API server for BuildWise AI — a premium PC builder with AI-powered recommendations.

## Tech Stack

- **Runtime:** Node.js + TypeScript
- **Framework:** Express.js
- **Database:** MongoDB (Mongoose ODM)
- **Auth:** JWT + Better Auth
- **AI:** Groq API

## Setup

```bash
# Install dependencies
npm install

# Copy env file and fill in values
cp .env.example .env

# Run in development
npm run dev

# Build for production
npm run build

# Run production build
npm start
```

## API Base URL

```
http://localhost:5000/api/v1
```

## Available Scripts

| Script | Description |
|---|---|
| `npm run dev` | Start dev server with hot-reload (ts-node-dev) |
| `npm run build` | Compile TypeScript to `dist/` |
| `npm start` | Run compiled JS from `dist/` |
| `npm run lint` | Run ESLint |
| `npm run format` | Run Prettier |

## Folder Structure

```
src/
├── config/          # DB connection, env config
├── controllers/     # Request handlers
├── middleware/       # CORS, auth, error handling
├── models/          # Mongoose schemas
├── routes/          # API route definitions
├── services/ai/     # Gemini AI integration
├── utils/           # Response helpers, utilities
└── server.ts        # Entry point
```
