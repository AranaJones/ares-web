# Ares Web Chat

Web chat client wired to an Ares Galaxy OpenAI-compatible endpoint.

## Setup

```
npm install
ARES_GALAXY_API_KEY=your-key npm start
```

Open http://localhost:3000.

## Configuration (environment variables)

| Variable | Default | Description |
|---|---|---|
| `ARES_GALAXY_BASE_URL` | `https://api.aresgalaxy.ai` | API base URL (placeholder default; override with your endpoint) |
| `ARES_GALAXY_CHAT_PATH` | `/v1/chat/completions` | Chat completions path |
| `ARES_GALAXY_MODEL` | `ares-galaxy-default` | Model name |
| `ARES_GALAXY_API_KEY` | _(empty)_ | Sent as a ****** in the `Authorization` header |
| `ARES_GALAXY_TEMPERATURE` | `0.7` | Sampling temperature |
| `PORT` | `3000` | Server port |

Example: `ARES_GALAXY_BASE_URL=https://api.example.com ARES_GALAXY_MODEL=my-model ARES_GALAXY_API_KEY=sk-... npm start`

## Security

The browser calls `POST /api/chat` on this server, which forwards to Ares Galaxy
and adds the API key server-side. The key is never sent to the browser and CORS
is not an issue. Never commit keys; set them in the environment.
