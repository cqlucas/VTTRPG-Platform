# QuestDreamer — TTRPG Ecosystem

> Hybrid Client-Server + P2P architecture for Virtual Tabletop RPGs.

## Architecture

- **`apps/web`** — Next.js 15 (App Router) frontend with Tailwind CSS & shadcn/ui
- **`apps/api`** — NestJS backend (REST API + Socket.io Signaling Server)
- **`packages/database`** — Prisma ORM schema, migrations & generated client
- **`packages/types`** — Shared TypeScript interfaces (WebRTC payloads, DTOs)
- **`packages/ui`** — Reusable React components
- **`packages/webrtc`** — P2P connection manager (RTCPeerConnection + Data Channels)

## Getting Started

```bash
# Install dependencies
pnpm install

# Generate Prisma client
pnpm db:generate

# Push schema to database
pnpm db:push

# Start all apps in dev mode
pnpm dev
```

## Key Commands

| Command | Description |
|---|---|
| `pnpm dev` | Start web + api in parallel |
| `pnpm build` | Build all apps and packages |
| `pnpm db:generate` | Regenerate Prisma client |
| `pnpm db:push` | Push schema changes to DB |
| `pnpm db:migrate` | Run Prisma migrations |
| `pnpm db:studio` | Open Prisma Studio |
