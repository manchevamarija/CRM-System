# Vercel frontend deployment

The React application is in `frontend/`; the .NET API is in `backend/`.

## Vercel project settings

Use the existing Vercel project, then set **Settings → General → Root Directory** to `frontend` and save. Vercel will detect Vite and run `npm run build`, publishing `dist/`.

Set `VITE_API_URL` in **Settings → Environment Variables** for Preview and Production. Its value is the public HTTPS API URL without a trailing slash, for example `https://api.example.com`.

The frontend is a single-page app. `frontend/vercel.json` rewrites browser routes to `index.html` so refreshing routes such as `/login` does not return a 404.

## API configuration

This repository's API is .NET 10 and is not a Vercel Function. Host it on a service that supports a persistent .NET application and PostgreSQL, then set:

```text
CORS_ALLOWED_ORIGINS=https://digit-mak-ticketing-system.vercel.app
```

Add any custom frontend domains as comma-separated values. The API uses credentialed requests, so do not configure a wildcard (`*`) CORS origin.
