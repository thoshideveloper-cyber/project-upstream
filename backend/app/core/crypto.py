"""Symmetric encryption for OAuth tokens at rest.

Fernet (AES-128-CBC + HMAC) with a key derived from JWT_SECRET — no new secret to
manage, and `cryptography` is already a transitive dependency via python-jose.
Tokens are the only thing encrypted here; rotating JWT_SECRET invalidates stored
tokens, which simply forces analysts to reconnect their mailbox (a safe failure).
"""

from __future__ import annotations

import base64
import hashlib

from cryptography.fernet import Fernet, InvalidToken

from app.core.config import settings


def _fernet() -> Fernet:
    key = base64.urlsafe_b64encode(hashlib.sha256(settings.jwt_secret.encode()).digest())
    return Fernet(key)


def encrypt(plaintext: str) -> str:
    return _fernet().encrypt(plaintext.encode()).decode()


def decrypt(ciphertext: str) -> str | None:
    """Return the plaintext, or None if the token cannot be decrypted (rotated secret)."""
    try:
        return _fernet().decrypt(ciphertext.encode()).decode()
    except (InvalidToken, ValueError):
        return None
