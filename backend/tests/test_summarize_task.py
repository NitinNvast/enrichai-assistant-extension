from app.schemas import SummarizeOptions
from app.tasks.summarize import build_messages


def test_build_messages_has_system_and_user_roles():
    msgs = build_messages("Title", "https://x.com", "Body text", SummarizeOptions())
    assert [m["role"] for m in msgs] == ["system", "user"]


def test_build_messages_includes_content_and_metadata():
    msgs = build_messages("My Title", "https://x.com/a", "The body", SummarizeOptions())
    user = msgs[1]["content"]
    assert "My Title" in user
    assert "https://x.com/a" in user
    assert "The body" in user


def test_build_messages_length_guidance_changes_with_option():
    short = build_messages("t", "https://x.com", "c", SummarizeOptions(length="short"))[1]["content"]
    long = build_messages("t", "https://x.com", "c", SummarizeOptions(length="long"))[1]["content"]
    assert short != long
