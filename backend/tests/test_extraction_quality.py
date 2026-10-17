"""Comprehensive regression test suite for job requirement extraction quality.

Tests cover:
A. The Techechelons Full Stack Intern description (exact supplied text).
B. Conventional backend job description (languages, APIs, databases, testing, deployment).
C. Frontend job description (frameworks, HTML/CSS, UI responsibilities).
D. Culture/marketing-heavy description with few genuine requirements.
E. Internship / learning opportunities (distinguishing 'will learn' from mandatory qualifications).
F. Formatting edge cases (markdown bullets, headings, aliases, duplicate mentions, very long text).
"""

import pytest
from backend.app.jobs.extractor import (
    extract_requirements_deterministic,
    normalize_job_text,
    _extract_title_and_company,
    analyze_job_text,
)
from backend.app.schemas import Priority

# Fixture A: Techechelons Full Stack Intern Description
TECHECHELONS_JOB_DESC = """
About the job
TechEchelons Infosolutions is looking for a passionate Full Stack Developer Intern (MEAN/MERN Stack) who is eager to build end-to-end web applications. You will be working directly on real-world client and internal projects, learning industry standards, and collaborating with our senior engineering team.

Key Responsibilities:
- Design, build, and maintain frontend and backend components of web applications.
- Collaborate with engineering team to integrate REST APIs and databases.
- Develop clean, maintainable, and responsive UI components using HTML, CSS, and modern JavaScript.
- Work with MEAN/MERN stack technologies to deliver end-to-end features.
- Participate in code reviews, debug issues, and deploy web applications.

Requirements & Qualifications:
- Basic understanding of Full Stack development principles.
- Familiarity with frontend technologies (HTML5, CSS3, JavaScript).
- Exposure to Node.js, Express, and MongoDB or SQL databases.
- Strong problem-solving skills and willingness to learn modern web development workflows.

What You Will Learn & Experience:
- You will learn how to build complete production projects from scratch.
- Training in automated testing, Git version control, and CI/CD deployment pipelines.
- Hands-on mentorship from senior software engineers.
"""

# Fixture B: Conventional Backend Job Description
CONVENTIONAL_BACKEND_DESC = """
Senior Python Backend Engineer at DataFlow Systems

Responsibilities:
- Architect and develop high-throughput REST APIs and microservices using FastAPI and Python.
- Optimize complex SQL database queries and schema migrations in PostgreSQL.
- Write robust automated tests with pytest, maintaining >85% test coverage.
- Containerize services with Docker and manage deployment pipelines on AWS cloud infrastructure.
- Implement Redis caching layers and secure OAuth2 JWT authentication.

Requirements:
- Minimum 3+ years experience in Python backend development.
- Strong knowledge of relational databases (PostgreSQL or MySQL) and query optimization.
- Must have experience with Docker containerization and CI/CD automated deployment.
- Must be proficient with Git version control and RESTful API architecture.
- Preferred: Experience with Redis caching and Celery asynchronous task queues.
"""

# Fixture C: Frontend Description
FRONTEND_DESC = """
Frontend Web Developer at PixelCraft Studios

About the Role:
We are looking for a creative Frontend Engineer to craft delightful, accessible user interfaces.

Requirements:
- Strong proficiency in modern JavaScript, HTML5, and CSS3 styling.
- Hands-on experience building reactive web interfaces with React and Next.js.
- Deep understanding of responsive layout design, CSS Grid, Flexbox, and browser rendering.
- Experience consuming backend REST APIs and client-side state management.
- Passion for web accessibility (WCAG), performance optimization, and cross-browser testing.
"""

# Fixture D: Culture & Marketing Heavy Description
CULTURE_HEAVY_DESC = """
InnovateX — Changing the Future of Digital Work!

About Us:
At InnovateX, we believe in radical transparency, daily kombucha taps, unlimited PTO, and work-life harmony!
We hold annual team retreats in Bali, weekly board game nights, and provide top-of-the-line ergonomic standing desks.
Our culture is founded on empathy, innovation, and psychological safety. Join our vibrant, hyper-collaborative family!

Role Overview:
We are seeking an Engineer to join our team.

Technical Expectations:
- You must know Python for script automation and data parsing.
- Ability to query SQL databases to generate reporting metrics.
- Familiarity with Git version control.

Perks:
- Comprehensive dental and vision care.
- 401(k) matching up to 6%.
- Wellness stipend.
"""

# Fixture E: Learning / Internship Opportunity
LEARNING_INTERN_DESC = """
Software Engineering Intern (Summer Program) at EduTech Labs

Role Summary:
EduTech Labs is welcoming undergraduate students to our 12-week summer mentorship program! No prior professional experience required.

What You Will Learn During the Internship:
- Interns will learn the basics of Node.js and Express backend development.
- You will receive training in Docker containerization and cloud deployment.
- Mentors will teach you how to write automated tests and practice Git collaboration.
- You will explore MongoDB and relational database design through guided exercises.

Basic Prerequisites:
- Foundational coursework in computer science (Java or Python programming).
- Curiosity and desire to build software applications.
"""


def test_fixture_a_techechelons_fullstack_intern():
    """Verify Techechelons Full Stack Intern extracts MEAN/MERN, Full Stack, HTML/CSS, Frontend/Backend, End-to-End."""
    title, company = _extract_title_and_company(TECHECHELONS_JOB_DESC)
    assert "Full Stack" in title
    assert "techechelons" in company.lower()

    requirements = extract_requirements_deterministic(TECHECHELONS_JOB_DESC)

    req_keys = {r.taxonomy_key for r in requirements}
    req_names = {r.name for r in requirements}

    # Must extract core competencies explicitly mentioned
    assert "fullstack_web" in req_keys or any("Full-Stack" in name for name in req_names)
    assert "mean_mern_stack" in req_keys or any("MEAN" in name or "MERN" in name for name in req_names)
    assert "html_css" in req_keys or any("HTML" in name for name in req_names)
    assert "backend_dev" in req_keys or any("Backend" in name for name in req_names)
    assert "frontend_web" in req_keys or any("Frontend" in name for name in req_names)
    assert "end_to_end_project" in req_keys or any("End-to-End" in name for name in req_names)

    # Check total requirements count is substantial (at least 5-6 requirements, not just 2)
    assert len(requirements) >= 5

    # Check priorities: 'will learn' sentences must map to NICE TO HAVE
    for req in requirements:
        # All requirements must have valid source sentences
        assert req.source_sentence is not None and len(req.source_sentence.strip()) > 5
        # Automated testing and deployment are listed under "What You Will Learn", so should be NICE
        if req.taxonomy_key in ("testing", "deployment"):
            assert req.priority == Priority.NICE


def test_fixture_b_conventional_backend():
    """Verify backend description extracts Python, REST APIs, SQL, Testing, Deployment, Caching, and distinguishes MUST vs NICE."""
    title, company = _extract_title_and_company(CONVENTIONAL_BACKEND_DESC)
    assert "Backend" in title or "Python" in title
    assert "DataFlow" in company

    requirements = extract_requirements_deterministic(CONVENTIONAL_BACKEND_DESC)

    req_keys = {r.taxonomy_key for r in requirements}
    assert "python" in req_keys
    assert "rest_api" in req_keys
    assert "sql_database" in req_keys
    assert "testing" in req_keys
    assert "deployment" in req_keys
    assert "caching_redis" in req_keys

    # Check MUST vs NICE
    must_keys = {r.taxonomy_key for r in requirements if r.priority == Priority.MUST}
    nice_keys = {r.taxonomy_key for r in requirements if r.priority == Priority.NICE}

    assert "python" in must_keys
    assert "sql_database" in must_keys
    assert "deployment" in must_keys
    # Redis was explicitly in 'Preferred: Experience with Redis caching'
    assert "caching_redis" in nice_keys


def test_fixture_c_frontend():
    """Verify frontend description extracts HTML/CSS, Frontend UI, React, REST API, Testing."""
    title, company = _extract_title_and_company(FRONTEND_DESC)
    assert "Frontend" in title
    assert "PixelCraft" in company

    requirements = extract_requirements_deterministic(FRONTEND_DESC)

    req_keys = {r.taxonomy_key for r in requirements}
    assert "html_css" in req_keys
    assert "frontend_web" in req_keys
    assert "rest_api" in req_keys


def test_fixture_d_culture_heavy():
    """Verify culture-heavy description extracts only genuine requirements without hallucinations."""
    requirements = extract_requirements_deterministic(CULTURE_HEAVY_DESC)

    req_keys = {r.taxonomy_key for r in requirements}
    # Only Python, SQL, and Git were listed as technical expectations
    assert "python" in req_keys
    assert "sql_database" in req_keys
    assert "git_vcs" in req_keys

    # Should NOT hallucinate Docker, Testing, Auth, Frontend, etc.
    assert "deployment" not in req_keys
    assert "frontend_web" not in req_keys
    assert "testing" not in req_keys

    # Total should be concise
    assert len(requirements) <= 4


def test_fixture_e_learning_intern_opportunities():
    """Verify internship posting classifies training/learning opportunities as NICE TO HAVE."""
    requirements = extract_requirements_deterministic(LEARNING_INTERN_DESC)

    req_keys = {r.taxonomy_key for r in requirements}
    # Should detect training topics
    assert "deployment" in req_keys or "testing" in req_keys

    # The training topics must be marked NICE, not MUST
    for req in requirements:
        if req.taxonomy_key in ("deployment", "testing", "nosql_database"):
            assert req.priority == Priority.NICE, f"{req.name} should be NICE TO HAVE since it is a learning topic"


def test_fixture_f_edge_cases_and_normalization():
    """Verify markdown bullets, hashes, smart quotes, duplicate mentions, and long text."""
    messy_text = """
    # Job Title: Senior Java Developer & Cloud Specialist
    Company: Enterprise Cloud Corp.
    
    ### Core Duties:
    * “Design and architect” robust Java microservices with Spring Boot.
    * Build RESTful API endpoints and integrate SQL databases.
    * Build REST APIs for mobile applications.
    * Write automated unit & integration tests using JUnit.
    * Deploy containers using Docker & Kubernetes on AWS.
    
    ### Requirements:
    • Must have 5+ years of Java development experience.
    • Must have strong SQL and relational database knowledge.
    • Must possess hands-on Docker and cloud deployment skills.
    • Experience with Git source control.
    """

    normalized = normalize_job_text(messy_text)
    assert "“" not in normalized
    assert "”" not in normalized

    requirements = extract_requirements_deterministic(messy_text)
    req_keys = [r.taxonomy_key for r in requirements]

    # Check deduplication: each taxonomy rule appears only once despite multiple mentions in bullets & requirements
    assert req_keys.count("java_jvm") == 1
    assert req_keys.count("rest_api") == 1
    assert req_keys.count("sql_database") == 1
    assert req_keys.count("testing") == 1
    assert req_keys.count("deployment") == 1
    assert req_keys.count("git_vcs") == 1

    # Empty text handling
    empty_reqs = extract_requirements_deterministic("   \n\n   ")
    assert len(empty_reqs) == 0


@pytest.mark.asyncio
async def test_full_analyze_job_text_integration():
    """Verify analyze_job_text integration with title, company, requirements, and ambiguities."""
    result = await analyze_job_text(TECHECHELONS_JOB_DESC)
    assert result["title"] == "Full Stack Developer Intern"
    assert result["company"] == "TechEchelons Infosolutions"
    assert len(result["requirements"]) >= 5
    assert result["confirmed"] is False
