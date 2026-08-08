---
name: pdf-analysis
version: 1.0.0
description: Extract, structure, and analyze content from PDF documents including text, tables, and metadata. Use when the user uploads or references PDFs for summarization, Q&A, or data extraction.
category: data
tools:
  - run_python
  - generate_file
  - create_file
  - ask_user
  - memory
inputs:
  - name: task
    type: string
    required: true
  - name: pdf_path
    type: string
    required: false
outputs:
  - name: result
    type: markdown
permissions:
  - filesystem
  - code_execution
popular: true
---

# PDF Analysis

## Job charter

Turn PDFs into reliable structured knowledge: extract text/tables, answer questions with page citations, and produce summaries or datasets without inventing content from unread pages.

## When to activate

- User provides a PDF path/upload or asks to analyze/summarize/extract from a PDF
- Need tables, figures captions, or clause extraction from reports/contracts
- Do **not** use for general web articles (`web-research`) or comparing two docs of mixed formats without PDFs (`document-comparison` may orchestrate this skill)

## Inputs

| Name | Required | Notes |
|------|----------|-------|
| `task` | yes | Question, extract spec, or summary goal |
| `pdf_path` | no | Local path or runtime-provided file reference |

If no file is available, ask via `ask_user`.

## Workflow

1. **Inspect** — Open PDF; record page count, metadata (title, author, dates), encryption/permissions.
2. **Choose extraction mode** — Digital text → text/table extractors; scanned/image-heavy → OCR path if available; hybrid if mixed.
3. **Extract selectively** — For Q&A, search/keyword-skim first; for full summary, chunk by section/page ranges.
4. **Structure** — Normalize headings, lists, tables into markdown or CSV via `generate_file` / `create_file`.
5. **Analyze per task** — Answer with page citations; for data tasks, validate column types and nulls.
6. **Cite & limit** — Never assert content from pages not successfully extracted.

## Decision rules

- Prefer verbatim quotes for legal/financial figures; paraphrase elsewhere.
- Multi-column and footer noise: strip running headers/footers when they pollute extraction.
- If OCR confidence is low, flag uncertain spans instead of silent guesses.
- Large PDFs (>50 pages): outline first, then deep-dive sections relevant to `task`.
- Route pure statistical analysis of extracted tables to `data-analysis`.

## Tool rules

- `run_python`: primary extraction (e.g. pdfplumber/pypdf/pymupdf when installed); table → DataFrame; OCR only if libraries present—otherwise report limitation.
- `generate_file` / `create_file`: CSV of tables, cleaned markdown dump, page-index.
- `memory`: store outline, page map, key extracted facts for follow-up questions.
- Do not upload PDF contents to network tools unless user explicitly requests.

## Output contract

```markdown
# PDF analysis: <filename>

## Document profile
Pages | metadata | extraction method | limitations

## Answer / results
...

## Evidence
- p.N: "quote or paraphrase"

## Extracted structures
- Tables: list + file paths if written
- Sections outline

## Gaps
Pages failed / images not OCR'd / ambiguous figures
```

## Validation

- [ ] Page citations exist for factual claims
- [ ] Numbers match extracted text (spot-check)
- [ ] Extraction method and failures disclosed
- [ ] No claims from non-extracted pages

## Failure handling

- **Encrypted PDF**: request password or unlocked file.
- **Scan-only, no OCR libs**: deliver metadata + limitation; ask for text export.
- **Garbled extract**: try alternate library; reduce to per-page manual focus.
- **Huge file / timeout**: process in page batches; return partial with progress note.
