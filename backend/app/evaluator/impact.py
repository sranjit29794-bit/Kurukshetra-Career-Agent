"""ChangeSentinel: Maps changed files to affected skill categories."""
from typing import Dict, List, Set

# Deterministic mapping from changed file extensions/patterns to candidate skills
PATH_TO_TAXONOMY_MAP = {
    "rest_api": [r"router", r"routes", r"api", r"endpoint", r"views", r"app/main\.py", r"server\.py"],
    "sql_database": [r"model", r"models", r"schema", r"schemas", r"database", r"db\.py", r"migration", r"\.sql$"],
    "testing": [r"test", r"tests/", r"conftest\.py", r"pytest\.ini"],
    "auth": [r"auth", r"jwt", r"token", r"login", r"security", r"password"],
    "async_concurrency": [r"async", r"worker", r"tasks", r"queue", r"service"],
    "deployment": [r"dockerfile", r"docker-compose", r"compose\.ya?ml", r"\.github/workflows", r"fly\.toml", r"render\.yaml"],
    "python": [r"\.py$"],
}


def map_changed_paths_to_taxonomies(changed_paths: List[str]) -> Set[str]:
    """Analyzes a list of changed/added/removed file paths and returns

    the set of skill taxonomy keys affected by the code change.
    """
    import re
    affected: Set[str] = set()

    for path in changed_paths:
        lower_path = path.lower()
        for taxonomy_key, patterns in PATH_TO_TAXONOMY_MAP.items():
            for pat in patterns:
                if re.search(pat, lower_path):
                    affected.add(taxonomy_key)
                    break

    return affected
