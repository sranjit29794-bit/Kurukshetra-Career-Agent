import html
import ipaddress
import re
import socket
from typing import Optional, Tuple
from urllib.parse import urlparse
import httpx


# SSRF / Dangerous IP check
def is_safe_url(url: str) -> Tuple[bool, Optional[str]]:
    """Validates that a URL uses http/https and does not resolve to private,

    loopback, link-local, multicast, or reserved networks.
    """
    try:
        parsed = urlparse(url)
    except Exception:
        return False, "Malformed URL"

    if parsed.scheme.lower() not in ("http", "https"):
        return False, "Only HTTP and HTTPS URLs are permitted"

    hostname = parsed.hostname
    if not hostname:
        return False, "URL must include a valid hostname"

    # Reject localhost directly
    if hostname.lower() in ("localhost", "127.0.0.1", "::1"):
        return False, "Access to localhost is blocked"

    # Resolve IP address to prevent DNS rebinding to internal addresses
    try:
        # getaddrinfo resolves IPv4 and IPv6
        addr_info = socket.getaddrinfo(hostname, None)
        for family, _, _, _, sockaddr in addr_info:
            ip_str = sockaddr[0]
            ip_obj = ipaddress.ip_address(ip_str)

            if ip_obj.is_loopback:
                return False, "Destination resolves to a loopback address"
            if ip_obj.is_private:
                return False, "Destination resolves to a private network address"
            if ip_obj.is_link_local:
                return False, "Destination resolves to a link-local address"
            if ip_obj.is_multicast:
                return False, "Destination resolves to a multicast address"
            if ip_obj.is_reserved:
                return False, "Destination resolves to a reserved network address"
    except socket.gaierror:
        return False, f"Could not resolve host '{hostname}'"
    except Exception as e:
        return False, f"IP validation error: {str(e)}"

    return True, None


def clean_html_to_text(raw_html: str) -> str:
    """Safely extracts text content from HTML without executing any scripts

    or relying on external C-bindings. Removes script, style, nav, footer,
    and returns normalized visible text.
    """
    # 1. Remove script, style, head, noscript, and iframe tags entirely
    cleaned = re.sub(r"<(script|style|head|noscript|iframe)[^>]*>.*?</\1>", " ", raw_html, flags=re.DOTALL | re.IGNORECASE)

    # 2. Convert common block breaks to newlines before stripping tags
    cleaned = re.sub(r"<(p|br|div|li|h1|h2|h3|h4|h5|h6|tr|section|article)[^>]*>", "\n", cleaned, flags=re.IGNORECASE)

    # 3. Strip all remaining tags
    cleaned = re.sub(r"<[^>]+>", " ", cleaned)

    # 4. Decode HTML entities (&amp;, &nbsp;, &#39;, etc.)
    cleaned = html.unescape(cleaned)

    # 5. Normalize whitespace and collapse excessive blank lines
    lines = [re.sub(r"[ \t]+", " ", line).strip() for line in cleaned.splitlines()]
    non_empty_lines = [line for line in lines if line]
    return "\n".join(non_empty_lines)


class JobFetchError(Exception):
    def __init__(self, code: str, message: str, retryable: bool = False):
        self.code = code
        self.message = message
        self.retryable = retryable
        super().__init__(message)


async def fetch_job_page(url: str, max_bytes: int = 2_000_000, timeout_s: float = 12.0) -> str:
    """Safely fetches a job posting web page with timeout, max byte cap,

    redirect safety validation, and safe text extraction.
    """
    # Initial URL validation
    is_safe, reason = is_safe_url(url)
    if not is_safe:
        raise JobFetchError("UNSAFE_URL", f"Security rejection: {reason}", retryable=False)

    headers = {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36 (DevProof Bot)",
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,text/plain;q=0.8,*/*;q=0.7",
        "Accept-Language": "en-US,en;q=0.9",
    }

    current_url = url
    total_bytes = 0
    content_chunks = []

    # Custom redirect loop to validate each hop against SSRF
    async with httpx.AsyncClient(timeout=timeout_s, follow_redirects=False) as client:
        for _ in range(5):  # Max 5 redirects
            try:
                response = await client.get(current_url, headers=headers)
            except httpx.TimeoutException:
                raise JobFetchError("FETCH_TIMEOUT", "Request to job posting timed out.", retryable=True)
            except httpx.RequestError as e:
                raise JobFetchError("FETCH_FAILED", f"Network error fetching job posting: {str(e)}", retryable=True)

            if response.is_redirect:
                redirect_url = response.headers.get("location")
                if not redirect_url:
                    raise JobFetchError("INVALID_REDIRECT", "Redirect response missing Location header.", retryable=False)

                # Resolve relative redirects
                parsed_orig = urlparse(current_url)
                if not redirect_url.startswith("http://") and not redirect_url.startswith("https://"):
                    redirect_url = f"{parsed_orig.scheme}://{parsed_orig.netloc}/{redirect_url.lstrip('/')}"

                # Re-validate destination against SSRF
                is_safe, reason = is_safe_url(redirect_url)
                if not is_safe:
                    raise JobFetchError("UNSAFE_REDIRECT", f"Redirect to unsafe destination blocked: {reason}", retryable=False)

                current_url = redirect_url
                continue

            # Non-redirect response reached
            if response.status_code >= 400:
                if response.status_code == 403:
                    raise JobFetchError(
                        "ANTI_BOT_BLOCKED",
                        "The job posting site returned 403 Forbidden (anti-bot or protected page). Please use pasted job description text.",
                        retryable=False,
                    )
                if response.status_code == 404:
                    raise JobFetchError("JOB_NOT_FOUND", "The job posting page was not found (404).", retryable=False)
                raise JobFetchError(
                    f"HTTP_{response.status_code}",
                    f"Failed to fetch job posting (HTTP {response.status_code}).",
                    retryable=response.status_code in (408, 429, 500, 502, 503, 504),
                )

            # Content type check
            content_type = response.headers.get("content-type", "").lower()
            if not any(t in content_type for t in ("text/html", "text/plain", "application/xhtml+xml")):
                raise JobFetchError(
                    "INVALID_CONTENT_TYPE",
                    f"Unsupported content type '{content_type}'. DevProof expects an HTML or text job posting.",
                    retryable=False,
                )

            # Response size check
            raw_body = response.content
            if len(raw_body) > max_bytes:
                raise JobFetchError(
                    "RESPONSE_TOO_LARGE",
                    f"Job posting exceeded maximum allowed size ({len(raw_body)} bytes > {max_bytes} bytes).",
                    retryable=False,
                )

            raw_text = raw_body.decode(response.encoding or "utf-8", errors="replace")
            cleaned_text = clean_html_to_text(raw_text)

            if len(cleaned_text.strip()) < 50:
                raise JobFetchError(
                    "EMPTY_JOB_CONTENT",
                    "Fetched job page contained insufficient readable text. Please paste the job description text directly.",
                    retryable=False,
                )

            return cleaned_text

        raise JobFetchError("TOO_MANY_REDIRECTS", "Exceeded maximum redirect hops (5).", retryable=False)
