# Mini Instagram

A MERN stack social photo app built for the final project requirements: Express, MongoDB, Mongoose, JWT auth, Next.js App Router, UploadThing uploads, WebSocket live activity, CRUD resources, search, and Jest tests.

## Features

- JWT register, login, logout, protected API routes and protected frontend pages
- 4 Mongoose models with 5+ fields each: `User`, `Post`, `Comment`, `Tag`
- One-to-many relationship: `User -> Post` and `Post -> Comment`
- Many-to-many relationship: `Post <-> Tag`
- CRUD for posts and comments with owner authorization
- UploadThing flows for profile avatars, post media, and story media
- WebSocket online-user presence, live messages, stories, posts, comments, and notifications using `ws`
- Search/filter posts by caption, location, and tags
- Jest/Supertest backend tests and React Testing Library frontend tests

## Setup

```bash
npm install
cp backend/.env.example backend/.env
cp frontend/.env.example frontend/.env.local
npm run dev:backend
npm run dev:frontend
```

Backend: `http://localhost:4000`

Frontend: `http://localhost:3000`

## Environment Variables

Backend:

```env
PORT=4000
MONGODB_URI=mongodb://127.0.0.1:27017/mini_instagram
JWT_SECRET=replace-with-a-long-secret
CLIENT_ORIGIN=http://localhost:3000
UPLOADTHING_TOKEN=replace-with-uploadthing-token
ENABLE_LOCAL_FALLBACK=false
```

Frontend:

```env
NEXT_PUBLIC_API_URL=http://localhost:4000
NEXT_PUBLIC_WS_URL=ws://localhost:4000
```

`ENABLE_LOCAL_FALLBACK` is a development safety net. Leave it `false` for final/demo deployments so MongoDB is the source of truth. Set it to `true` only when you intentionally want offline JSON fallback files under `backend/data`.

## Tests

```bash
npm test
```

See [TESTING_REPORT.md](./TESTING_REPORT.md) for the required test list.
