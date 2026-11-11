# ROBO — AI Learning Companion

A responsive ROBO chat workspace with local chat history, chat search, student profiles, explanation-style preferences, light/dark themes, and an immersive-exploration gallery inside the **Students** section. The gallery has exactly 20 curated topics and these six filters, in order: **All**, **How Things Work**, **Space**, **Human Body**, **Nature**, and **History**. The Freshwater Swamp Ecosystem is featured; each topic card opens its own illustrated scene with four guided learning stops and interactive hotspots.

## Run locally

ROBO does not use Gemini, a paid AI model, or any secret API key. Start it from the repository directory:

```powershell
python server.py
```

Then visit `http://127.0.0.1:8765/`. For each question, ROBO searches Wikipedia's public article endpoints and Google News' public RSS search, then shows source links and available excerpts. These are public, no-key web endpoints—not a local, offline, all-world knowledge database. They require internet access and can be temporarily unavailable or rate-limited.

This is a source-search tool, not a generative AI model or a complete index of the world's knowledge. It cannot guarantee answers for every question or synthesize arbitrary information like Gemini or ChatGPT; it finds and presents relevant public-source material, and it reports when search sources are unavailable. A greeting such as “hi” gets a direct friendly reply. Chat history, student profiles, and preferences are stored in the browser. There is no build step or external Python package dependency.

## Real sign-in setup

Google and Microsoft sign-in use OAuth authorization-code flow with PKCE. The user enters their password only on the provider's own sign-in page. ROBO exchanges the authorization code on its server, verifies the profile with the provider, and keeps a signed, HTTP-only session cookie; provider passwords and tokens are never stored in the browser or ROBO.

Real provider sign-in is disabled until credentials are configured:

- **Google:** Create a Web application OAuth client in Google Cloud. Add the app origin to Authorized JavaScript origins and the exact root URL (for example `http://127.0.0.1:8765/`) to Authorized redirect URIs.
- **Microsoft:** Register a web app in Microsoft Entra and add the exact root URL as a Web redirect URI. Enable the account types you want to support.

Set these server environment variables (Railway: Service → Variables):

```text
GOOGLE_CLIENT_ID=...
GOOGLE_CLIENT_SECRET=...
MICROSOFT_CLIENT_ID=...
MICROSOFT_CLIENT_SECRET=...
ROBO_PUBLIC_URL=https://your-deployed-domain/
ROBO_SESSION_SECRET=<a long random secret>
```

Only configure the providers you intend to offer. Use the same exact root redirect URL in the provider console and `ROBO_PUBLIC_URL`; for local development, the default is `http://127.0.0.1:8765/`. Never put client secrets in frontend files. Without provider credentials, the buttons remain disabled rather than pretending to sign a user in. Continuing as a guest remains available.

Railway can use the included `Procfile` (`python server.py`). The server reads Railway's `PORT` environment variable and binds to `0.0.0.0`; no model API key or package installation is required.
