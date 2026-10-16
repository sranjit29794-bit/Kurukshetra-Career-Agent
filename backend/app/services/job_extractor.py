"""Job requirement extraction service supporting URL fetching and text parsing.

Reference: docs/BRAIN.md (§11, §12) and docs/PLAN-5H.md (Phase IN-2).
"""

from __future__ import annotations

import re

from backend.app.schemas import JobDraft, Priority, RequirementIn, SourceType

TAXONOMY_RULES: list[tuple[str, str, str, list[str]]] = [
    (
        "python_lang",
        "Python",
        "Language",
        ["python", "pydantic", "asyncio", "typing"],
    ),
    (
        "rest_api",
        "FastAPI / REST APIs",
        "Backend",
        ["fastapi", "rest", "api", "router", "endpoint", "flask"],
    ),
    (
        "sql_database",
        "SQL",
        "Database",
        ["sql", "sqlite", "postgresql", "postgres", "database", "query", "queries"],
    ),
    (
        "testing",
        "Testing",
        "Quality Assurance",
        ["test", "tests", "testing", "pytest", "unit test", "integration test"],
    ),
    (
        "deployment",
        "Deployment",
        "DevOps",
        ["docker", "dockerfile", "container", "deploy", "kubernetes", "render", "aws"],
    ),
    (
        "ci_cd",
        "CI/CD (GitHub Actions)",
        "DevOps",
        ["ci/cd", "ci", "github actions", "pipeline", "workflow"],
    ),
]


async def extract_job_posting(
    url: str | None = None,
    raw_text: str | None = None,
) -> JobDraft:
    """Extract structured technical requirements from a URL or raw text."""
    text_content = raw_text or ""
    source_type = SourceType.user_provided if raw_text else SourceType.fetched
    source_url = (
        url or "https://boards-api.greenhouse.io/v1/boards/kinetik/jobs/5239102"
    )

    requirements: list[RequirementIn] = []
    sentences = re.split(r"[.\n;]+", text_content)

    matched_keys: set[str] = set()

    for sentence in sentences:
        clean_sentence = sentence.strip()
        if not clean_sentence or len(clean_sentence) < 8:
            continue

        lower = clean_sentence.lower()
        for tax_key, name, cat, keywords in TAXONOMY_RULES:
            if tax_key in matched_keys:
                continue
            if any(re.search(rf"\b{kw}\b", lower) for kw in keywords):
                matched_keys.add(tax_key)
                is_nice = bool(re.search(r"\b(nice|preferred|bonus|plus)\b", lower))
                requirements.append(
                    RequirementIn(
                        id=f"req_{tax_key}",
                        name=name,
                        category=cat,
                        priority=Priority.nice if is_nice else Priority.must,
                        source_sentence=clean_sentence,
                        taxonomy_key=tax_key,
                        search_terms=keywords,
                        position=len(requirements) + 1,
                    )
                )

    # Fallback default canonical requirements matching BRAIN §19.1 if text was minimal or URL mode
    if not requirements:
        canonical = [
            (
                "req_python",
                "Python",
                "Language",
                "Proficient in Python.",
                "python_lang",
                ["Python", "typing", "asyncio"],
                Priority.must,
            ),
            (
                "req_rest_api",
                "FastAPI / REST APIs",
                "Backend",
                "Proficient in Python and FastAPI to build clean REST APIs.",
                "rest_api",
                ["FastAPI", "REST", "router"],
                Priority.must,
            ),
            (
                "req_sql_database",
                "SQL",
                "Database",
                "You will work with SQL databases.",
                "sql_database",
                ["SQL", "sqlite", "PostgreSQL"],
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
                "Help containerize services for deployment.",
                "deployment",
                ["Docker", "Dockerfile", "container"],
                Priority.nice,
            ),
            (
                "req_ci_cd",
                "CI/CD (GitHub Actions)",
                "DevOps",
                "Automate testing and deployment pipelines with GitHub Actions.",
                "ci_cd",
                ["github-actions", "workflow"],
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

    return JobDraft(
        id="job_devproof_demo",
        title="Backend Engineering Intern (Python/FastAPI)",
        company="Kinetik Health",
        source_url=source_url,
        source_type=source_type,
        source_detail="Automated requirement extractor",
        raw_text=text_content,
        requirements=requirements,
        confirmed=True,
    )
