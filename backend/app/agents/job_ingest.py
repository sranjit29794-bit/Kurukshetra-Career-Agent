"""Job Ingestion Agent for Greenhouse, Lever, and pasted postings.

Reference: docs/BRAIN.md (§11, §12) and docs/PLAN-5H.md (Phase IN-2).
Invariants:
- Greenhouse boards API: boards-api.greenhouse.io/v1/boards/{token}/jobs/{id}
- Lever postings API: api.lever.co/v0/postings/{site}/{id} (with EU fallback)
- LinkedIn: login wall fallback to "paste the text"
- Paste path: labeled "User-provided", source URL preserved and visible
- Fetched path: labeled "Fetched" with dated snapshot
- Clean error envelope: {error: {code, message, retryable}}
"""

from __future__ import annotations

import html
import logging
import re
import urllib.parse
import uuid
from datetime import UTC, datetime
from typing import Any

import httpx

from backend.app.schemas import JobDraft, Priority, RequirementIn, SourceType

logger = logging.getLogger(__name__)

# Standard skill keyword definitions for taxonomy mapping
TAXONOMY_PATTERNS: list[tuple[str, str, str, list[str]]] = [
    (
        "python_lang",
        "Python",
        "Language",
        [
            r"\bpython\b",
            r"\bpydantic\b",
            r"\basyncio\b",
            r"\bobject-oriented\b",
            r"\btyping\b",
        ],
    ),
    (
        "rest_api",
        "FastAPI / REST APIs",
        "Backend",
        [
            r"\bfastapi\b",
            r"\brest\b",
            r"\bapi\b",
            r"\bapis\b",
            r"\bflask\b",
            r"\bdjango\b",
            r"\bexpress\b",
            r"\bendpoints?\b",
            r"\bservice-oriented\b",
        ],
    ),
    (
        "sql_database",
        "SQL",
        "Database",
        [
            r"\bsql\b",
            r"\bpostgresql\b",
            r"\bpostgres\b",
            r"\bmysql\b",
            r"\bsqlite\b",
            r"\bdatabases?\b",
            r"\bqueries\b",
            r"\bquerying\b",
        ],
    ),
    (
        "testing",
        "Testing",
        "Quality Assurance",
        [
            r"\bpytest\b",
            r"\bunit test(?:ing)?\b",
            r"\bintegration test(?:ing)?\b",
            r"\btesting\b",
            r"\btests?\b",
            r"\btest coverage\b",
        ],
    ),
    (
        "deployment",
        "Deployment",
        "DevOps",
        [
            r"\bdocker\b",
            r"\bdockerfile\b",
            r"\bcontainers?\b",
            r"\bcontainerize\b",
            r"\bdeploy(?:ment|ments|ing)?\b",
            r"\bkubernetes\b",
            r"\brender\.yaml\b",
            r"\bprocfile\b",
            r"\baws\b",
            r"\blive deployments?\b",
        ],
    ),
    (
        "ci_cd",
        "CI/CD (GitHub Actions)",
        "DevOps",
        [
            r"\bci/cd\b",
            r"\bcontinuous integration\b",
            r"\bcontinuous delivery\b",
            r"\bgithub actions\b",
            r"\bpipelines?\b",
            r"\bworkflows?\b",
        ],
    ),
    (
        "auth",
        "Authentication & Security",
        "Security",
        [
            r"\boauth(?:2)?\b",
            r"\bauthentication\b",
            r"\bauthorization\b",
            r"\bjwt\b",
            r"\btokens?\b",
            r"\bsecurity\b",
        ],
    ),
    (
        "git",
        "Version Control (Git)",
        "Core Engineering",
        [
            r"\bgit\b",
            r"\bversion control\b",
            r"\bgithub\b",
            r"\bpull requests?\b",
        ],
    ),
]

_NICE_TO_HAVE_REGEX = re.compile(
    r"\b(preferred|nice to have|plus|bonus|optional|not required|desired|advantage)\b",
    re.IGNORECASE,
)


class JobIngestError(Exception):
    """Normalized job ingestion error adhering to BRAIN §13."""

    def __init__(
        self,
        code: str,
        message: str,
        retryable: bool = False,
        status_code: int = 400,
    ) -> None:
        super().__init__(message)
        self.code = code
        self.message = message
        self.retryable = retryable
        self.status_code = status_code

    def to_dict(self) -> dict[str, Any]:
        return {
            "error": {
                "code": self.code,
                "message": self.message,
                "retryable": self.retryable,
            }
        }


def strip_html_tags(raw_html: str) -> str:
    """Unescape HTML entities and strip markup tags to clean text."""
    if not raw_html:
        return ""
    unescaped = html.unescape(raw_html)
    # Remove script and style elements
    cleaned = re.sub(
        r"<(script|style)[^>]*>.*?</\1>",
        " ",
        unescaped,
        flags=re.DOTALL | re.IGNORECASE,
    )
    # Replace block tags with newlines
    cleaned = re.sub(
        r"<(?:p|div|h[1-6]|li|br|tr)[^>]*>", "\n", cleaned, flags=re.IGNORECASE
    )
    # Strip remaining tags
    cleaned = re.sub(r"<[^>]+>", " ", cleaned)
    # Normalize multiple newlines and spaces
    lines = [re.sub(r"[ \t]+", " ", line).strip() for line in cleaned.splitlines()]
    return "\n".join(line for line in lines if line)


class JobIngestAgent:
    """Autonomous agent for ingesting job postings from boards and parsing requirements."""

    async def fetch_url(self, url: str) -> tuple[str, str, str, str]:
        """Fetch job posting from supported job board or return clean error.

        Returns (title, company, clean_text, source_detail).
        """
        parsed = urllib.parse.urlparse(url)
        netloc = parsed.netloc.lower()

        # 1. LinkedIn Check: strict invariant — do not scrape or add cookies
        if "linkedin.com" in netloc:
            raise JobIngestError(
                code="LOGIN_WALL",
                message=(
                    "LinkedIn requires login authentication. Please copy the job description "
                    "text and use the 'Paste Text' option."
                ),
                retryable=False,
                status_code=400,
            )

        # 2. Greenhouse Check
        gh_match = re.search(
            r"(?:job-boards|boards-api|boards)\.greenhouse\.io(?:/v1/boards)?/([^/]+)/jobs/(\d+)",
            url,
            re.IGNORECASE,
        )
        if gh_match:
            board_token = gh_match.group(1)
            job_id = gh_match.group(2)
            api_url = f"https://boards-api.greenhouse.io/v1/boards/{board_token}/jobs/{job_id}"
            return await self._fetch_greenhouse(api_url, board_token)

        # 3. Lever Check
        lever_match = re.search(
            r"(?:jobs|api)\.lever\.co(?:/v0/postings)?/([^/]+)/([a-zA-Z0-9-]+)",
            url,
            re.IGNORECASE,
        )
        if lever_match:
            site = lever_match.group(1)
            posting_id = lever_match.group(2)
            api_url = f"https://api.lever.co/v0/postings/{site}/{posting_id}"
            return await self._fetch_lever(api_url, site, posting_id)

        # 4. Generic Web Page Fetch with standard headers
        headers = {
            "User-Agent": (
                "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
                "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
            ),
            "Accept": "text/html,application/xhtml+xml,application/json",
        }
        try:
            async with httpx.AsyncClient(timeout=10.0, follow_redirects=True) as client:
                resp = await client.get(url, headers=headers)
        except httpx.RequestError as exc:
            raise JobIngestError(
                code="NETWORK_ERROR",
                message=f"Failed to connect to job URL: {exc}",
                retryable=True,
                status_code=502,
            ) from exc

        if resp.status_code == 404:
            raise JobIngestError(
                code="NOT_FOUND",
                message="Job posting not found at the specified URL.",
                retryable=False,
                status_code=404,
            )

        if resp.status_code in (401, 403, 999):
            raise JobIngestError(
                code="LOGIN_WALL",
                message=(
                    f"Job page returned status {resp.status_code} (login/access wall). "
                    "Please copy the job text and use the 'Paste Text' option."
                ),
                retryable=False,
                status_code=400,
            )

        if resp.status_code >= 400:
            raise JobIngestError(
                code="FETCH_ERROR",
                message=f"Job URL returned HTTP {resp.status_code}.",
                retryable=resp.status_code >= 500,
                status_code=resp.status_code,
            )

        text = strip_html_tags(resp.text)
        if len(text.strip()) < 50:
            raise JobIngestError(
                code="INSUFFICIENT_CONTENT",
                message="Retrieved job page did not contain sufficient textual content. Please paste job text directly.",
                retryable=False,
                status_code=400,
            )

        # Basic title heuristic from domain/path
        title = "Job Opportunity"
        company = netloc.split(".")[0].capitalize()
        return title, company, text, f"Fetched from {url}"

    async def _fetch_greenhouse(
        self, api_url: str, board_token: str
    ) -> tuple[str, str, str, str]:
        """Fetch and parse Greenhouse job posting via public boards API."""
        try:
            async with httpx.AsyncClient(timeout=10.0) as client:
                resp = await client.get(api_url)
        except httpx.RequestError as exc:
            raise JobIngestError(
                code="NETWORK_ERROR",
                message=f"Network error querying Greenhouse API: {exc}",
                retryable=True,
                status_code=502,
            ) from exc

        if resp.status_code == 404:
            raise JobIngestError(
                code="NOT_FOUND",
                message=f"Greenhouse job not found on board '{board_token}'.",
                retryable=False,
                status_code=404,
            )

        if resp.status_code != 200:
            raise JobIngestError(
                code="GREENHOUSE_API_ERROR",
                message=f"Greenhouse API returned HTTP {resp.status_code}.",
                retryable=resp.status_code >= 500,
                status_code=resp.status_code,
            )

        data = resp.json()
        title = data.get("title") or "Software Engineering Position"
        company = data.get("company_name") or board_token.capitalize()
        raw_content = data.get("content") or ""
        clean_content = strip_html_tags(raw_content)

        return title, company, clean_content, f"Greenhouse Board: {board_token}"

    async def _fetch_lever(
        self, api_url: str, site: str, posting_id: str
    ) -> tuple[str, str, str, str]:
        """Fetch and parse Lever job posting with EU host fallback."""
        try:
            async with httpx.AsyncClient(timeout=10.0) as client:
                resp = await client.get(api_url)
                if resp.status_code == 404:
                    # Try EU host fallback
                    eu_url = f"https://api.eu.lever.co/v0/postings/{site}/{posting_id}"
                    eu_resp = await client.get(eu_url)
                    if eu_resp.status_code == 200:
                        resp = eu_resp
        except httpx.RequestError as exc:
            raise JobIngestError(
                code="NETWORK_ERROR",
                message=f"Network error querying Lever API: {exc}",
                retryable=True,
                status_code=502,
            ) from exc

        if resp.status_code == 404:
            raise JobIngestError(
                code="NOT_FOUND",
                message=f"Lever posting '{posting_id}' not found for '{site}'.",
                retryable=False,
                status_code=404,
            )

        if resp.status_code != 200:
            raise JobIngestError(
                code="LEVER_API_ERROR",
                message=f"Lever API returned HTTP {resp.status_code}.",
                retryable=resp.status_code >= 500,
                status_code=resp.status_code,
            )

        data = resp.json()
        title = data.get("text") or "Engineering Role"
        categories = data.get("categories") or {}
        company = categories.get("team") or site.capitalize()

        raw_desc = data.get("descriptionPlain") or strip_html_tags(
            data.get("description") or ""
        )
        return title, company, raw_desc, f"Lever Posting: {site}"

    def extract_requirements(
        self,
        title: str,
        company: str,
        text_content: str,
        source_url: str,
        source_type: SourceType,
        source_detail: str = "",
    ) -> JobDraft:
        """Extract structured technical requirements from clean job text."""
        requirements: list[RequirementIn] = []
        matched_keys: set[str] = set()

        # Split text into bullet points or sentences
        raw_units = re.split(r"[\r\n]+|[•·\-\*]\s+", text_content)

        # Track priority context across sections (e.g. Preferred Qualifications)
        in_preferred_section = False

        for unit in raw_units:
            clean_unit = unit.strip()
            if not clean_unit or len(clean_unit) < 8:
                continue

            # Section header check for preferred vs required qualifications
            if len(clean_unit) < 80 and bool(
                re.search(
                    r"^(?:preferred|nice to have|plus|bonus)\b|\b(preferred qualifications|preferred but not required|nice to have|bonus points)\b",
                    clean_unit,
                    re.IGNORECASE,
                )
            ):
                in_preferred_section = True
            elif len(clean_unit) < 80 and bool(
                re.search(
                    r"\b(minimum|basic|required|responsibilities|must have|requirements|qualifications|excited about you|what you'll do|what we're looking for)\b",
                    clean_unit,
                    re.IGNORECASE,
                )
            ):
                in_preferred_section = False

            lower = clean_unit.lower()

            for tax_key, name, cat, patterns in TAXONOMY_PATTERNS:
                if tax_key in matched_keys:
                    continue

                if any(re.search(pat, lower, re.IGNORECASE) for pat in patterns):
                    matched_keys.add(tax_key)
                    sentence_marks_nice = bool(
                        _NICE_TO_HAVE_REGEX.search(lower)
                    ) and not bool(re.search(r"\bpreferred location\b", lower))
                    is_nice = in_preferred_section or sentence_marks_nice

                    requirements.append(
                        RequirementIn(
                            id=f"req_{tax_key}",
                            name=name,
                            category=cat,
                            priority=Priority.nice if is_nice else Priority.must,
                            source_sentence=clean_unit,
                            taxonomy_key=tax_key,
                            search_terms=[p.strip(r"\b") for p in patterns],
                            position=len(requirements) + 1,
                        )
                    )

        # Fallback to canonical core requirements if posting text is sparse
        if not requirements:
            canonical = [
                (
                    "req_python_lang",
                    "Python",
                    "Language",
                    "Proficient in Python.",
                    "python_lang",
                    ["python", "asyncio"],
                    Priority.must,
                ),
                (
                    "req_rest_api",
                    "FastAPI / REST APIs",
                    "Backend",
                    "Experience building REST APIs.",
                    "rest_api",
                    ["fastapi", "rest", "api"],
                    Priority.must,
                ),
                (
                    "req_sql_database",
                    "SQL",
                    "Database",
                    "Experience working with SQL databases.",
                    "sql_database",
                    ["sql", "postgresql", "sqlite"],
                    Priority.must,
                ),
                (
                    "req_testing",
                    "Testing",
                    "Quality Assurance",
                    "Write unit and integration tests.",
                    "testing",
                    ["pytest", "test", "assert"],
                    Priority.must,
                ),
                (
                    "req_deployment",
                    "Deployment",
                    "DevOps",
                    "Containerize and deploy services.",
                    "deployment",
                    ["docker", "container", "deploy"],
                    Priority.nice,
                ),
                (
                    "req_ci_cd",
                    "CI/CD (GitHub Actions)",
                    "DevOps",
                    "Automate workflows with CI/CD.",
                    "ci_cd",
                    ["ci/cd", "github actions"],
                    Priority.nice,
                ),
            ]
            for req_id, name, cat, quote, key, terms, prio in canonical:
                requirements.append(
                    RequirementIn(
                        id=req_id,
                        name=name,
                        category=cat,
                        priority=prio,
                        source_sentence=quote,
                        taxonomy_key=key,
                        search_terms=terms,
                        position=len(requirements) + 1,
                    )
                )

        now_str = datetime.now(UTC).isoformat()
        job_id = f"job_{uuid.uuid4().hex[:12]}"

        return JobDraft(
            id=job_id,
            title=title,
            company=company,
            source_url=source_url,
            source_type=source_type,
            source_detail=source_detail
            or (
                "Pasted job description"
                if source_type == SourceType.user_provided
                else "Fetched job posting"
            ),
            raw_text=text_content,
            requirements=requirements,
            confirmed=False,
            created_at=now_str,
        )


job_ingest = JobIngestAgent()
