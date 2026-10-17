import json
import logging
import re
from typing import Any, Dict, List, Optional, Tuple
import httpx

from backend.app.config import get_settings
from backend.app.schemas import Priority, RequirementDraft, SourceType

logger = logging.getLogger(__name__)

# Comprehensive skill and competency taxonomies for DevProof
# Covers backend, frontend, full-stack, databases, testing, devops, mobile, tools, and practices
TAXONOMY_RULES = [
    {
        "key": "fullstack_web",
        "name": "Full-Stack Web Development",
        "category": "Full Stack Engineering",
        "priority": Priority.MUST,
        "keywords": [
            r"\bfull[\s\-]stack\b",
            r"\bfront[\s\-]end\s+and\s+back[\s\-]end\b",
            r"\bfrontend\s+and\s+backend\b",
            r"\bboth\s+front[\s\-]end\s+and\s+back[\s\-]end\b",
        ],
        "search_terms": ["fullstack", "full-stack", "frontend", "backend", "client", "server"],
    },
    {
        "key": "mean_mern_stack",
        "name": "MEAN / MERN Stack Foundations",
        "category": "Full Stack Frameworks",
        "priority": Priority.MUST,
        "keywords": [
            r"\bmean\b",
            r"\bmern\b",
            r"\bmean/mern\b",
            r"\bmern/mean\b",
            r"\bmean\s+or\s+mern\b",
        ],
        "search_terms": ["express", "node", "react", "mongo", "angular", "mern", "mean"],
    },
    {
        "key": "html_css",
        "name": "HTML5 & CSS3 Responsive Styling",
        "category": "Frontend Engineering",
        "priority": Priority.MUST,
        "keywords": [
            r"\bhtml(?:5)?\b",
            r"\bcss(?:3)?\b",
            r"\bhtml/css\b",
            r"\bhtml\s*&\s*css\b",
            r"\bresponsive\s+(?:design|web|layout)\b",
            r"\btailwind(?:css)?\b",
            r"\bbootstrap\b",
        ],
        "search_terms": ["html", "css", "style", "div", "class", "flex", "grid", "tailwind"],
    },
    {
        "key": "frontend_web",
        "name": "Frontend & Web UI",
        "category": "Frontend Engineering",
        "priority": Priority.MUST,
        "keywords": [
            r"\breact(?:\.js)?\b",
            r"\btypescript\b",
            r"\bjavascript\b",
            r"\bjs\b",
            r"\bvue(?:\.js)?\b",
            r"\bangular(?:\.js)?\b",
            r"\bnext\.?js\b",
            r"\bfront[\s\-]end\b",
            r"\bfrontend\b",
            r"\bweb\s+ui\b",
        ],
        "search_terms": ["react", "typescript", "component", "frontend", "javascript", "vue", "angular"],
    },
    {
        "key": "backend_dev",
        "name": "Backend Engineering & Logic",
        "category": "Backend Engineering",
        "priority": Priority.MUST,
        "keywords": [
            r"\bback[\s\-]end\b",
            r"\bbackend\b",
            r"\bnode(?:\.js)?\b",
            r"\bexpress(?:\.js)?\b",
            r"\bdjango\b",
            r"\bflask\b",
            r"\bserver[\s\-]side\b",
            r"\bspring(?:\s+boot)?\b",
        ],
        "search_terms": ["backend", "server", "express", "node", "django", "flask", "router"],
    },
    {
        "key": "rest_api",
        "name": "REST API Development",
        "category": "Backend Engineering",
        "priority": Priority.MUST,
        "keywords": [
            r"\brest\b",
            r"\brestful\b",
            r"\bapis?\b",
            r"\bfastapi\b",
            r"\bendpoints?\b",
            r"\bhttp\b",
            r"\bgraphql\b",
            r"\bweb\s+services?\b",
        ],
        "search_terms": ["fastapi", "router", "endpoint", "get", "post", "put", "delete", "api"],
    },
    {
        "key": "sql_database",
        "name": "SQL & Relational Databases",
        "category": "Data & Storage",
        "priority": Priority.MUST,
        "keywords": [
            r"\bsql\b",
            r"\bdatabases?\b",
            r"\bpostgresql\b",
            r"\bpostgres\b",
            r"\bsqlite\b",
            r"\bmysql\b",
            r"\brelational\b",
            r"\bschema\b",
            r"\bqueries\b",
            r"\bquery\b",
            r"\borm\b",
            r"\bsqlalchemy\b",
        ],
        "search_terms": ["sql", "select", "insert", "execute", "sqlite", "parameterized", "table"],
    },
    {
        "key": "nosql_database",
        "name": "NoSQL & Document Databases",
        "category": "Data & Storage",
        "priority": Priority.NICE,
        "keywords": [
            r"\bmongodb\b",
            r"\bmongo\b",
            r"\bnosql\b",
            r"\bdocument\s+store\b",
            r"\bmongoose\b",
            r"\bfirebase\b",
            r"\bdynamodb\b",
        ],
        "search_terms": ["mongo", "mongodb", "collection", "document", "find", "nosql"],
    },
    {
        "key": "testing",
        "name": "Automated Testing",
        "category": "Quality Assurance",
        "priority": Priority.MUST,
        "keywords": [
            r"\btest\b",
            r"\btesting\b",
            r"\bpytest\b",
            r"\bunit\s+tests?\b",
            r"\bintegration\s+tests?\b",
            r"\btest\s+coverage\b",
            r"\bmock\b",
            r"\bjest\b",
            r"\bcypress\b",
            r"\bqa\b",
        ],
        "search_terms": ["pytest", "test_", "assert", "fixture", "mock", "unittest", "jest"],
    },
    {
        "key": "auth",
        "name": "Authentication & Security",
        "category": "Security & Identity",
        "priority": Priority.MUST,
        "keywords": [
            r"\bauth\b",
            r"\bauthentication\b",
            r"\bauthorization\b",
            r"\bjwt\b",
            r"\boauth\b",
            r"\btokens?\b",
            r"\bpasswords?\b",
            r"\bsecurity\b",
            r"\bhashing\b",
            r"\bbcrypt\b",
        ],
        "search_terms": ["jwt", "bearer", "password", "hash", "token", "auth", "security"],
    },
    {
        "key": "async_concurrency",
        "name": "Async & Concurrency",
        "category": "Backend Engineering",
        "priority": Priority.NICE,
        "keywords": [
            r"\basync\b",
            r"\basynchronous\b",
            r"\basyncio\b",
            r"\bconcurrency\b",
            r"\bmultithreading\b",
            r"\bevent\s+loop\b",
            r"\bcoroutines\b",
            r"\bpromises?\b",
        ],
        "search_terms": ["async", "await", "asyncio", "coroutine", "task", "concurrent", "promise"],
    },
    {
        "key": "deployment",
        "name": "Docker & Deployment",
        "category": "DevOps & Cloud",
        "priority": Priority.NICE,
        "keywords": [
            r"\bdocker\b",
            r"\bcontainers?\b",
            r"\bcontainerization\b",
            r"\bdockerfile\b",
            r"\bcompose\b",
            r"\bci/cd\b",
            r"\bdeployments?\b",
            r"\bdeploy\b",
            r"\bkubernetes\b",
        ],
        "search_terms": ["dockerfile", "docker-compose", "container", "docker", "kubernetes", "render.yaml", "fly.toml", "procfile"],
    },
    {
        "key": "python",
        "name": "Python Language Foundations",
        "category": "Core Programming",
        "priority": Priority.MUST,
        "keywords": [
            r"\bpython\b",
            r"\bpython3\b",
            r"\btyped\s+python\b",
            r"\boop\b",
            r"\bobject\s+oriented\b",
        ],
        "search_terms": ["class", "def", "pydantic", "typing", "python"],
    },
    {
        "key": "java_jvm",
        "name": "Java / JVM Engineering",
        "category": "Core Programming",
        "priority": Priority.MUST,
        "keywords": [
            r"\bjava\b",
            r"\bspring\b",
            r"\bkotlin\b",
            r"\bjvm\b",
        ],
        "search_terms": ["java", "public class", "spring", "void", "maven"],
    },
    {
        "key": "git_vcs",
        "name": "Git & Version Control",
        "category": "Development Workflow",
        "priority": Priority.MUST,
        "keywords": [
            r"\bgit\b",
            r"\bgithub\b",
            r"\bgitlab\b",
            r"\bversion\s+control\b",
            r"\bpull\s+requests?\b",
            r"\bbranching\b",
        ],
        "search_terms": ["git", "commit", "branch", "pull request", "merge", "github"],
    },
    {
        "key": "cloud_aws_gcp",
        "name": "Cloud Platforms & Infrastructure",
        "category": "Cloud & Infrastructure",
        "priority": Priority.NICE,
        "keywords": [
            r"\baws\b",
            r"\bgcp\b",
            r"\bazure\b",
            r"\bcloud\b",
            r"\bec2\b",
            r"\bs3\b",
            r"\blambda\b",
        ],
        "search_terms": ["aws", "s3", "cloud", "lambda", "gcp", "azure"],
    },
    {
        "key": "caching_redis",
        "name": "Caching & In-Memory Stores",
        "category": "Data & Storage",
        "priority": Priority.NICE,
        "keywords": [
            r"\bredis\b",
            r"\bmemcached\b",
            r"\bcaching\b",
            r"\bcache\b",
        ],
        "search_terms": ["redis", "cache", "memcached", "ttl", "get", "set"],
    },
    {
        "key": "end_to_end_project",
        "name": "End-to-End Application Delivery",
        "category": "Engineering Competency",
        "priority": Priority.NICE,
        "keywords": [
            r"\bend[\s\-]to[\s\-]end\b",
            r"\bconception\s+of\s+an\s+idea\s+to\s+the\s+(?:actual\s+)?finished\s+product\b",
            r"\bbuild\s+a\s+complete\s+.*project\b",
            r"\bcomplete\s+projects?\b",
        ],
        "search_terms": ["project", "app", "build", "module", "system", "architecture"],
    },
]

LEARNING_INDICATORS = [
    r"\b(?:will\s+learn|learn\s+the\s+basics|learning\s+and\s+growth|will\s+be\s+trained|training\s+in|training\s+and\s+mentorship|mentorship\s+in|opportunity\s+to\s+learn|get\s+trained|explore|familiarity\s+with|exposure\s+to|introductory)\b"
]

MUST_INDICATORS = [
    r"\b(?:must|required|mandatory|essential|minimum|proficiency\s+in|proficient\s+in|strong\s+knowledge|experience\s+with|demonstrated\s+ability|in-depth\s+knowledge)\b"
]

NICE_INDICATORS = [
    r"\b(?:nice\s+to\s+have|plus|bonus|preferred|good\s+to\s+have|optional|advantage|familiarity|desired)\b"
]


def normalize_job_text(raw_text: str) -> str:
    """Cleans Markdown, headings, bullets, repeated whitespace, and HTML entities
    into clean, normalized plain text for precise sentence extraction.
    """
    import html
    cleaned = html.unescape(raw_text)
    cleaned = cleaned.replace("\r\n", "\n").replace("\r", "\n")
    # Normalize smart quotes and dashes
    cleaned = re.sub(r"[\u2018\u2019]", "'", cleaned)
    cleaned = re.sub(r"[\u201c\u201d]", '"', cleaned)
    cleaned = re.sub(r"[\u2013\u2014]", "-", cleaned)
    # Strip non-ascii artifacts
    cleaned = re.sub(r"[\x80-\xff]", lambda m: "'" if ord(m.group(0)) in (0x91, 0x92) else " ", cleaned)
    # Convert bullets and markdown headers to regular line items
    cleaned = re.sub(r"^[ \t]*[•\*\-\u2022\u2023\u25e6\u2043\u2219]\s*", "- ", cleaned, flags=re.MULTILINE)
    cleaned = re.sub(r"^[ \t]*#+\s*", "", cleaned, flags=re.MULTILINE)
    cleaned = re.sub(r"[ \t]+", " ", cleaned)
    cleaned = re.sub(r"\n{3,}", "\n\n", cleaned)
    return cleaned.strip()


def _extract_title_and_company(text: str) -> Tuple[str, str]:
    """Deterministically heuristic extraction for job title and company from text."""
    lines = [line.strip() for line in text.splitlines() if line.strip()]
    title = "Software Engineer"
    company = "Company"

    # Pass 1: Explicit labels
    for line in lines[:30]:
        role_label_match = re.search(r"^(?:Role|Job\s*Title|Position)\s*[:\-]\s*(.+)$", line, re.IGNORECASE)
        if role_label_match:
            candidate = role_label_match.group(1).strip()
            if 3 < len(candidate) < 70:
                title = candidate
                break

        comp_label_match = re.search(r"^(?:Company|Organization|Employer)\s*[:\-]\s*(.+)$", line, re.IGNORECASE)
        if comp_label_match:
            candidate = comp_label_match.group(1).strip()
            if 2 < len(candidate) < 60:
                company = candidate

    # Pass 2: 'Company is seeking/hiring Title' or 'Title at Company'
    for line in lines[:30]:
        seeking_match = re.search(
            r"([A-Z][A-Za-z0-9\s&]+?)\s+(?:is\s+seeking|is\s+looking\s+for|is\s+hiring|hiring)\s+(?:an?|the|passionate)?\s*([A-Za-z\s]+(?:Intern|Engineer|Developer|Architect|Specialist))",
            line,
            re.IGNORECASE,
        )
        if seeking_match:
            comp_candidate = seeking_match.group(1).strip()
            title_candidate = seeking_match.group(2).strip()
            title_candidate = re.sub(r"^(?:passionate|experienced|senior|junior|lead)\s+", "", title_candidate, flags=re.IGNORECASE).strip()
            if len(comp_candidate) < 50:
                company = comp_candidate
            if len(title_candidate) < 60:
                title = title_candidate
            return title, company

        at_match = re.search(
            r"([A-Za-z\s]+(?:Intern|Engineer|Developer|Specialist|Architect))\s+at\s+([A-Z][A-Za-z0-9\s&]+)",
            line,
            re.IGNORECASE,
        )
        if at_match:
            title_candidate = at_match.group(1).strip()
            comp_candidate = at_match.group(2).strip()
            if len(title_candidate) < 60:
                title = title_candidate
            if len(comp_candidate) < 50:
                company = comp_candidate
            return title, company

    # Pass 3: Standalone role title lines (e.g. 'Full Stack Intern (Remote)' or 'Backend Engineering Intern')
    if title == "Software Engineer":
        for line in lines[:35]:
            if any(k in line.lower() for k in ["benefits", "unlock", "join", "opportunity", "about us", "welcome", "description:"]):
                continue
            role_match = re.search(
                r"^\s*([A-Za-z\s/\-]+(?:Intern(?:ship)?|Engineer(?:ing)?|Developer|Specialist|Architect))\s*(?:\([^)]+\))?\s*$",
                line,
                re.IGNORECASE,
            )
            if role_match:
                cand = re.sub(r"\s*\((?:Remote|Hybrid|Onsite|Full[\s\-]time|Part[\s\-]time)\)", "", line, flags=re.IGNORECASE).strip()
                if 4 < len(cand) < 60:
                    title = cand
                    break

    # Pass 4: Company mention (e.g. 'working at Techechelons', 'at Techechelons you will learn')
    if company == "Company":
        for line in lines[:35]:
            comp_match = re.search(
                r"\b(?:working\s+at|join\s+(?:the\s+team\s+at\s+)?|welcome\s+to|at)\s+([A-Z][A-Za-z0-9&]{2,30})\b",
                line,
            )
            if comp_match:
                c = comp_match.group(1).strip()
                if c.lower() not in ["our", "the", "this", "your", "any", "all", "home"]:
                    company = c
                    break

    # Pass 5: Fallback to inspecting first 2 lines
    if title == "Software Engineer" and lines:
        first_line = lines[0]
        if len(first_line) < 70 and not any(kw in first_line.lower() for kw in ("http", "www", "cookie", "privacy", "job")):
            title = first_line

    return title, company


def _extract_text_units(text: str) -> List[str]:
    """Splits text into paragraphs, bullet points, and individual sentences for fine-grained analysis."""
    units: List[str] = []
    paragraphs = [p.strip() for p in re.split(r"\n\s*\n", text) if p.strip()]
    for para in paragraphs:
        lines = [line.strip() for line in para.split("\n") if line.strip()]
        for line in lines:
            if line.startswith(("-", "*", "•", "1.", "2.", "3.", "4.", "5.", "6.", "7.", "8.", "9.")):
                u = re.sub(r"^[•\*\-\d\.\s]+", "", line).strip()
                if len(u) > 10:
                    units.append(u)
            else:
                sents = re.split(r"(?<=[.!?])\s+", line)
                for s in sents:
                    s_clean = s.strip()
                    if len(s_clean) > 12:
                        units.append(s_clean)
    return units


def _determine_priority(sentence: str, default_priority: Priority) -> Priority:
    """Distinguishes explicit requirements (MUST) from learning opportunities or bonuses (NICE)."""
    for pat in LEARNING_INDICATORS:
        if re.search(pat, sentence, re.IGNORECASE):
            return Priority.NICE
    for pat in NICE_INDICATORS:
        if re.search(pat, sentence, re.IGNORECASE):
            return Priority.NICE
    for pat in MUST_INDICATORS:
        if re.search(pat, sentence, re.IGNORECASE):
            return Priority.MUST
    return default_priority


def extract_requirements_deterministic(text: str) -> List[RequirementDraft]:
    """Extracts structured, deduplicated requirements with genuine source sentences
    and contextual priority determination (differentiating required qualifications from learning opportunities).
    """
    normalized = normalize_job_text(text)
    if not normalized.strip():
        return []

    units = _extract_text_units(normalized)
    if not units:
        return []

    matched_requirements: List[RequirementDraft] = []
    seen_taxonomies = set()

    for rule in TAXONOMY_RULES:
        rule_key = rule["key"]
        best_sentence = None
        best_priority = None

        for unit in units:
            for kw in rule["keywords"]:
                if re.search(kw, unit, re.IGNORECASE):
                    unit_prio = _determine_priority(unit, rule["priority"])
                    # If we find a MUST occurrence, prefer it over a generic or NICE occurrence
                    if best_sentence is None or (unit_prio == Priority.MUST and best_priority != Priority.MUST):
                        best_sentence = unit
                        best_priority = unit_prio
                    break

        if best_sentence and rule_key not in seen_taxonomies:
            seen_taxonomies.add(rule_key)
            matched_requirements.append(
                RequirementDraft(
                    id=None,
                    name=rule["name"],
                    category=rule["category"],
                    priority=best_priority or rule["priority"],
                    source_sentence=best_sentence[:300],
                    taxonomy_key=rule_key,
                    search_terms=rule["search_terms"],
                    position=len(matched_requirements) + 1,
                )
            )

    # If no requirements matched standard taxonomy and text was non-empty, add fallback generic requirement
    if not matched_requirements and normalized.strip():
        first_sent = units[0] if units else "Software engineering requirements."
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
        '      "taxonomy_key": "rest_api" | "sql_database" | "testing" | "auth" | "async_concurrency" | "deployment" | "python" | "git_vcs" | "cloud_aws_gcp" | "caching_redis" | "frontend_web" | null,\n'
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
    target_role: Optional[str] = None,
    ambiguity_notes: Optional[List[str]] = None,
) -> Dict[str, Any]:
    """Full Job Analyst extraction pipeline: runs LLM if available, falls back to
    deterministic taxonomy extractor, respects manual target_role, and ensures strict data integrity.
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

    # Override title if user explicitly specified target_role
    if target_role and target_role.strip():
        title = target_role.strip()

    if ambiguity_notes:
        for note in ambiguity_notes:
            if note not in ambiguities:
                ambiguities.append(note)

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
