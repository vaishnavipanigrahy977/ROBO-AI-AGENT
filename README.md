# ROBO — AI Learning Companion

A responsive ROBO chat workspace with local chat history, chat search, student profiles, explanation-style preferences, light/dark themes, and an immersive-exploration gallery inside the **Students** section. The gallery has exactly 20 curated topics and these six filters, in order: **All**, **How Things Work**, **Space**, **Human Body**, **Nature**, and **History**. The Freshwater Swamp Ecosystem is featured; each topic card opens its own illustrated scene with four guided learning stops and interactive hotspots.

## Run locally

ROBO's public-source chat works without a model API key. Image prompts use Gemini image generation when `GEMINI_API_KEY` is configured on the server; otherwise ROBO shows its local vector preview. Keep the key server-side—never add it to frontend code. Start the app from the repository directory:

```powershell
python server.py
```

Then visit `http://127.0.0.1:8765/`. For each question, ROBO searches Wikipedia's public article endpoints and Google News' public RSS search, then shows source links and available excerpts. These are public, no-key web endpoints—not a local, offline, all-world knowledge database. They require internet access and can be temporarily unavailable or rate-limited.

This is a source-search tool, not a generative AI model or a complete index of the world's knowledge. It cannot guarantee answers for every question or synthesize arbitrary information like Gemini or ChatGPT; it finds and presents relevant public-source material, and it reports when search sources are unavailable. A greeting such as “hi” gets a direct friendly reply. Chat history, student profiles, and preferences are stored in the browser. There is no build step or external Python package dependency.

### Gemini image generation

Create a Gemini API key in [Google AI Studio](https://aistudio.google.com/apikey) and add it as the server environment variable `GEMINI_API_KEY` (Railway: Service → Variables). This is separate from the Google OAuth client ID and secret used for sign-in. For local PowerShell testing:

```powershell
$env:GEMINI_API_KEY = "your-key-from-ai-studio"
python server.py
```

ROBO calls Google's `gemini-nano-banana-2.1` image-generation API from the Python server, so the key is not exposed to browsers. Requests from every user of a deployment that shares this key use that Google project’s quota and may incur charges if its applicable free quota or access is exceeded. The free Gemini consumer app does not mean API image generation is unlimited or always free; check Google's [current API pricing and free-tier eligibility](https://ai.google.dev/gemini-api/docs/pricing) before configuring a key. The server limits prompts to 2,000 characters, applies a basic violence-related keyword block, and caps image requests at five per IP per minute. Google’s own API safety filters also apply. Generated images are kept in the user's browser chat history and can be downloaded.

Without a configured Gemini key, prompts fall back to local, template-guided SVG illustrations. These are free and original, but cannot faithfully depict arbitrary descriptions; they are not a generative image model. Local images can be downloaded as SVG files. The violence keyword block is not a comprehensive safety classifier.

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

Railway can use the included `Procfile` (`python server.py`). The server reads Railway's `PORT` environment variable and binds to `0.0.0.0`; no package installation is required.
