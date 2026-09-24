# API Development

## Local URLs

- Backend: `http://localhost:8080`
- Frontend: `http://localhost:3000`
- Swagger UI: `http://localhost:8080/swagger-ui.html`
- OpenAPI JSON: `http://localhost:8080/v3/api-docs`

## Frontend API Base URL

The frontend reads `NEXT_PUBLIC_API_BASE_URL` through the centralized helper in `frontend/lib/api.ts`. For local development, copy `frontend/.env.example` to `frontend/.env.local`:

```dotenv
NEXT_PUBLIC_API_BASE_URL=http://localhost:8080
```

Use `API_BASE_URL`, `apiUrl`, or `apiFetch` from the helper instead of hardcoding the backend URL in frontend code. Because this variable uses the `NEXT_PUBLIC_` prefix, its value is included in the browser bundle and must not contain a secret.

## Local Development Flow

1. Start the Spring Boot backend from `backend`; it listens on port `8080`.
2. Copy `frontend/.env.example` to `frontend/.env.local` if it does not already exist.
3. Start the Next.js frontend from `frontend`; it listens on port `3000`.
4. Use Swagger UI or the OpenAPI JSON contract to inspect the backend API while developing and testing frontend integrations.
5. Stop both processes when local development is complete.

`localhost` on each developer machine refers to that developer's own machine. Each developer must run or otherwise expose the backend and frontend on their own machine at the configured URLs.

The frontend must call the Spring Boot REST API. It must not call Supabase directly.
