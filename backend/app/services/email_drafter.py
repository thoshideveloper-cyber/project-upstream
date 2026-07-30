"""AI email drafting (Groq) for the compose sheet.

Assembles honest context from the DB — company, mandate, contact, cadence state,
recent touch notes — and asks the model for ONE concise plain-text outreach email
as strict JSON. The draft only ever fills the editor; the analyst edits and sends.
Nothing is auto-sent, and the model is instructed to use only the facts provided.
"""

from __future__ import annotations

import json
import logging

import httpx

from app.core.config import settings

logger = logging.getLogger("upstream.email")

_SYSTEM_PROMPT = """You draft outreach emails for an investment-banking analyst working \
a live M&A mandate. Write ONE short plain-text email.

Rules:
- 60-140 words. Plain text only — no markdown, no bullet lists, no links.
- Subject: at most 8 words, specific, sentence case, never clickbait or ALL CAPS.
- Greet by first name when a contact name is given, otherwise "Hi there" is banned — \
use a neutral opening line instead.
- Use ONLY the facts provided. Never invent numbers, names, meetings, or claims.
- Confidential tone: never name the client or reveal deal specifics beyond the \
"regarding" line provided; refer to "our client" / "a mandate we are running".
- One clear, low-friction call to action (a short call, a reply).
- For follow-ups: acknowledge the earlier email in one clause, add one new angle, \
never guilt-trip ("just bumping", "did you see my last email" are banned).
- Sign off with the sender's first name only. Do NOT add a signature block, \
placeholders, or contact details — the system appends the real signature.
- Match the requested tone: direct = crisp and to the point; warm = personable but \
professional; formal = measured, no contractions."""

_JSON_SCHEMA = {
    "name": "email_draft",
    "strict": True,
    "schema": {
        "type": "object",
        "additionalProperties": False,
        "required": ["subject", "body"],
        "properties": {
            "subject": {"type": "string"},
            "body": {"type": "string"},
        },
    },
}


class DraftError(RuntimeError):
    """Drafting failed (no keys / provider down) — surface .args[0] to the analyst."""


def drafting_available() -> bool:
    return bool(settings.groq_api_keys)


async def draft_email(context: dict, *, tone: str, instructions: str | None) -> dict:
    """Return {"subject": ..., "body": ...} or raise DraftError."""
    keys = settings.groq_api_keys
    if not keys:
        raise DraftError("AI drafting is not configured on this install.")

    user_prompt = (
        f"Tone: {tone}\n"
        + (f"Analyst instructions: {instructions}\n" if instructions else "")
        + "Context (facts — use only these):\n"
        + json.dumps(context, indent=2, default=str)
    )

    payload = {
        "model": settings.groq_model,
        "temperature": 0.6,
        "max_tokens": 600,
        "messages": [
            {"role": "system", "content": _SYSTEM_PROMPT},
            {"role": "user", "content": user_prompt},
        ],
        "response_format": {"type": "json_schema", "json_schema": _JSON_SCHEMA},
    }

    models = [settings.groq_model, *settings.groq_fallback_list]
    last_error = "AI drafting is temporarily unavailable."
    async with httpx.AsyncClient(timeout=settings.groq_timeout_s) as client:
        for model in models:
            payload["model"] = model
            for key in keys:
                try:
                    resp = await client.post(
                        f"{settings.groq_base_url}/chat/completions",
                        headers={"Authorization": f"Bearer {key}"},
                        json=payload,
                    )
                except httpx.HTTPError as exc:
                    last_error = "Could not reach the drafting service."
                    logger.warning("draft request error: %s", exc)
                    continue
                if resp.status_code == 429:
                    last_error = "Drafting is rate-limited right now — try again shortly."
                    continue
                if resp.status_code != 200:
                    last_error = "Drafting service returned an error."
                    logger.warning("draft failed: %s %s", resp.status_code, resp.text[:300])
                    continue
                try:
                    content = resp.json()["choices"][0]["message"]["content"]
                    parsed = json.loads(content)
                    subject = str(parsed["subject"]).strip()
                    body = str(parsed["body"]).strip()
                    if subject and body:
                        return {"subject": subject, "body": body}
                except (KeyError, ValueError, json.JSONDecodeError) as exc:
                    last_error = "The draft came back malformed — try again."
                    logger.warning("draft parse error: %s", exc)
    raise DraftError(last_error)
