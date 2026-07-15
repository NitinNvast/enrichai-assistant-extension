import pytest
from pydantic import ValidationError

from app.schemas import ExtractRequest, ExtractResponse

VALID = {
    "attributeName": "Fit - Shoe Width",
    "guidelines": {"instructions": "Classify width.", "allowedValues": ["Narrow", "Wide"]},
    "product": {"name": "Shoe", "description": "d", "specifications": {"Fit": "Wide Fit"}},
    "context": {"projectId": "P", "catalogId": "C", "terminalNodeId": "N"},
}


def test_valid_request_parses():
    req = ExtractRequest(**VALID)
    assert req.attributeName == "Fit - Shoe Width"
    assert req.guidelines.allowedValues == ["Narrow", "Wide"]
    assert req.product.specifications["Fit"] == "Wide Fit"


def test_empty_allowed_values_is_invalid():
    bad = {**VALID, "guidelines": {"instructions": "x", "allowedValues": []}}
    with pytest.raises(ValidationError):
        ExtractRequest(**bad)


def test_context_defaults_to_nulls():
    body = {k: v for k, v in VALID.items() if k != "context"}
    req = ExtractRequest(**body)
    assert req.context.projectId is None


def test_extract_response_holds_classifications_list():
    r = ExtractResponse(attribute="A", classifications=["X", "Y"], model="m")
    assert r.classifications == ["X", "Y"]
