from typing import Literal

from pydantic import BaseModel, Field, HttpUrl

SummaryLength = Literal["short", "medium", "long"]


class SummarizeOptions(BaseModel):
    length: SummaryLength = "medium"


class SummarizeRequest(BaseModel):
    url: HttpUrl
    title: str = Field(default="", max_length=500)
    content: str = Field(min_length=1)
    options: SummarizeOptions = Field(default_factory=SummarizeOptions)


class Usage(BaseModel):
    prompt_tokens: int = 0
    completion_tokens: int = 0
    total_tokens: int = 0


class SummarizeResponse(BaseModel):
    summary: str
    model: str
    usage: Usage
    truncated: bool = False


class ErrorBody(BaseModel):
    code: str
    message: str


class ErrorResponse(BaseModel):
    error: ErrorBody
