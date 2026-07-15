from app.schemas import GuidelinesIn, ProductIn

NAME = "extract"

SYSTEM_PROMPT = (
    "You are an expert Product Attribute Extraction System. Your task is to "
    "classify ONLY the single specified attribute. Return EVERY allowed value "
    "that applies based on the product details: if several apply, include all of "
    "them; if none applies confidently, return an empty list. Choose only from "
    "the allowed values; never invent a value. Follow this decision order: "
    "Description, then Product Name, then Specifications, then Category."
)


def build_attribute_prompt(
    attribute_name: str, guidelines: GuidelinesIn, product: ProductIn
) -> list[dict]:
    allowed = "\n".join(guidelines.allowedValues)
    specs = "\n".join(f"{k}: {v}" for k, v in product.specifications.items())
    user = (
        f"ATTRIBUTE\n{attribute_name}\n\n"
        f"ATTRIBUTE DESCRIPTION\n{guidelines.instructions}\n\n"
        f"ALLOWED VALUES\n{allowed}\n\n"
        f"PRODUCT INFORMATION\n"
        f"Product Name: {product.name}\n"
        f"Description: {product.description}\n"
        f"Specifications:\n{specs}\n"
    )
    return [
        {"role": "system", "content": SYSTEM_PROMPT},
        {"role": "user", "content": user},
    ]
