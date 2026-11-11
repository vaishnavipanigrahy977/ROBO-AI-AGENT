import base64
import io
import json
import threading
import unittest
import xml.etree.ElementTree as ET
from http.server import ThreadingHTTPServer
from unittest.mock import patch
from urllib.error import HTTPError
from urllib.request import Request, urlopen

import server


class PublicSourceTests(unittest.TestCase):
    def test_wikipedia_search_returns_article_summaries_and_links(self):
        search_response = {
            "query": {"search": [
                {"title": "Water cycle", "pageid": 123, "snippet": "The water cycle."},
            ]}
        }
        summary_response = {"extract": "Water moves around Earth in a continuous cycle."}
        with patch("server.fetch_json", side_effect=[search_response, summary_response]) as fetch:
            results = server.search_wikipedia("water cycle")

        self.assertEqual(len(results), 1)
        self.assertEqual(results[0]["text"], summary_response["extract"])
        self.assertEqual(results[0]["url"], "https://en.wikipedia.org/?curid=123")
        fetch.assert_called()

    def test_news_search_reads_feed_entries_and_publishers(self):
        feed = ET.fromstring("""<rss><channel><item>
            <title>World update</title><link>https://news.google.com/articles/example</link>
            <description><![CDATA[<p>A current event.</p>]]></description>
            <source>Example News</source><pubDate>Tue, 10 Nov 2026 10:00:00 GMT</pubDate>
        </item></channel></rss>""")
        with patch("server.fetch_xml", return_value=feed):
            results = server.search_news("world news")

        self.assertEqual(results[0]["title"], "World update")
        self.assertEqual(results[0]["publisher"], "Example News")
        self.assertEqual(results[0]["text"], "A current event.")
        self.assertEqual(results[0]["url"], "https://news.google.com/articles/example")

    def test_search_combines_free_sources_and_includes_citations(self):
        articles = [{"title": "Topic", "text": "An encyclopedia summary.", "url": "https://en.wikipedia.org/?curid=1", "publisher": "Wikipedia"}]
        news = [{"title": "Latest event", "text": "A news summary.", "url": "https://news.google.com/item", "publisher": "Example", "publishedAt": "Today"}]
        with patch("server.search_wikipedia", return_value=articles), patch("server.search_news", return_value=news):
            result = server.search_sources("Tell me about this")

        self.assertIn("An encyclopedia summary.", result["text"])
        self.assertIn("Latest event", result["text"])
        self.assertEqual([source["url"] for source in result["sources"]], [articles[0]["url"], news[0]["url"]])
        self.assertIn("searchedAt", result)

    def test_search_still_works_if_one_public_source_is_unavailable(self):
        articles = [{"title": "Topic", "text": "A useful summary.", "url": "https://en.wikipedia.org/?curid=1", "publisher": "Wikipedia"}]
        with patch("server.search_wikipedia", return_value=articles), patch(
            "server.search_news", side_effect=HTTPError("https://news.google.com", 429, "Rate limited", {}, None)
        ):
            result = server.search_sources("Some topic")

        self.assertIn("news search is temporarily unavailable", result["text"])
        self.assertEqual(len(result["sources"]), 1)

    def test_search_fails_explicitly_if_both_sources_are_unavailable(self):
        with patch("server.search_wikipedia", side_effect=TimeoutError()), patch(
            "server.search_news", side_effect=TimeoutError()
        ):
            with self.assertRaisesRegex(RuntimeError, "sources are temporarily unavailable"):
                server.search_sources("Some topic")


class ServerEndpointTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.httpd = ThreadingHTTPServer(("127.0.0.1", 0), server.RoboHandler)
        cls.thread = threading.Thread(target=cls.httpd.serve_forever, daemon=True)
        cls.thread.start()
        cls.base_url = f"http://127.0.0.1:{cls.httpd.server_port}"

    @classmethod
    def tearDownClass(cls):
        cls.httpd.shutdown()
        cls.httpd.server_close()
        cls.thread.join(timeout=3)

    def post_chat(self, payload):
        request = Request(
            self.base_url + "/api/chat",
            data=json.dumps(payload).encode(),
            headers={"Content-Type": "application/json"},
            method="POST",
        )
        try:
            return urlopen(request, timeout=3)
        except HTTPError as error:
            return error

    def post_auth(self, payload, origin=None):
        request = Request(
            self.base_url + "/api/auth/exchange",
            data=json.dumps(payload).encode(),
            headers={
                "Content-Type": "application/json",
                "Origin": origin or self.base_url,
            },
            method="POST",
        )
        try:
            return urlopen(request, timeout=3)
        except HTTPError as error:
            return error

    def post_image(self, payload):
        request = Request(
            self.base_url + "/api/image",
            data=json.dumps(payload).encode(),
            headers={"Content-Type": "application/json"},
            method="POST",
        )
        try:
            return urlopen(request, timeout=3)
        except HTTPError as error:
            return error

    def test_health_reports_no_api_key_requirement(self):
        response = urlopen(self.base_url + "/api/health", timeout=3)
        health = json.loads(response.read())

        self.assertTrue(health["ok"])
        self.assertEqual(health["mode"], "public-source-search")
        self.assertFalse(health["apiKeyRequired"])

    def test_image_config_does_not_expose_api_key(self):
        with patch.dict("os.environ", {"GEMINI_API_KEY": "server-only-secret"}):
            response = urlopen(self.base_url + "/api/image/config", timeout=3)
            body = response.read().decode()

        self.assertEqual(json.loads(body), {"configured": True})
        self.assertNotIn("server-only-secret", body)

    def test_image_generation_uses_gemini_and_returns_image_data(self):
        generated = {"data": base64.b64encode(b"image-bytes").decode(), "mimeType": "image/png"}
        with patch.dict("os.environ", {"GEMINI_API_KEY": "server-only-secret"}), patch(
            "server.generate_gemini_image", return_value=generated
        ) as generate:
            response = self.post_image({"prompt": "A village with two huts"})

        self.assertEqual(response.code, 200)
        self.assertEqual(json.loads(response.read()), generated)
        generate.assert_called_once_with("A village with two huts")

    def test_image_generation_uses_local_fallback_when_api_key_is_missing(self):
        with patch.dict("os.environ", {}, clear=True):
            response = self.post_image({"prompt": "A red fox"})

        self.assertEqual(response.code, 503)
        result = json.loads(response.read())
        self.assertFalse(result["configured"])

    def test_image_generation_reports_quota_limit_without_leaking_provider_details(self):
        quota_error = HTTPError(
            "https://generativelanguage.googleapis.com", 429, "Rate limited", {}, None
        )
        with patch.dict("os.environ", {"GEMINI_API_KEY": "server-only-secret"}), patch(
            "server.generate_gemini_image", side_effect=quota_error
        ):
            response = self.post_image({"prompt": "A red fox with a red hat"})

        self.assertEqual(response.code, 429)
        result = json.loads(response.read())
        self.assertIn("quota", result["error"].lower())
        self.assertNotIn("server-only-secret", json.dumps(result))

    def test_image_generation_rejects_violent_prompts_before_calling_provider(self):
        with patch.dict("os.environ", {"GEMINI_API_KEY": "server-only-secret"}), patch(
            "server.generate_gemini_image"
        ) as generate:
            response = self.post_image({"prompt": "A graphic bloody fight"})

        self.assertEqual(response.code, 400)
        self.assertIn("violence", json.loads(response.read())["error"])
        generate.assert_not_called()

    def test_gemini_request_keeps_key_in_header_and_validates_image_response(self):
        response_body = json.dumps({
            "output_image": {
                "data": base64.b64encode(b"image-bytes").decode(),
                "mime_type": "image/webp",
            }
        }).encode()

        class FakeResponse:
            def __enter__(self):
                return self

            def __exit__(self, *_args):
                return False

            def read(self):
                return response_body

        fake_response = FakeResponse()
        with patch.dict("os.environ", {"GEMINI_API_KEY": "server-only-secret"}), patch(
            "server.urlopen", return_value=fake_response
        ) as open_url:
            result = server.generate_gemini_image("A red fox in a garden")

        request = open_url.call_args.args[0]
        self.assertEqual(request.full_url, "https://generativelanguage.googleapis.com/v1beta/interactions")
        self.assertEqual(request.get_header("X-goog-api-key"), "server-only-secret")
        self.assertEqual(request.get_header("Api-revision"), "2026-05-20")
        self.assertEqual(json.loads(request.data)["model"], "gemini-nano-banana-2.1")
        self.assertEqual(result["mimeType"], "image/webp")
        self.assertEqual(base64.b64decode(result["data"]), b"image-bytes")

    def test_auth_config_disables_unconfigured_providers(self):
        response = urlopen(self.base_url + "/api/auth/config", timeout=3)
        config = json.loads(response.read())

        self.assertEqual(config["redirectUri"], self.base_url + "/")
        self.assertFalse(config["providers"]["google"]["configured"])
        self.assertFalse(config["providers"]["microsoft"]["configured"])

    def test_oauth_exchange_sets_session_cookie_and_session_endpoint_reads_it(self):
        profile = {"signedIn": True, "provider": "Google", "displayName": "Ada", "email": "ada@example.com"}
        with patch.dict("os.environ", {"GOOGLE_CLIENT_ID": "public-id", "GOOGLE_CLIENT_SECRET": "server-secret"}), patch(
            "server.fetch_oauth_token", return_value=profile
        ) as exchange:
            response = self.post_auth({
                "provider": "google",
                "code": "authorization-code",
                "codeVerifier": "v" * 43,
                "redirectUri": self.base_url + "/",
            })

        self.assertEqual(response.code, 200)
        self.assertEqual(json.loads(response.read()), profile)
        self.assertIn("HttpOnly", response.headers["Set-Cookie"])
        exchange.assert_called_once()

        request = Request(
            self.base_url + "/api/auth/session",
            headers={"Cookie": response.headers["Set-Cookie"].split(";", 1)[0]},
        )
        session = json.loads(urlopen(request, timeout=3).read())
        self.assertEqual(session["email"], "ada@example.com")
        self.assertNotIn("expiresAt", session)

    def test_oauth_exchange_rejects_cross_origin_request(self):
        response = self.post_auth({}, origin="https://attacker.example")

        self.assertEqual(response.code, 403)

    def test_auth_session_rejects_tampered_session_cookie(self):
        request = Request(
            self.base_url + "/api/auth/session",
            headers={"Cookie": "robo_session=eyJzaWduZWRJbiI6dHJ1ZX0.invalid"},
        )
        session = json.loads(urlopen(request, timeout=3).read())

        self.assertEqual(session, {"signedIn": False})

    def test_chat_endpoint_searches_latest_user_question_without_api_key(self):
        result = {"text": "Found this.", "sources": []}
        with patch("server.search_sources", return_value=result) as search:
            response = self.post_chat({"messages": [
                {"role": "user", "text": "Hello"},
                {"role": "assistant", "text": "Hi there."},
                {"role": "user", "text": "What is in today's news?"},
            ]})

        self.assertEqual(response.code, 200)
        self.assertEqual(json.loads(response.read()), result)
        search.assert_called_once_with("What is in today's news?")

    def test_chat_endpoint_validates_messages(self):
        response = self.post_chat({"messages": [{"role": "system", "text": "bad role"}]})

        self.assertEqual(response.code, 400)
        self.assertIn("invalid message", json.loads(response.read())["error"])

    def test_chat_endpoint_rejects_non_object_json(self):
        request = Request(
            self.base_url + "/api/chat",
            data=b"[]",
            headers={"Content-Type": "application/json"},
            method="POST",
        )
        with self.assertRaises(HTTPError) as error:
            urlopen(request, timeout=3)

        self.assertEqual(error.exception.code, 400)
        self.assertIn("JSON object", json.loads(error.exception.read())["error"])
        error.exception.close()


if __name__ == "__main__":
    unittest.main()
