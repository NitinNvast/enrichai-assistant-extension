# Multi-Value Attribute Classification — Design Spec

**Date:** 2026-07-15
**Status:** Approved for planning
**Scope:** Change `/api/extract` from single-value to multi-value classification, end-to-end.

---

## 1. Purpose & Goals

Today `/api/extract` returns a **single** attribute value chosen from the guideline's
allowed values (or empty). Some attributes are genuinely multi-valued — e.g. a
`Material` of "Leather and Rubber" — and reviewers want *every* applicable value
surfaced, not just one.

This change makes the classifier return **one or more** values, always drawn
**strictly from the guideline's allowed values**. It must never invent or return a
value that is not in the vocabulary; the closed-vocabulary guarantee is preserved.

### Success criteria

- For a product whose details support several allowed values, the API returns all of them.
- For a single-valued attribute, it returns exactly one value.
- When nothing applies confidently, it returns an empty list.
- No returned value is ever outside the guideline's allowed values (enforced structurally, not just by prompt).
- Backend and extension pure-logic have automated tests; no real LLM calls in tests.

### Non-goals

- Returning new/unlisted values discovered in the product (explicitly out of scope).
- Per-attribute cardinality configuration (single- vs multi-valued). The model infers
  applicability from the product details; no config is added.
- Ranking / confidence scores per value.
- Sending per-value guideline notes to the model (tracked separately; not part of this change).

---

## 2. Key Decisions (with rationale)

| Decision | Choice | Why |
|----------|--------|-----|
| Output shape | `classifications: list[str]` replaces `classification: str` | Directly expresses "one or more"; empty list = abstain. |
| Vocabulary safety | Structured-output **array of enum** items | The model *cannot* emit a value outside the allowed set; no reliance on prompt obedience. |
| "Nothing applies" | Empty list `[]` | Mirrors the old empty-string abstain; means "needs human review". |
| Cap on count | None | A product can legitimately be many values; single-valued attributes yield one via the product evidence. YAGNI on per-attribute limits. |
| Ordering | Follow the guideline's allowed-value order | Deterministic, stable output regardless of the order the model emits. |
| Field rename | `classification` → `classifications` (breaking) | One consumer (the extension), v0.1.0; clarity over back-compat. |
| De-duplication | Canonicalize each item, drop non-matches, dedupe | Guards against case variants and repeats from the model. |

---

## 3. Data Flow (unchanged except payload shape)

```
DOM → content script → side panel buildPayload → POST /api/extract
    → build_attribute_prompt → OpenAI (array-of-enum structured output)
    → per-item _match_allowed + dedupe + order → { attribute, classifications, model }
    → side panel renders the list
```

The request payload (`ExtractRequest`: attributeName, guidelines, product, context) is
**unchanged**. Only the response shape changes.

---

## 4. Component Changes

### 4.1 Backend

**`app/schemas.py`**
- `ExtractResponse.classification: str` → `classifications: list[str]`.
- `attribute` and `model` unchanged.

**`app/llm/openai_client.py`**
- Replace the single-string schema with:
  ```python
  "classifications": {
      "type": "array",
      "items": {"type": "string", "enum": allowed_values},  # no "" member
      "uniqueItems": True,
  }
  ```
  `required: ["classifications"]`, `strict: True`. An empty array is valid.
- `classify_attribute(...)` returns `list[str]` (parsed from `data["classifications"]`,
  defaulting to `[]`). Malformed JSON still raises `LLMError`.

**`app/tasks/extract.py`** (prompt)
- System prompt updated: *"Return EVERY allowed value that applies based on the product
  details. If several apply, include all of them; if none applies confidently, return an
  empty list. Choose only from the allowed values; never invent a value."*
- Keep the decision order (Description → Product Name → Specifications → Category).

**`app/routers/extract.py`**
- Apply `_match_allowed` to each raw item; drop items that don't match; **dedupe**;
  order the survivors by their index in `req.guidelines.allowedValues`.
- Return `ExtractResponse(attribute=..., classifications=[...], model=...)`.

### 4.2 Extension

**`src/types/index.ts`**
- `ExtractResponse.classification: string` → `classifications: string[]`.
- Propagate through any message/result types that carry the classification.

**`src/sidepanel/App.tsx`**
- Render `classifications` as a list. Empty list → a "no confident match — review" message.
- Result/identity handling continues to key on product + attribute; the displayed result
  is now a list.

### 4.3 Docs

- Update `README.md` / any API reference snippet describing the `/api/extract` response.

---

## 5. Error Handling & Edge Cases

- **No confident match** → `classifications: []`; the UI shows a review prompt, not an error.
- **Model returns a case/format variant** (e.g. `"wide"`) → canonicalized via `_match_allowed`
  to the exact allowed spelling (`"Wide"`).
- **Model returns duplicates** → deduped after canonicalization.
- **Upstream/LLM failure** → unchanged: `502 upstream_error`.
- **Empty `allowedValues`** → already rejected by request validation (`min_length=1`), unchanged.

---

## 6. Testing Strategy (TDD)

**Backend**
- `openai_client`: builds an array-of-enum schema from `allowed_values`; parses a list
  response; returns `[]` for an empty array; raises `LLMError` on malformed JSON. (OpenAI mocked.)
- `tasks/extract`: prompt contains the multi-value instruction and the allowed values.
- `routers/extract`: canonicalizes each item, drops non-matches, dedupes, orders by
  allowed-value index; empty model output → `classifications: []`.

**Extension**
- `types`: response type is `string[]`.
- `App.tsx` (or its pure helpers): renders multiple values; empty list → review message.

No test performs a real network/LLM call.

---

## 7. Out of Scope / Follow-ups

- Passing per-value guideline **notes** into the `ALLOWED VALUES` prompt block to improve
  synonym mapping (separate change; keeps enum constrained to bare values).
- Per-attribute cardinality hints (force single-valued attributes to one value).
