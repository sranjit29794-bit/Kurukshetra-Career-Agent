import json
import logging
import re
from typing import Any, Dict, List, Optional, Tuple
import httpx

from backend.app.config import get_settings
from backend.app.schemas import Priority, RequirementDraft, SourceType

logger = logging.getLogger(__name__)

# Supported skill taxonomies in DevProof MVP
TAXONOMY_RULES = [
    {
        "key": "rest_api",
        "name": "REST API Development",
        "category": "Backend Engineering",
        "priority": Priority.MUST,
        "keywords": [r"\brest\b", r"\brestful\b", r"\bapi\b", r"\bapis\b", r"\bfastapi\b", r"\bflask\b", r"\bdjango\b", r"\bendpoint\b", r"\bendpoints\b", r"\bhttp\b"],
        "search_terms": ["fastapi", "router", "endpoint", "get", "post", "put", "delete"],
    },
    {
        "key": "sql_database",
        "name": "SQL & Relational Databases",
        "category": "Data & Storage",
        "priority": Priority.MUST,
        "keywords": [r"\bsql\b", r"\bdatabase\b", r"\bdatabases\b", r"\bpostgresql\b", r"\bpostgres\b", r"\bsqlite\b", r"\bmysql\b", r"\brelational\b", r"\bschema\b", r"\bqueries\b", r"\bquery\b"],
        "search_terms": ["sql", "select", "insert", "execute", "sqlite", "parameterized", "table"],
    },
    {
        "key": "testing",
        "name": "Automated Testing",
        "category": "Quality Assurance",
        "priority": Priority.MUST,
        "keywords": [r"\btest\b", r"\btesting\b", r"\bpytest\b", r"\bunit test\b", r"\bunit tests\b", r"\bintegration test\b", r"\btest coverage\b", r"\bmock\b"],
        "search_terms": ["pytest", "test_", "assert", "fixture", "mock", "unittest"],
    },
    {
        "key": "auth",
        "name": "Authentication & Security",
        "category": "Security & Identity",
        "priority": Priority.MUST,
        "keywords": [r"\bauth\b", r"\bauthentication\b", r"\bauthorization\b", r"\bjwt\b", r"\boauth\b", r"\btoken\b", r"\bpassword\b", r"\bsecurity\b", r"\bhashing\b", r"\bbcrypt\b"],
        "search_terms": ["jwt", "bearer", "password", "hash", "token", "auth", "security"],
    },
    {
        "key": "async_concurrency",
        "name": "Async & Concurrency",
        "category": "Backend Engineering",
        "priority": Priority.NICE,
        "keywords": [r"\basync\b", r"\basynchronous\b", r"\basyncio\b", r"\bconcurrency\b", r"\bmultithreading\b", r"\bevent loop\b", r"\bcoroutines\b"],
        "search_terms": ["async", "await", "asyncio", "coroutine", "task", "concurrent"],
    },
    {
        "key": "deployment",
        "name": "Docker & Deployment",
        "category": "DevOps & Cloud",
        "priority": Priority.NICE,
        "keywords": [r"\bdocker\b", r"\bcontainer\b", r"\bcontainers\b", r"\bcontainerization\b", r"\bdockerfile\b", r"\bcompose\b", r"\bci/cd\b", r"\bdeployment\b", r"\bdeploy\b", r"\bkubernetes\b"],
        "search_terms": ["dockerfile", "docker-compose", "container", "deploy", "docker"],
    },
    {
        "key": "python",
        "name": "Python Language Foundations",
        "category": "Core Programming",
        "priority": Priority.MUST,
        "keywords": [r"\bpython\b", r"\bpython3\b", r"\btyped python\b", r"\boop\b", r"\bobject oriented\b"],
        "search_terms": ["class", "def", "pydantic", "typing", "python"],
    },
]


def _extract_title_and_company(text: str) -> Tuple[str, str]:
    """Deterministically heuristic extraction for job title and company from text."""
    lines = [line.strip() for line in text.splitlines() if line.strip()]
    title = "Software Engineer"
    company = "Company"

    # Common patterns: "Company is seeking a Title", "Title at Company"
    for line in lines[:10]:
        seeking_match = re.search(r"([A-Z][A-Za-z0-9\s&]+?)\s+(?:is\s+seeking|is\s+looking\s+for|is\s+hiring|hiring)\s+(?:an?|the)?\s*([A-Za-z\s]+(?:Intern|Engineer|Developer|Architect|Specialist))", line, re.IGNORECASE)
        if seeking_match:
            comp_candidate = seeking_match.group(1).strip()
            title_candidate = seeking_match.group(2).strip()
            if len(comp_candidate) < 50:
                company = comp_candidate
            if len(title_candidate) < 60:
                title = title_candidate
            return title, company

        at_match = re.search(r"([A-Za-z\s]+(?:Intern|Engineer|Developer|Specialist))\s+at\s+([A-Z][A-Za-z0-9\s&]+)", line, re.IGNORECASE)
        if at_match:
            title_candidate = at_match.group(1).strip()
            comp_candidate = at_match.group(2).strip()
            if len(title_candidate) < 60:
                title = title_candidate
            if len(comp_candidate) < 50:
                company = comp_candidate
            return title, company

    # Fallback to inspecting first 2 lines
    if lines:
        first_line = lines[0]
        if len(first_line) < 80:
            title = first_line

    return title, company


def extract_requirements_deterministic(text: str) -> List[RequirementDraft]:
    """Splits text into sentences, finds matches for supported skills, and returns

    deduplicated requirement drafts with genuine source sentences.
    """
    # Split text into candidate sentences
    sentences = re.split(r"(?<=[.!?])\s+|\n+", text)
    sentences = [s.strip() for s in sentences if len(s.strip()) > 15]

    matched_requirements: List[RequirementDraft] = []
    seen_taxonomies = set()

    for rule in TAXONOMY_RULES:
        rule_key = rule["key"]
        for sentence in sentences:
            # Check keywords
            matched = False
            for kw in rule["keywords"]:
                if re.search(kw, sentence, re.IGNORECASE):
                    matched = True
                    break

            if matched and rule_key not in seen_taxonomies:
                seen_taxonomies.add(rule_key)
                matched_requirements.append(
                    RequirementDraft(
                        id=None,
                        name=rule["name"],
                        category=rule["category"],
                        priority=rule["priority"],
                        source_sentence=sentence[:300],
                        taxonomy_key=rule_key,
                        search_terms=rule["search_terms"],
                        position=len(matched_requirements) + 1,
                    )
                )
                break

    # If no requirements matched standard taxonomy, add fallback generic requirement
    if not matched_requirements:
        first_sent = sentences[0] if sentences else "Software engineering requirements."
        matched_requirements.append(
            RequirementDraft(
                id=None,
                name="Core Engineering & Problem Solving",
                category="General Engineering",
                priority=Priority.MUST,
                source_sentence=first_sent[:300],
                taxonomy_key=None,
                search_terms=["code", "function", "class", "module"],
                position=1,
            )
        )

    return matched_requirements


async def extract_requirements_llm(text: str) -> Optional[Dict[str, Any]]:
    """Attempts to use configured LLM (OpenAI-compatible) to extract structured

    job info and requirements. Returns None if unconfigured or failed.
    """
    settings = get_settings()
    if not settings.LLM_ENABLED or not settings.LLM_API_KEY or not settings.LLM_BASE_URL:
        return None

    system_prompt = (
        "You are DevProof Job Analyst. Extract job details from the provided job posting text. "
        "Strict rules:\n"
        "1. Never invent or hallucinate skills, company names, or requirements not in the text.\n"
        "2. Quote exact source sentences from the job text for each requirement.\n"
        "3. Output MUST be valid JSON adhering to this exact schema:\n"
        "{\n"
        '  "title": "string",\n'
        '  "company": "string",\n'
        '  "requirements": [\n'
        "    {\n"
        '      "name": "string",\n'
        '      "category": "string",\n'
        '      "priority": "must" | "nice",\n'
        '      "source_sentence": "exact quote from text",\n'
        '      "taxonomy_key": "rest_api" | "sql_database" | "testing" | "auth" | "async_concurrency" | "deployment" | "python" | null,\n'
        '      "search_terms": ["term1", "term2"]\n'
        "    }\n"
        "  ],\n"
        '  "ambiguities": ["any unclear or missing requirements"]\n'
        "}\n"
    )

    headers = {
        "Authorization": f"Bearer {settings.LLM_API_KEY}",
        "Content-Type": "application/json",
    }
    payload = {
        "model": settings.LLM_MODEL or "gpt-3.5-turbo",
        "messages": [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": f"Extract requirements from this job text:\n\n{text[:4000]}"},
        ],
        "temperature": 0.1,
    }

    try:
        async with httpx.AsyncClient(timeout=float(settings.LLM_TIMEOUT_S)) as client:
            resp = await client.post(f"{settings.LLM_BASE_URL.rstrip('/')}/chat/completions", headers=headers, json=payload)
            if resp.status_code == 200:
                data = resp.json()
                content = data["choices"][0]["message"]["content"]
                # Parse JSON
                cleaned_json = re.sub(r"^```json\s*", "", content.strip())
                cleaned_json = re.sub(r"\s*```$", "", cleaned_json)
                parsed = json.loads(cleaned_json)
                if isinstance(parsed, dict) and "requirements" in parsed:
                    return parsed
    except Exception as e:
        logger.warning(f"LLM extraction skipped or failed: {e}")

    return None


async def analyze_job_text(
    text: str,
    source_url: Optional[str] = None,
    source_type: SourceType = SourceType.USER_PROVIDED,
) -> Dict[str, Any]:
    """Full Job Analyst extraction pipeline: runs LLM if available, falls back to

    deterministic taxonomy extractor, and ensures strict data integrity.
    """
    llm_result = await extract_requirements_llm(text)

    if llm_result:
        title = llm_result.get("title") or "Software Engineer"
        company = llm_result.get("company") or "Company"
        raw_reqs = llm_result.get("requirements", [])
        requirements = []
        for i, r in enumerate(raw_reqs, 1):
            requirements.append(
                RequirementDraft(
                    id=None,
                    name=r.get("name", "Requirement"),
                    category=r.get("category", "General"),
                    priority=Priority(r.get("priority", "must")),
                    source_sentence=r.get("source_sentence", text[:100]),
                    taxonomy_key=r.get("taxonomy_key"),
                    search_terms=r.get("search_terms", []),
                    position=i,
                )
            )
        ambiguities = llm_result.get("ambiguities", [])
    else:
        # Deterministic extraction
        title, company = _extract_title_and_company(text)
        requirements = extract_requirements_deterministic(text)
        ambiguities = []
        if len(requirements) < 2:
            ambiguities.append("Fewer than 2 standard skill patterns recognized; please review and add any specific job requirements.")

    return {
        "title": title,
        "company": company,
        "source_url": source_url,
        "source_type": source_type,
        "raw_text": text,
        "confirmed": False,
        "requirements": requirements,
        "ambiguities": ambiguities,
    }
