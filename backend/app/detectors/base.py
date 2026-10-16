"""Signal model and base classes for deterministic code detectors."""
import hashlib
from typing import Optional
from pydantic import BaseModel, Field

from backend.app.schemas import SignalStrength


class DetectedSignal(BaseModel):
    """Normalized output from any deterministic code detector."""
    signal_id: str = Field(..., description="Stable SHA-256 hash of detector, path, lines, and snippet")
    detector: str = Field(..., description="Detector name, e.g. rest_api, sql_database, testing")
    category_key: str = Field(..., description="Standardized taxonomy key")
    file_path: str = Field(..., description="Repository relative file path")
    line_start: int = Field(..., description="1-indexed line start")
    line_end: int = Field(..., description="1-indexed line end")
    snippet: str = Field(..., description="Exact snippet of source code extracted from lines")
    blob_sha: str = Field(..., description="Git blob SHA or file content hash at pinned commit")
    strength: SignalStrength = Field(..., description="strong, medium, or weak")
    counted: bool = Field(True, description="Whether this signal counts as genuine proof")
    why: str = Field(..., description="Explanation of pattern or AST node matched")
    limitation: Optional[str] = Field(None, description="Known boundary or why signal is partial/weak")


def generate_signal_id(detector: str, file_path: str, line_start: int, line_end: int, snippet: str) -> str:
    """Computes a stable deterministic signal ID hash."""
    raw = f"{detector}:{file_path}:{line_start}-{line_end}:{snippet.strip()}"
    return hashlib.sha256(raw.encode("utf-8")).hexdigest()[:16]
