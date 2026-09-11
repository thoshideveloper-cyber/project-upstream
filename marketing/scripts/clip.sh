#!/usr/bin/env bash
# Upstream — the video chain toolkit.
#
# Everything the batch brief needs done BETWEEN generations, which no video
# tool will do for you:
#
#   ./clip.sh last   seg1.mp4                  -> seg1-last.png, the start image for the next segment
#   ./clip.sh check  seg1.mp4                  -> three frames to inspect before you gate it
#   ./clip.sh join   seg1 seg2 seg3 seg4 out   -> the four segments as one continuous file
#   ./clip.sh scrub  hero.mp4                  -> hero-scrub.mp4, re-encoded so it can be scrubbed
#   ./clip.sh poster hero-scrub.mp4            -> the final frame as the hero poster and share card
#   ./clip.sh web    clip.mp4                  -> a small web copy for a fold background
#
# ffmpeg was installed by winget and is not on PATH until the shell restarts,
# so this finds it rather than assuming it.

set -euo pipefail

FF="$(command -v ffmpeg || true)"
if [ -z "$FF" ]; then
  # winget puts it here and does not add it to PATH until the shell restarts.
  for root in "${LOCALAPPDATA:-}" "$HOME/AppData/Local"; do
    [ -n "$root" ] || continue
    FF="$(ls -d "$root/Microsoft/WinGet/Packages/Gyan.FFmpeg"*/*/bin/ffmpeg.exe 2>/dev/null | head -1 || true)"
    [ -n "$FF" ] && break
  done
fi
if [ -z "$FF" ]; then
  echo "ffmpeg not found. Install it with:  winget install Gyan.FFmpeg" >&2
  exit 1
fi

cmd="${1:-}"
shift || true

case "$cmd" in

  # ── The chain bridge ────────────────────────────────────────────────────
  # A review-grade jpg is not good enough to generate the next segment from:
  # the model re-imagines fine texture out of whatever you hand it, and a
  # compressed frame hands it compression artefacts to re-imagine.
  last)
    in="$1"; out="${2:-${in%.*}-last.png}"
    "$FF" -y -sseof -0.05 -i "$in" -frames:v 1 -q:v 1 "$out" -loglevel error
    echo "wrote $out  (use this as the next segment's start image)"
    ;;

  # ── The gate ────────────────────────────────────────────────────────────
  # Look at all three before you accept a segment. The middle frame is where
  # a model's speed drift shows; the last is where the chain lives or dies.
  check)
    in="$1"; base="${in%.*}"
    dur=$("$FF" -i "$in" 2>&1 | grep -oE 'Duration: [0-9:.]+' | head -1 | cut -d' ' -f2 || true)
    "$FF" -y -i "$in" -frames:v 1 "$base-first.png" -loglevel error
    "$FF" -y -ss 3 -i "$in" -frames:v 1 "$base-mid.png" -loglevel error
    "$FF" -y -sseof -0.05 -i "$in" -frames:v 1 "$base-last.png" -loglevel error
    echo "duration $dur"
    echo "wrote $base-first.png $base-mid.png $base-last.png"
    ;;

  # ── The join ────────────────────────────────────────────────────────────
  # ONE encode over the raw segments. Encoding twice, or joining clips that
  # were each encoded with different settings, glitches at every seam.
  join)
    a="$1"; b="$2"; c="$3"; d="$4"; out="${5:-hero-joined.mp4}"
    "$FF" -y -i "$a" -i "$b" -i "$c" -i "$d" \
      -filter_complex "[0:v][1:v][2:v][3:v]concat=n=4:v=1:a=0[v]" \
      -map "[v]" -c:v libx264 -preset slow -crf 18 -pix_fmt yuv420p "$out" -loglevel error
    echo "wrote $out"
    ;;

  # ── The scrub encode ────────────────────────────────────────────────────
  # A keyframe every 8 frames. Without this, seeking lands on the nearest
  # keyframe and scrubbing feels rough in Chrome no matter how good the
  # drive loop is.
  scrub)
    in="$1"; out="${2:-${in%.*}-scrub.mp4}"
    "$FF" -y -i "$in" -an -c:v libx264 -preset slow -crf 20 -g 8 -keyint_min 8 \
      -sc_threshold 0 -movflags +faststart -pix_fmt yuv420p "$out" -loglevel error
    ls -lh "$out" | awk '{print "wrote", $9, "("$5")"}'
    echo "hardcode this byte size into the hero's loader as VIDEO_BYTES:"
    wc -c < "$out"
    ;;

  # ── The stills that come off the film ───────────────────────────────────
  poster)
    in="$1"
    "$FF" -y -sseof -0.05 -i "$in" -frames:v 1 -q:v 2 ../public/hero-poster.jpg -loglevel error
    "$FF" -y -sseof -0.05 -i "$in" -frames:v 1 -vf "scale=1200:-1,crop=1200:630" -q:v 2 \
      ../public/og-ground.jpg -loglevel error
    echo "wrote public/hero-poster.jpg and public/og-ground.jpg"
    ;;

  # ── A fold background ───────────────────────────────────────────────────
  # These are decoration behind text. Small matters more than sharp.
  web)
    in="$1"; out="${2:-${in%.*}-web.mp4}"
    "$FF" -y -i "$in" -an -c:v libx264 -preset slow -crf 30 -vf "scale=1280:-2" \
      -movflags +faststart -pix_fmt yuv420p "$out" -loglevel error
    ls -lh "$out" | awk '{print "wrote", $9, "("$5")"}'
    ;;

  *)
    sed -n '2,20p' "$0"
    exit 1
    ;;
esac
