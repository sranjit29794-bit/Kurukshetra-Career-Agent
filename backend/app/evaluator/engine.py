"""Evaluation engine: Maps verified signals to confirmed requirements and

evaluates assessment status strictly following project invariants.

Hard Invariants:
1. No evidence -> NOT_DEMONSTRATED (not a personal flaw, just not in scope).
2. DEMONSTRATED requires >= 1 strong verified signal.
3. Testing and Deployment are capped at PARTIAL in MVP (test files existing != tests passing).
4. Failure to analyze -> UNABLE_TO_ASSESS.
"""
from typing import Dict, List, Optional
from backend.app.schemas import (
    Assessment,
    AssessmentStatus,
    AssessmentStrength,
    EvidenceItem,
    RequirementDraft,
    SignalStrength,
)

CAPPED_CATEGORIES = {"testing", "deployment"}


class AssessmentEngine:
    """Evaluates confirmed job requirements against verified evidence."""

    @staticmethod
    def evaluate_requirement(
        req: RequirementDraft,
        evidence_items: List[EvidenceItem],
    ) -> Assessment:
        """Computes the status, strength, and explanatory summary for a single requirement."""
        # Filter evidence matching this requirement's taxonomy_key or search terms
        matching_evidence: List[EvidenceItem] = []
        for ev in evidence_items:
            # Check taxonomy match
            if req.taxonomy_key and ev.detector == req.taxonomy_key:
                matching_evidence.append(ev)
                continue

            # Check search terms in file_path or snippet (using word boundaries to prevent substring false positives)
            if req.search_terms:
                import re
                for term in req.search_terms:
                    term_escaped = re.escape(term.lower())
                    pattern = rf"\b{term_escaped}\b" if not term.startswith((".", "/")) else term_escaped
                    if re.search(pattern, ev.file_path.lower()) or re.search(pattern, ev.snippet.lower()):
                        matching_evidence.append(ev)
                        break

        # Counted signals (excluding ignored weak signals)
        counted_evidence = [e for e in matching_evidence if e.counted]
        strong_signals = [e for e in counted_evidence if e.strength == SignalStrength.STRONG]
        medium_signals = [e for e in counted_evidence if e.strength == SignalStrength.MEDIUM]

        # Case 1: No evidence found
        if not counted_evidence:
            return Assessment(
                id=None,
                requirement_id=req.id or 0,
                requirement_name=req.name,
                status=AssessmentStatus.NOT_DEMONSTRATED,
                strength=AssessmentStrength.NONE,
                summary=f"No matching evidence for '{req.name}' was found in the analyzed repository scope.",
                limitation="Not demonstrated in analyzed scope; does not mean candidate lacks the skill.",
                next_step=f"Add practical implementation examples or modules demonstrating {req.name}.",
                evidence=[],
            )

        # Determine preliminary status
        is_capped = req.taxonomy_key in CAPPED_CATEGORIES

        if strong_signals and not is_capped:
            status = AssessmentStatus.DEMONSTRATED
            strength = AssessmentStrength.STRONG
            summary = f"Strong evidence demonstrates '{req.name}' across {len(strong_signals)} verified implementation file(s)."
            limitation = None
            next_step = "Maintain test coverage and document architecture patterns."
        elif is_capped:
            status = AssessmentStatus.PARTIAL
            strength = AssessmentStrength.MODERATE
            if req.taxonomy_key == "testing":
                summary = f"Automated test suites and assertion files identified ({len(counted_evidence)} evidence points). Capped at PARTIAL per MVP rules (tests existing != tests passing)."
                limitation = "Static AST inspection confirms test structure; runtime CI execution required for DEMONSTRATED."
                next_step = "Connect CI workflow or execution logs to prove all tests pass."
            else:
                summary = f"Deployment/container manifests detected ({len(counted_evidence)} files). Capped at PARTIAL per MVP rules (manifest existing != active cloud deployment)."
                limitation = "Container definitions verified statically; live deployed URL or cluster check required for DEMONSTRATED."
                next_step = "Include cloud deployment verification or infrastructure-as-code manifests."
        elif medium_signals or counted_evidence:
            status = AssessmentStatus.PARTIAL
            strength = AssessmentStrength.MODERATE
            summary = f"Partial implementation evidence found for '{req.name}' in {len(counted_evidence)} file(s)."
            limitation = "Evidence includes preliminary structures or configuration without full end-to-end operation."
            next_step = f"Expand implementation with robust handlers and integration tests for {req.name}."
        else:
            status = AssessmentStatus.NOT_DEMONSTRATED
            strength = AssessmentStrength.NONE
            summary = f"Weak signals detected for '{req.name}' but rejected under verification rules."
            limitation = "Trivial statements, stubs, or comments do not count towards proof."
            next_step = f"Implement non-trivial logic for {req.name}."

        return Assessment(
            id=None,
            requirement_id=req.id or 0,
            requirement_name=req.name,
            status=status,
            strength=strength,
            summary=summary,
            limitation=limitation,
            next_step=next_step,
            evidence=matching_evidence,
        )

    @classmethod
    def evaluate_all(
        cls,
        requirements: List[RequirementDraft],
        evidence_items: List[EvidenceItem],
    ) -> List[Assessment]:
        """Evaluates all requirements against verified evidence."""
        return [cls.evaluate_requirement(req, evidence_items) for req in requirements]
