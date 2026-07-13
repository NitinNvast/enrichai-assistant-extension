from app.schemas import SummarizeOptions

NAME = "summarize"

SYSTEM_PROMPT = (
    "You are a precise summarization assistant. Summarize the provided web page "
    "content faithfully and concisely. Do not add information that is not present. "
    "Ignore navigation menus, ads, cookie notices, and other boilerplate."
)

LENGTH_GUIDANCE: dict[str, str] = {
    "short": "2-3 sentences",
    "medium": "one short paragraph of 4-6 sentences",
    "long": "3-5 concise paragraphs",
}


def build_messages(
    title: str, url: str, content: str, options: SummarizeOptions
) -> list[dict]:
    guidance = LENGTH_GUIDANCE[options.length]
    user = (
        f"Summarize the following web page in {guidance}.\n\n"
        f"Title: {title}\n"
        f"URL: {url}\n\n"
        f"Content:\n{content}"
    )
    return [
        {"role": "system", "content": SYSTEM_PROMPT},
        {"role": "user", "content": user},
    ]
