from pydantic import BaseModel, Field


class GuidelinesIn(BaseModel):
    instructions: str = ""
    allowedValues: list[str] = Field(min_length=1)


class ProductIn(BaseModel):
    name: str = Field(min_length=1)
    description: str = ""
    specifications: dict[str, str] = Field(default_factory=dict)


class ContextIn(BaseModel):
    projectId: str | None = None
    catalogId: str | None = None
    terminalNodeId: str | None = None


class ExtractRequest(BaseModel):
    attributeName: str = Field(min_length=1)
    guidelines: GuidelinesIn
    product: ProductIn
    context: ContextIn = Field(default_factory=ContextIn)


class ExtractResponse(BaseModel):
    attribute: str
    classification: str
    model: str


class ErrorBody(BaseModel):
    code: str
    message: str


class ErrorResponse(BaseModel):
    error: ErrorBody
