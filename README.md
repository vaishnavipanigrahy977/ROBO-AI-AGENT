# ROBO — AI Learning Companion

A responsive ROBO chat workspace with local chat history, chat search, student profiles, explanation-style preferences, response-language settings, light/dark themes, and an immersive-exploration gallery inside the **Students** section. The gallery has exactly 20 curated topics and these six filters, in order: **All**, **How Things Work**, **Space**, **Human Body**, **Nature**, and **History**. The Freshwater Swamp Ecosystem is featured; each topic card opens its own illustrated scene with four guided learning stops and interactive hotspots. Chat searches the configured web source, cites results, refuses sensitive-content requests, supports programming help through Gemini, and accepts up to 15 supported file attachments for analysis and summaries.

The supplied `robo-icon.ico` is used for the app icon, splash screen, and ROBO identity marks. Light and dark themes update the interface palette and text contrast across the workspace, forms, and dialogs.

## Run locally

ROBO searches Google Programmable Search for general questions when configured, or uses Wikipedia as a public fallback; current-news requests use Google News. Gemini synthesizes answers from relevant retrieved sources and the selected response language when configured. Without Gemini, ROBO gives a concise answer from a matching source and clearly identifies that source-based fallback; coding requests explain when code generation is not configured instead of returning unrelated search snippets. Basic arithmetic is computed locally. Gemini chat and image generation use the server-side `GEMINI_API_KEY`; keep the key server-side—never add it to frontend code. Start the app from the repository directory:

```powershell
python -m pip install -r requirements.txt
python server.py
```

Then visit `http://127.0.0.1:8765/`. Set `GEMINI_API_KEY` on the server for general AI responses and code generation in the language requested by the user. You can optionally set `GEMINI_TEXT_MODEL` to choose a Gemini text model; the default is `gemini-2.5-flash`. For Google Search results, create a [Programmable Search Engine](https://programmablesearchengine.google.com/) configured to search the web, enable the [Custom Search JSON API](https://developers.google.com/custom-search/v1/overview), and set `GOOGLE_SEARCH_API_KEY` and `GOOGLE_SEARCH_ENGINE_ID` on the server. Without those settings, ROBO clearly uses Wikipedia as its public-search fallback. These credentials stay server-side; never add them to frontend code. Google API quota and pricing limits apply.

General factual questions use Google Programmable Search when configured, otherwise public Wikipedia search; current-news requests use Google News. ROBO cleans common question phrasing, ranks matches against the requested topic, and includes source links. This requires internet access; ROBO reports a source error if search is unavailable. Gemini can make mistakes, so verify important factual, mathematical, and programming output. Sensitive-content and explicit sexual-content requests receive the refusal `I cannot generate these types of content.` Benign informational questions such as health-risk questions are not refused just because they mention a sensitive topic. The content filter is keyword-based and is not a substitute for supervision.

The chat plus button accepts up to 15 files, limited to 1 MB per file and 5 MB total. It extracts text from UTF-8/source files, PDF, DOCX, XLSX, PPTX, OpenDocument, RTF, and EML files; PNG, JPEG, WebP, GIF, and common audio/video formats can be analyzed by Gemini. Extracted text is capped at 1 MB total. Files are never executed. Without Gemini, ROBO can make extractive summaries of files whose text it can read; multimodal file analysis requires `GEMINI_API_KEY`. The Settings section lets users choose a response language; Gemini-generated answers use that selection. Search-source excerpts and fixed safety responses remain in their original language. No application can parse every possible proprietary, encrypted, damaged, or uncommon file format; unsupported or unreadable files are reported instead of being summarized as if they were understood. Chat history, student profiles, and preferences are stored in the browser.

### Gemini API key

Create a Gemini API key in [Google AI Studio](https://aistudio.google.com/apikey) and add it as the server environment variable `GEMINI_API_KEY` (Railway: Service → Variables). This is separate from the Google OAuth client ID and secret used for sign-in. For local PowerShell testing:

```powershell
$env:GEMINI_API_KEY = "your-key-from-ai-studio"
python server.py
```

ROBO uses the key for general chat and image generation. The general chat uses Google's Gemini `generateContent` API. Requests from every user of a deployment that shares this key use that Google project's quota and may incur charges if its applicable free quota or access is exceeded. Check Google's [current API pricing and free-tier eligibility](https://ai.google.dev/gemini-api/docs/pricing) before configuring a key.

### Gemini image generation

ROBO calls Google's `gemini-nano-banana-2.1` image-generation API from the Python server, so the key is not exposed to browsers. Requests from every user of a deployment that shares this key use that Google project’s quota and may incur charges if its applicable free quota or access is exceeded. The free Gemini consumer app does not mean API image generation is unlimited or always free; check Google's [current API pricing and free-tier eligibility](https://ai.google.dev/gemini-api/docs/pricing) before configuring a key. The server limits prompts to 2,000 characters, applies a basic violence-related keyword block, and caps image requests at five per IP per minute. Google’s own API safety filters also apply. Generated images are kept in the user's browser chat history and can be downloaded.

Without a configured Gemini key, prompts fall back to local, template-guided SVG illustrations. These are free and original, but cannot faithfully depict arbitrary descriptions; they are not a generative image model. Local images can be downloaded as SVG files. The violence keyword block is not a comprehensive safety classifier.

The **ROBO Generations** section in the left navigation links to [Craiyon](https://www.craiyon.com/en) as an external service. Craiyon could not be verified to provide a supported public API, so the launch button navigates to its website; ROBO does not send prompts to Craiyon or import its generated media.

The Scheduled clock has ten locally synthesized alarm sounds. Select a sound under **Settings → Alarm sound** to save it and hear a five-second preview; alarms and timer completion use the selected sound. The timer accepts hours, minutes, and seconds up to a five-hour maximum.

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

Only configure the providers you intend to offer. Use the same exact root redirect URL in the provider console and `ROBO_PUBLIC_URL`; for Railway, use the currently provisioned public domain, not an old generated `*.up.railway.app` domain. If `ROBO_PUBLIC_URL` points to a different generated Railway domain, ROBO uses the active request domain instead. Add that active origin and exact root redirect URI to the provider console, then redeploy. For local development, the default is `http://127.0.0.1:8765/`. Never put client secrets in frontend files. Without provider credentials, the buttons remain disabled rather than pretending to sign a user in. Continuing as a guest remains available.

Railway can use the included `Procfile` (`python server.py`). The server reads Railway's `PORT` environment variable and binds to `0.0.0.0`; no package installation is required.
