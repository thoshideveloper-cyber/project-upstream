"""Evaluation stats for the AI scorer (SOURCING_LAYER_PLAN §5.6).

Pure, dependency-free implementations (no scipy) so the eval harness runs anywhere:
- Cohen's κ on banded agreement (AI-says-good vs analyst thumbs-up),
- Spearman rank-correlation between fit_score and the analyst signal.
"""

from __future__ import annotations


def cohen_kappa(pairs: list[tuple[bool, bool]]) -> float | None:
    """Cohen's κ for two binary raters. None when undefined (n=0 or degenerate)."""
    n = len(pairs)
    if n == 0:
        return None
    agree = sum(1 for a, b in pairs if a == b)
    po = agree / n
    a_pos = sum(1 for a, _ in pairs if a) / n
    b_pos = sum(1 for _, b in pairs if b) / n
    pe = a_pos * b_pos + (1 - a_pos) * (1 - b_pos)
    if pe == 1:
        return 1.0 if po == 1 else 0.0
    return round((po - pe) / (1 - pe), 4)


def _ranks(values: list[float]) -> list[float]:
    """Average (tie-corrected) ranks."""
    order = sorted(range(len(values)), key=lambda i: values[i])
    ranks = [0.0] * len(values)
    i = 0
    while i < len(order):
        j = i
        while j + 1 < len(order) and values[order[j + 1]] == values[order[i]]:
            j += 1
        avg = (i + j) / 2 + 1  # 1-based average rank
        for k in range(i, j + 1):
            ranks[order[k]] = avg
        i = j + 1
    return ranks


def spearman(x: list[float], y: list[float]) -> float | None:
    """Spearman rank correlation. None when undefined (n<2 or zero variance)."""
    if len(x) != len(y) or len(x) < 2:
        return None
    rx, ry = _ranks(x), _ranks(y)
    mx = sum(rx) / len(rx)
    my = sum(ry) / len(ry)
    cov = sum((a - mx) * (b - my) for a, b in zip(rx, ry))
    vx = sum((a - mx) ** 2 for a in rx)
    vy = sum((b - my) ** 2 for b in ry)
    if vx == 0 or vy == 0:
        return None
    return round(cov / (vx * vy) ** 0.5, 4)
