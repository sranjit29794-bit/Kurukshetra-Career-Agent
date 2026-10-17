# DevProof Data Privacy & Retention Policy

Reference: docs/BRAIN.md (§3 Invariants, §11, §12) and Defect 4 Specifications.

---

## 1. Zero Binary Retention (No PDF Storage)

DevProof strictly enforces a **Zero Binary Retention** policy for candidate resumes:
- **No PDF Storage**: Uploaded resume files (PDF, DOCX, or other binary formats) are processed purely in-memory in ephemeral buffers. DevProof never writes uploaded candidate resume PDFs to disk, object storage, or SQLite / PostgreSQL databases.
- **Immediate Discard**: As soon as the text extraction and metadata inspection (e.g. `/Annots` hyperlink scanning via `pypdf`) complete, all raw binary buffers are garbage-collected and discarded.

---

## 2. Minimal Structured Claim Storage

Only non-sensitive, structured technical signals extracted during parsing are retained in the database (`ResumeModel`):
1. **Resume Identifier**: Randomly generated UUID (`resume_<hex12>`).
2. **Original Filename**: Stored solely for user reference (e.g., `resume_a.pdf`).
3. **Claimed Skills (`claimed_skills`)**:
   - `skill`: Normalized display name (e.g. `"FastAPI / REST APIs"`).
   - `taxonomy_key`: Fixed taxonomy identifier (e.g. `"rest_api"`).
   - `source_line`: Integer line number in the source document.
   - `kind`: Claim classification (`"explicit"` or `"inferred"`).
4. **Discovered Repositories (`repo_candidates`)**:
   - `url`: Discovered GitHub profile or repository URL (e.g. `https://github.com/sranjit29794-bit/student-api`).
   - `owner`: GitHub user or organization name.
   - `name`: GitHub repository name.
   - `kind`: `"repo"` or `"profile"`.
   - `source`: Extraction origin (`"text"` for visible text, `"hyperlink"` for PDF annotation).
5. **No Raw Text Persistence**: `extracted_text` column is set to empty string (`""`) in persistent storage to prevent storing personally identifiable information (PII) such as personal phone numbers, addresses, or unrelated private history.

---

## 3. Untrusted Data Handling & Safety Invariants

1. **Untrusted Data Isolation**: All text and metadata extracted from candidate resumes and job postings are treated as untrusted input. Static analysis only — no repo or candidate code is ever executed (`no eval/exec/subprocess`).
2. **Standard Error Envelopes**: File upload failures, corrupted PDFs, or files exceeding the 10MB limit are rejected with HTTP 400 / 413 and structured error envelopes (`{"error": {"code": "...", "message": "...", "retryable": false}}`).
3. **Scanned / Image Document Handling**: PDFs with insufficient selectable text (< 20 characters) yield `{status: "no_text"}` and prompt candidate manual entry, ensuring no OCR hallucinations or opaque failures.
