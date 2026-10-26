# Deploying

Tabletop Retro is built to run as **one app container with one
persistent volume**, behind a reverse proxy that terminates HTTPS. One
organisation runs it for its own teams; it isn't designed to scale out.

```
  browsers ──HTTPS──▶  reverse proxy  ──HTTP──▶  app container  ──▶  volume /data
  (TL, players)        TLS, streaming,           next start           tabletop.db   SQLite (WAL)
                       uploads up to 100 MB      Node 24, port 1313   content/      campaign JSON, images,
                                                 exactly 1 replica                  video, sound, characters
```

## Why one container

Two things hold state in the process or on local disk, and both are
deliberate for a single self-hosted server:

- **SQLite** (better-sqlite3, WAL mode) is the database. It's fast and
  needs no separate service, but only one process should write to the
  file, and the file must be on a local disk.
- **Live tables** publish on an in-memory bus (`lib/table-events.ts`)
  that streams to browsers as server-sent events. A player connected to
  one process never hears about a change made in another.

So: **one replica, always.** A team retro is a handful of people per
table and a few tables at once; one container handles that easily.
Running more needs a shared bus (Redis pub/sub, Postgres LISTEN) behind
`publishTable` / `subscribeTable` and a database that takes concurrent
writers. Both are seams in the code, not features.

## Storage

Everything durable lives in two places, and they belong together: rows
in the database point at files under the content folder. Put both on
**one volume** so they're backed up and restored as a pair.

| Setting | Default | In a container |
| ------- | ------- | -------------- |
| `DATABASE_PATH` | `dev.db` | `/data/tabletop.db` |
| `CONTENT_DIR` | `./content` | `/data/content` |
| `STORAGE_PER_OWNER_MB` | `2048` | size the volume for this times your Table Leads |

- **Use a block volume, not a network file system.** SQLite's locking
  isn't safe over NFS, SMB or most cloud file shares (EFS, Azure Files).
  A Docker named volume, a Kubernetes PVC with `ReadWriteOnce`, an EBS
  or persistent-disk volume, or a Fly volume are all fine.
- **Size it for media.** Videos are up to 100 MB each and sounds up to
  20 MB; images are small. Files no campaign uses are pruned on save.
- **Object storage** (S3 and the like) isn't supported for media; files
  are read and written on the volume. `lib/campaigns.ts` and
  `lib/characters.ts` are where that would change.

## Deploys and upgrades

- **Stop, then start.** Use a recreate strategy, not a rolling one: two
  containers must never have the database open at once (and a
  `ReadWriteOnce` volume can't attach to both anyway). Expect a few
  seconds of downtime.
- **Not during a retro.** Open tables survive a restart (their state is
  in the database) and browsers reconnect their streams, but anyone
  mid-upload or mid-roll loses it. Deploy between sessions.
- **Schema changes.** The schema is applied with `npm run db:push`
  (drizzle-kit, against `DATABASE_PATH`). Run it once against the
  volume before the first start, and again after an upgrade that
  changes `db/schema.ts`, as a one-off container with the volume
  mounted. Back up first. Don't run `db:seed` in production: its users
  can't sign in there, and it adds an example campaign.

## The reverse proxy

Any proxy that terminates TLS works (Caddy, nginx, Traefik, a cloud load
balancer) if it does four things:

- **Serves HTTPS.** The session cookie is `Secure` in production, so
  sign-in only sticks over HTTPS.
- **Passes the host through.** Server actions and the upload routes
  check the browser's `Origin` against `X-Forwarded-Host` (or `Host`).
  Most proxies set these already; one that rewrites `Host` to the
  upstream must send `X-Forwarded-Host`.
- **Doesn't buffer streams.** Live tables are server-sent events on
  long-lived requests (`/play/[code]/events`,
  `/campaigns/[id]/table-events`). Turn response buffering off and raise
  idle timeouts well past a minute.
- **Accepts large uploads.** Video uploads are up to 100 MB in one
  request.

Caddy does all four with its defaults:

```
retro.example.com {
  reverse_proxy app:1313
}
```

nginx needs them spelled out:

```nginx
location / {
  proxy_pass http://app:1313;
  proxy_set_header Host $host;
  proxy_set_header X-Forwarded-Proto $scheme;
  proxy_http_version 1.1;
  proxy_buffering off;
  proxy_read_timeout 1h;
  client_max_body_size 110m;
}
```

## Backups

Back up the database and the content folder together.

- **Snapshots** of the volume are simplest, if your platform has them.
- **Online copies:** `sqlite3 /data/tabletop.db ".backup /backup/tabletop.db"`
  is safe while the app runs (a plain file copy of a WAL database
  isn't), then copy `/data/content` alongside it.
- **Continuous:** [Litestream](https://litestream.io) can replicate the
  SQLite file to object storage as a sidecar; the content folder still
  needs its own copy.

## A starting point

Not tested as written; adjust for your platform. better-sqlite3 is a
native module, so build the image on the same base it runs on (never
copy `node_modules` from a laptop).

```dockerfile
# Dockerfile
FROM node:24-bookworm-slim AS build
WORKDIR /app
# Fallback for building better-sqlite3 when no prebuilt binary matches.
RUN apt-get update && apt-get install -y --no-install-recommends python3 make g++ \
  && rm -rf /var/lib/apt/lists/*
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM node:24-bookworm-slim
WORKDIR /app
ENV NODE_ENV=production DATABASE_PATH=/data/tabletop.db CONTENT_DIR=/data/content
# Dev dependencies stay in so `npm run db:push` works from this image.
COPY --from=build /app ./
EXPOSE 1313
CMD ["npm", "start"]
```

```
# .dockerignore
node_modules
.next
*.db*
content
.env*
```

```yaml
# compose.yaml
services:
  app:
    build: .
    restart: unless-stopped
    volumes: [data:/data]
  proxy:
    image: caddy:2
    restart: unless-stopped
    ports: ["80:80", "443:443"]
    volumes: [./Caddyfile:/etc/caddy/Caddyfile, caddy:/data]
volumes:
  data:
  caddy:
```

First run, then after any schema change:

```bash
docker compose run --rm app npm run db:push
docker compose up -d
```

## Before it faces the internet

- **Sign-in.** Production has none until you wire an identity provider;
  the dev-only local sign-in is off outside `next dev` and there is
  deliberately no flag to turn it on. See "Auth" in
  [architecture.md](architecture.md) for where SSO plugs in.
- **Abuse limits** on joining, seating and uploads are built in but live
  in process memory and key on `X-Forwarded-For`, so the proxy must set
  it. A proxy-level limit on `POST /` and `/play/` is still worth adding
  as a second layer.
