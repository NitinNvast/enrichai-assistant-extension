from app.schemas import GuidelinesIn, ProductIn
from app.tasks.extract import build_attribute_prompt


def test_prompt_includes_attribute_allowed_values_and_specs():
    guidelines = GuidelinesIn(instructions="Classify width.", allowedValues=["Narrow", "Wide"])
    product = ProductIn(name="Nike Pegasus", description="wide forefoot", specifications={"Fit": "Wide Fit"})

    messages = build_attribute_prompt("Fit - Shoe Width", guidelines, product)

    assert messages[0]["role"] == "system"
    user = messages[1]["content"]
    assert "Fit - Shoe Width" in user
    assert "Narrow" in user and "Wide" in user
    assert "Classify width." in user
    assert "Nike Pegasus" in user
    assert "Fit: Wide Fit" in user


def test_prompt_instructs_multi_value_selection():
    guidelines = GuidelinesIn(instructions="x", allowedValues=["Narrow", "Wide"])
    product = ProductIn(name="Shoe", description="d", specifications={})
    system = build_attribute_prompt("Fit - Shoe Width", guidelines, product)[0]["content"]
    assert "EVERY allowed value" in system
    assert "empty list" in system


def test_prompt_requires_grounding_in_product_details():
    guidelines = GuidelinesIn(instructions="x", allowedValues=["Narrow", "Wide"])
    product = ProductIn(name="Shoe", description="d", specifications={})
    system = build_attribute_prompt("Fit - Shoe Width", guidelines, product)[0]["content"]
    assert "only on the provided product details" in system
    assert "do not guess" in system
