# RemyInk Frontend

Next.js 16 frontend for the RemyInk marketplace.

## Scripts

- `npm run dev` starts the local dev server.
- `npm run build` creates the production build.
- `npm run start` serves the production build.
- `npm run lint` runs ESLint.

## Environment

Create a local env file from `.env.example`.

- `NEXT_PUBLIC_API_BASE_URL`: Public API base URL for HTTP requests. In production this should point at your backend origin or API base. In local development the app can fall back to `http://127.0.0.1:8000` when running on localhost.
- `NEXT_PUBLIC_WS_HOST`: Optional websocket host override. Set this when websocket traffic must use a host different from `NEXT_PUBLIC_API_BASE_URL`.

## Production Checklist

- Set `NEXT_PUBLIC_API_BASE_URL` in the deployment environment.
- Set `NEXT_PUBLIC_WS_HOST` if websocket traffic is served from a separate host.
- Run `npm install` to ensure all dev tooling is present.
- Run `npm run lint` and `npm run build` before release.
- Serve the app with `npm run start` behind your production reverse proxy or hosting platform.

## Notes

- API URL handling now strips a trailing `/api` automatically.
- If `NEXT_PUBLIC_API_BASE_URL` is omitted outside local localhost development, the app will use relative paths for browser requests.
