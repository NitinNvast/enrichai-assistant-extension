# Multi-Value Attribute Classification Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Change `/api/extract` from returning a single attribute value to returning one or more values, always drawn strictly from the guideline's allowed values.

**Architecture:** The OpenAI structured-output schema changes from a single enum string to an array of enum items (so invented values remain impossible). The route canonicalizes each returned item, drops non-matches, dedupes, and orders by the allowed-values order. The response field is renamed `classification` → `classifications` (list). The extension type and side-panel UI render the list.

**Tech Stack:** Backend — Python, FastAPI, Pydantic, OpenAI SDK, pytest (run via `.venv/bin/pytest`). Extension — TypeScript, React, Vitest.

## Global Constraints

- Returned values MUST come only from `guidelines.allowedValues`; never invent values. Enforced structurally via the JSON-schema `enum`, not just the prompt.
- "Nothing applies confidently" → empty list `[]` (the abstain signal). The `""` member is removed from the item enum.
- The route orders results by their index in `guidelines.allowedValues` and de-duplicates (after case-insensitive canonicalization).
- No test performs a real network or LLM call.
- Request payload shape (`ExtractRequest`) is unchanged; only the response shape changes.
- Backend tests run from `backend/` with `.venv/bin/pytest`. Extension checks run from `extension/` with `npx vitest run`, `npx tsc --noEmit`, `npm run build`.

---

### Task 1: Backend — multi-value prompt instruction

**Files:**
- Modify: `backend/app/tasks/extract.py` (the `SYSTEM_PROMPT` constant)
- Test: `backend/tests/test_extract_task.py`

**Interfaces:**
- Consumes: nothing new.
- Produces: `build_attribute_prompt(attribute_name: str, guidelines: GuidelinesIn, product: ProductIn) -> list[dict]` (signature unchanged); the system message now instructs multi-value selection.

- [ ] **Step 1: Add the failing test**

Add to `backend/tests/test_extract_task.py`:

```python
def test_prompt_instructs_multi_value_selection():
    guidelines = GuidelinesIn(instructions="x", allowedValues=["Narrow", "Wide"])
    product = ProductIn(name="Shoe", description="d", specifications={})
    system = build_attribute_prompt("Fit - Shoe Width", guidelines, product)[0]["content"]
    assert "EVERY allowed value" in system
    assert "empty list" in system
```

- [ ] **Step 2: Run it and watch it fail**

Run: `cd backend && .venv/bin/pytest tests/test_extract_task.py::test_prompt_instructs_multi_value_selection -v`
Expected: FAIL — `assert "EVERY allowed value" in system` (current prompt says "single specified attribute").

- [ ] **Step 3: Update the system prompt**

In `backend/app/tasks/extract.py`, replace the `SYSTEM_PROMPT` assignment with:

```python
SYSTEM_PROMPT = (
    "You are an expert Product Attribute Extraction System. Your task is to "
    "classify ONLY the single specified attribute. Return EVERY allowed value "
    "that applies based on the product details: if several apply, include all of "
    "them; if none applies confidently, return an empty list. Choose only from "
    "the allowed values; never invent a value. Follow this decision order: "
    "Description, then Product Name, then Specifications, then Category."
)
```

- [ ] **Step 4: Run the task tests and watch them pass**

Run: `cd backend && .venv/bin/pytest tests/test_extract_task.py -v`
Expected: PASS — both `test_prompt_includes_attribute_allowed_values_and_specs` (unchanged user content) and the new test pass.

- [ ] **Step 5: Commit**

```bash
git add backend/app/tasks/extract.py backend/tests/test_extract_task.py
git commit -m "feat(api): prompt instructs returning all applicable allowed values"
```

---

### Task 2: Backend — multi-value response contract

Atomic change: `ExtractResponse`, the OpenAI schema, and the route must change together to stay consistent. Do all edits, then run the whole backend suite green.

**Files:**
- Modify: `backend/app/schemas.py` (`ExtractResponse`)
- Modify: `backend/app/llm/openai_client.py` (`classify_attribute`)
- Modify: `backend/app/routers/extract.py` (`_extract`, add `_match_allowed_many`)
- Test: `backend/tests/test_extract_schemas.py`, `backend/tests/test_openai_client.py`, `backend/tests/test_extract_route.py`

**Interfaces:**
- Consumes: `build_attribute_prompt(...)` from Task 1; existing `_match_allowed(value: str, allowed: list[str]) -> str`.
- Produces:
  - `ExtractResponse(attribute: str, classifications: list[str], model: str)`
  - `openai_client.classify_attribute(messages: list[dict], model: str, allowed_values: list[str]) -> list[str]`
  - `_match_allowed_many(values: list[str], allowed: list[str]) -> list[str]` — canonicalized, de-duplicated, ordered by `allowed` index.

- [ ] **Step 1: Update the schema test**

In `backend/tests/test_extract_schemas.py`, add at the top with the other imports:

```python
from app.schemas import ExtractRequest, ExtractResponse
```

and add this test:

```python
def test_extract_response_holds_classifications_list():
    r = ExtractResponse(attribute="A", classifications=["X", "Y"], model="m")
    assert r.classifications == ["X", "Y"]
```

- [ ] **Step 2: Update the openai_client test**

Replace the body of `backend/tests/test_openai_client.py` with:

```python
import json

from app.llm import openai_client


class _FakeMessage:
    def __init__(self, content):
        self.content = content


class _FakeChoice:
    def __init__(self, content):
        self.message = _FakeMessage(content)


class _FakeResponse:
    def __init__(self, content):
        self.choices = [_FakeChoice(content)]


def _fake_client_returning(content):
    class _FakeClient:
        def __init__(self, *args, **kwargs):
            self.chat = self
            self.completions = self

        def create(self, **kwargs):
            schema = kwargs["response_format"]["json_schema"]["schema"]
            prop = schema["properties"]["classifications"]
            assert prop["type"] == "array"
            assert "Wide" in prop["items"]["enum"]
            return _FakeResponse(content)

    return _FakeClient


def test_classify_attribute_parses_list(monkeypatch):
    monkeypatch.setattr(
        openai_client, "OpenAI", _fake_client_returning(json.dumps({"classifications": ["Wide"]}))
    )
    result = openai_client.classify_attribute(
        [{"role": "user", "content": "x"}], "gpt-4o", ["Narrow", "Wide"]
    )
    assert result == ["Wide"]


def test_classify_attribute_empty_list(monkeypatch):
    monkeypatch.setattr(
        openai_client, "OpenAI", _fake_client_returning(json.dumps({"classifications": []}))
    )
    result = openai_client.classify_attribute(
        [{"role": "user", "content": "x"}], "gpt-4o", ["Narrow", "Wide"]
    )
    assert result == []
```

- [ ] **Step 3: Update the route tests**

Replace the body of `backend/tests/test_extract_route.py` with:

```python
import pytest
from fastapi.testclient import TestClient

from app.llm import openai_client
from app.main import app

client = TestClient(app)

VALID_BODY = {
    "attributeName": "Fit - Shoe Width",
    "guidelines": {"instructions": "Classify width.", "allowedValues": ["Narrow", "Standard", "Wide", "Extra Wide"]},
    "product": {"name": "Nike Pegasus", "description": "wide forefoot", "specifications": {"Fit": "Wide Fit"}},
    "context": {"projectId": "P", "catalogId": "C", "terminalNodeId": "N"},
}


@pytest.fixture(autouse=True)
def mock_llm(monkeypatch):
    monkeypatch.setattr(openai_client, "classify_attribute", lambda messages, model, allowed: ["Wide"])


def test_extract_success():
    resp = client.post("/api/extract", json=VALID_BODY)
    assert resp.status_code == 200
    data = resp.json()
    assert data["attribute"] == "Fit - Shoe Width"
    assert data["classifications"] == ["Wide"]
    assert data["model"]


def test_extract_returns_multiple_ordered_by_allowed(monkeypatch):
    monkeypatch.setattr(openai_client, "classify_attribute", lambda m, model, a: ["Wide", "Narrow"])
    resp = client.post("/api/extract", json=VALID_BODY)
    # Ordered by allowedValues order: Narrow (index 0) before Wide (index 2).
    assert resp.json()["classifications"] == ["Narrow", "Wide"]


def test_extract_drops_out_of_list_values(monkeypatch):
    monkeypatch.setattr(openai_client, "classify_attribute", lambda m, model, a: ["Enormous", "Wide"])
    resp = client.post("/api/extract", json=VALID_BODY)
    assert resp.json()["classifications"] == ["Wide"]


def test_extract_dedupes_and_canonicalizes(monkeypatch):
    monkeypatch.setattr(openai_client, "classify_attribute", lambda m, model, a: ["wide", "Wide"])
    resp = client.post("/api/extract", json=VALID_BODY)
    assert resp.json()["classifications"] == ["Wide"]


def test_extract_empty_when_nothing_applies(monkeypatch):
    monkeypatch.setattr(openai_client, "classify_attribute", lambda m, model, a: [])
    resp = client.post("/api/extract", json=VALID_BODY)
    assert resp.json()["classifications"] == []


def test_extract_missing_attribute_is_invalid_request():
    body = {k: v for k, v in VALID_BODY.items() if k != "attributeName"}
    resp = client.post("/api/extract", json=body)
    assert resp.status_code == 422
    assert resp.json()["error"]["code"] == "invalid_request"


def test_extract_upstream_error(monkeypatch):
    def boom(messages, model, allowed):
        raise openai_client.LLMError("openai down")

    monkeypatch.setattr(openai_client, "classify_attribute", boom)
    resp = client.post("/api/extract", json=VALID_BODY)
    assert resp.status_code == 502
    assert resp.json()["error"]["code"] == "upstream_error"
```

- [ ] **Step 4: Run all three test files and watch them fail**

Run: `cd backend && .venv/bin/pytest tests/test_extract_schemas.py tests/test_openai_client.py tests/test_extract_route.py -v`
Expected: FAIL — `ExtractResponse` has no `classifications`, `classify_attribute` still returns a string, route returns `classification`.

- [ ] **Step 5: Update `ExtractResponse`**

In `backend/app/schemas.py`, replace the `ExtractResponse` class with:

```python
class ExtractResponse(BaseModel):
    attribute: str
    classifications: list[str]
    model: str
```

- [ ] **Step 6: Update `classify_attribute`**

In `backend/app/llm/openai_client.py`, replace the whole `classify_attribute` function with:

```python
def classify_attribute(messages: list[dict], model: str, allowed_values: list[str]) -> list[str]:
    settings = get_settings()
    client = OpenAI(api_key=settings.openai_api_key)

    # Structured output: `classifications` is an array whose items are constrained
    # to the allowed values, so the model can return one, several, or none — but
    # never a value outside the vocabulary. An empty array means "nothing applies".
    schema = {
        "type": "object",
        "properties": {
            "classifications": {
                "type": "array",
                "items": {"type": "string", "enum": allowed_values},
                "uniqueItems": True,
            },
        },
        "required": ["classifications"],
        "additionalProperties": False,
    }

    try:
        resp = client.chat.completions.create(
            model=model,
            messages=messages,
            temperature=0,
            response_format={
                "type": "json_schema",
                "json_schema": {"name": "attribute_classification", "schema": schema, "strict": True},
            },
        )
    except OpenAIError as exc:
        raise LLMError(str(exc)) from exc

    content = resp.choices[0].message.content or "{}"
    try:
        data = json.loads(content)
    except json.JSONDecodeError as exc:
        raise LLMError(f"invalid JSON from model: {content!r}") from exc
    values = data.get("classifications", [])
    if not isinstance(values, list):
        return []
    return [str(v) for v in values]
```

- [ ] **Step 7: Update the route**

In `backend/app/routers/extract.py`, add this helper directly below the existing `_match_allowed` function:

```python
def _match_allowed_many(values: list[str], allowed: list[str]) -> list[str]:
    """Canonicalize each value to its allowed spelling, drop non-matches and
    duplicates, and order the survivors by their position in `allowed`."""
    matched = {_match_allowed(v, allowed) for v in values}
    matched.discard("")
    return [candidate for candidate in allowed if candidate in matched]
```

Then replace the `_extract` function's tail (from `classification = ...` onward) so the whole function reads:

```python
def _extract(req: ExtractRequest) -> ExtractResponse:
    settings = get_settings()
    messages = build_attribute_prompt(req.attributeName, req.guidelines, req.product)
    try:
        raw = openai_client.classify_attribute(messages, settings.openai_model, req.guidelines.allowedValues)
    except LLMError:
        raise AppError(502, "upstream_error", "The classification service failed.")

    classifications = _match_allowed_many(raw, req.guidelines.allowedValues)
    return ExtractResponse(
        attribute=req.attributeName,
        classifications=classifications,
        model=settings.openai_model,
    )
```

- [ ] **Step 8: Run the full backend suite and watch it pass**

Run: `cd backend && .venv/bin/pytest -q`
Expected: PASS — all tests, including the updated schema/client/route tests.

- [ ] **Step 9: Commit**

```bash
git add backend/app/schemas.py backend/app/llm/openai_client.py backend/app/routers/extract.py \
        backend/tests/test_extract_schemas.py backend/tests/test_openai_client.py backend/tests/test_extract_route.py
git commit -m "feat(api): return one-or-more allowed values (classifications list)"
```

---

### Task 3: Extension — consume the classifications list

The response-type change and the side-panel render must change together (the type breaks `App.tsx` until it is updated). The extension has no React component-test harness, so this task is verified by the type checker, the existing Vitest suite staying green, and a production build — consistent with the codebase's existing test conventions (all extension tests are pure-logic).

**Files:**
- Modify: `extension/src/types/index.ts` (`ExtractResponse`)
- Modify: `extension/src/sidepanel/App.tsx` (result state, `onExtract`, done-render)

**Interfaces:**
- Consumes: `ExtractResult` = `{ ok: true; data: ExtractResponse } | { ok: false; error: {...} }` (unchanged wrapper; `ExtractResponse.classifications: string[]`).
- Produces: no new exported interface; `App` renders `result.classifications`.

- [ ] **Step 1: Change the response type**

In `extension/src/types/index.ts`, replace the `ExtractResponse` interface with:

```ts
export interface ExtractResponse {
  attribute: string
  classifications: string[]
  model: string
}
```

- [ ] **Step 2: Run the type checker and watch it fail**

Run: `cd extension && npx tsc --noEmit`
Expected: FAIL — `App.tsx` still references `res.data.classification` and a `{ classification: string }` result state.

- [ ] **Step 3: Update the result state type**

In `extension/src/sidepanel/App.tsx`, change the `result` state declaration (currently line ~33) to:

```tsx
const [result, setResult] = useState<{ attribute: string; classifications: string[] } | null>(null)
```

- [ ] **Step 4: Update the onExtract mapping**

In `extension/src/sidepanel/App.tsx`, in `onExtract`, replace the success line (currently line ~141):

```tsx
        setResult({ attribute: res.data.attribute, classifications: res.data.classifications })
```

- [ ] **Step 5: Update the done-render block**

In `extension/src/sidepanel/App.tsx`, replace the `phase === 'done'` block (currently lines ~197-203) with:

```tsx
      {phase === 'done' && result && (
        <section className="rounded border p-3">
          <p className="font-medium">Attribute Classification</p>
          <p className="mt-1 text-gray-700">{result.attribute}</p>
          {result.classifications.length ? (
            <ul className="mt-1 list-inside list-disc text-lg font-semibold">
              {result.classifications.map((v) => (
                <li key={v}>{v}</li>
              ))}
            </ul>
          ) : (
            <p className="mt-1 text-lg font-semibold text-gray-500">No confident value</p>
          )}
        </section>
      )}
```

- [ ] **Step 6: Typecheck, test, and build — all green**

Run: `cd extension && npx tsc --noEmit && npx vitest run && npm run build`
Expected: `tsc` clean; Vitest all pass (existing suite unaffected); build succeeds.

- [ ] **Step 7: Commit**

```bash
git add extension/src/types/index.ts extension/src/sidepanel/App.tsx
git commit -m "feat(extension): render multiple classification values"
```

---

## Notes for the implementer

- Do not add `""` to the item `enum` — abstain is expressed by an empty array. Adding `""` would let the model emit empty strings as list items.
- `_match_allowed` (single-value, case-insensitive) is reused by `_match_allowed_many`; do not delete or rename it.
- Ordering by `allowed` index is what makes output deterministic; do not preserve the model's emission order.
- The `ExtractRequest` payload and the content-script/side-panel detection flow are out of scope for this plan — do not touch them.
