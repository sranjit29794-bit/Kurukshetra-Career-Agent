"""Resume Ingestion Agent extracting skills, GitHub links, and hyperlink annotations from PDFs and text.

Reference: docs/BRAIN.md (§9, §11, §12) and docs/PLAN-5H.md (Phase IN-3).
Invariants:
- PDF text extraction with pypdf
- GitHub links extracted from visible text AND from hyperlink annotations (/Annots -> /A -> /URI)
- Detect image-only / scanned PDFs (resume_c_scanned) and emit clear warning without guessing
- Extract claimed skills as E0 claims with taxonomy keys and source lines
"""

from __future__ import annotations

import io
import logging
import re
import uuid

import pypdf

from backend.app.schemas import (
    RepoCandidate,
    RepoCandidateKind,
    RepoCandidateSource,
    ResumeClaim,
    ResumeClaimKind,
    ResumeDraft,
)

logger = logging.getLogger(__name__)

# Recognized skill patterns to match against resume lines
RESUME_SKILL_PATTERNS: list[tuple[str, str, list[str]]] = [
    (
        "python_lang",
        "Python",
        [r"\bpython\b", r"\bpydantic\b", r"\basyncio\b"],
    ),
    (
        "rest_api",
        "FastAPI / REST APIs",
        [r"\bfastapi\b", r"\brest\s+apis?\b", r"\bflask\b", r"\bdjango\b", r"\bapi\b"],
    ),
    (
        "sql_database",
        "SQL",
        [
            r"\bsql\b",
            r"\bpostgresql\b",
            r"\bpostgres\b",
            r"\bsqlite\b",
            r"\bmysql\b",
            r"\bdatabase\b",
        ],
    ),
    (
        "testing",
        "Testing",
        [
            r"\bpytest\b",
            r"\bunit\s+test(?:ing)?\b",
            r"\bintegration\s+test(?:ing)?\b",
            r"\btesting\b",
        ],
    ),
    (
        "deployment",
        "Deployment",
        [
            r"\bdocker\b",
            r"\bcontainer(?:s|ization)?\b",
            r"\bdeployment\b",
            r"\bkubernetes\b",
            r"\baws\b",
        ],
    ),
    (
        "ci_cd",
        "CI/CD (GitHub Actions)",
        [r"\bci/cd\b", r"\bgithub\s+actions\b", r"\bcontinuous\s+integration\b"],
    ),
    (
        "auth",
        "Authentication & Security",
        [r"\boauth(?:2)?\b", r"\bjwt\b", r"\bauthentication\b", r"\bauthorization\b"],
    ),
    (
        "git",
        "Version Control (Git)",
        [r"\bgit\b", r"\bgithub\b", r"\bversion\s+control\b"],
    ),
]

GITHUB_URL_REGEX = re.compile(
    r"(?:https?://)?(?:www\.)?github\.com/([a-zA-Z0-9_-]+)(?:/([a-zA-Z0-9_.-]+))?",
    re.IGNORECASE,
)


class ResumeIngestAgent:
    """Agent for parsing resume PDFs and text, extracting claims, and discovering repositories."""

    def parse_pdf(self, file_bytes: bytes, filename: str = "resume.pdf") -> ResumeDraft:
        """Parse resume PDF bytes, extracting text, visible URLs, and PDF hyperlink annotations."""
        try:
            reader = pypdf.PdfReader(io.BytesIO(file_bytes))
        except Exception as exc:
            logger.warning("Failed to parse PDF bytes: %s", exc)
            raise ValueError(f"Corrupted or invalid PDF document: {exc}") from exc

        extracted_text_pages: list[str] = []
        hyperlink_urls: list[str] = []

        for page in reader.pages:
            # 1. Extract visible text
            page_text = page.extract_text() or ""
            extracted_text_pages.append(page_text)

            # 2. Extract PDF hyperlink annotations (/Annots -> /A -> /URI)
            if "/Annots" in page:
                try:
                    annots = page["/Annots"]
                    for annot in annots:
                        obj = (
                            annot.get_object()
                            if hasattr(annot, "get_object")
                            else annot
                        )
                        if isinstance(obj, dict) and "/A" in obj:
                            action = obj["/A"]
                            if isinstance(action, dict) and "/URI" in action:
                                uri = str(action["/URI"]).strip()
                                if uri:
                                    hyperlink_urls.append(uri)
                except Exception as exc:
                    logger.debug("Failed to extract annotations from page: %s", exc)

        full_text = "\n".join(extracted_text_pages).strip()
        warnings: list[str] = []
        status = "ok"

        # 3. Check for scanned / image-only PDF
        if len(full_text) < 20:
            status = "no_text"
            warnings.append(
                "No selectable text found in PDF. This appears to be a scanned or image-only document. "
                "Please paste resume text directly."
            )

        # 4. Extract repository candidates from both annotations and visible text
        repo_candidates = self._extract_repo_candidates(
            visible_text=full_text,
            hyperlinks=hyperlink_urls,
        )

        # 5. Extract claimed skills
        claimed_skills = self._extract_claimed_skills(full_text)

        resume_id = f"resume_{uuid.uuid4().hex[:12]}"

        return ResumeDraft(
            status=status,
            resume_id=resume_id,
            filename=filename,
            text_chars=len(full_text),
            claimed_skills=claimed_skills,
            repo_candidates=repo_candidates,
            warnings=warnings,
        )

    def parse_text(self, text: str, filename: str = "pasted_resume.txt") -> ResumeDraft:
        """Parse raw resume text provided directly by candidate."""
        clean_text = text.strip()
        status = "ok"
        warnings: list[str] = []
        if len(clean_text) < 20:
            status = "no_text"
            warnings.append(
                "Pasted resume text is too short to extract skills reliably."
            )

        repo_candidates = self._extract_repo_candidates(
            visible_text=clean_text,
            hyperlinks=[],
        )
        claimed_skills = self._extract_claimed_skills(clean_text)

        resume_id = f"resume_{uuid.uuid4().hex[:12]}"

        return ResumeDraft(
            status=status,
            resume_id=resume_id,
            filename=filename,
            text_chars=len(clean_text),
            claimed_skills=claimed_skills,
            repo_candidates=repo_candidates,
            warnings=warnings,
        )

    def _extract_repo_candidates(
        self,
        visible_text: str,
        hyperlinks: list[str],
    ) -> list[RepoCandidate]:
        """Discover candidate GitHub repositories and profiles from text and annotations."""
        candidates: list[RepoCandidate] = []
        seen_urls: set[str] = set()

        # A. Process PDF hyperlink annotations first
        for raw_url in hyperlinks:
            match = GITHUB_URL_REGEX.search(raw_url)
            if match:
                owner = match.group(1).strip()
                repo_name = match.group(2).strip() if match.group(2) else None
                if repo_name and repo_name.endswith(".git"):
                    repo_name = repo_name[:-4]

                clean_url = (
                    f"https://github.com/{owner}/{repo_name}"
                    if repo_name
                    else f"https://github.com/{owner}"
                )
                if clean_url.lower() not in seen_urls:
                    seen_urls.add(clean_url.lower())
                    candidates.append(
                        RepoCandidate(
                            url=clean_url,
                            owner=owner,
                            name=repo_name,
                            kind=RepoCandidateKind.repo
                            if repo_name
                            else RepoCandidateKind.profile,
                            source=RepoCandidateSource.hyperlink,
                        )
                    )

        # B. Process visible text
        for line in visible_text.splitlines():
            for match in GITHUB_URL_REGEX.finditer(line):
                owner = match.group(1).strip()
                repo_name = match.group(2).strip() if match.group(2) else None
                if repo_name and repo_name.endswith(".git"):
                    repo_name = repo_name[:-4]
                # Filter out obvious false positives like github.com/features, github.com/pricing
                if owner.lower() in (
                    "features",
                    "pricing",
                    "security",
                    "about",
                    "contact",
                ):
                    continue

                clean_url = (
                    f"https://github.com/{owner}/{repo_name}"
                    if repo_name
                    else f"https://github.com/{owner}"
                )
                if clean_url.lower() not in seen_urls:
                    seen_urls.add(clean_url.lower())
                    candidates.append(
                        RepoCandidate(
                            url=clean_url,
                            owner=owner,
                            name=repo_name,
                            kind=RepoCandidateKind.repo
                            if repo_name
                            else RepoCandidateKind.profile,
                            source=RepoCandidateSource.text,
                        )
                    )

        return candidates

    def _extract_claimed_skills(self, text: str) -> list[ResumeClaim]:
        """Extract explicit technical skills claimed in resume text."""
        claims: list[ResumeClaim] = []
        matched_taxonomies: set[str] = set()

        lines = text.splitlines()
        for line_num, line in enumerate(lines, start=1):
            clean_line = line.strip()
            if not clean_line or len(clean_line) < 3:
                continue

            lower = clean_line.lower()

            for tax_key, display_name, patterns in RESUME_SKILL_PATTERNS:
                if tax_key in matched_taxonomies:
                    continue

                if any(re.search(pat, lower) for pat in patterns):
                    matched_taxonomies.add(tax_key)
                    claims.append(
                        ResumeClaim(
                            skill=display_name,
                            taxonomy_key=tax_key,
                            source_line=line_num,
                            kind=ResumeClaimKind.explicit,
                        )
                    )

        return claims


resume_ingest = ResumeIngestAgent()
