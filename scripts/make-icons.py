# Renders the public/icon.svg design (64-unit viewBox) into the PNG icons that
# the web app manifest and iOS need. Run: python scripts/make-icons.py
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / "public" / "icons"
FONT = "C:/Windows/Fonts/NotoSerifTC-VF.ttf"
INK, GOLD, RED, PAPER = "#1b2130", "#d6a748", "#c9423a", "#f3ead7"
SUPERSAMPLE = 4
# Bounding box of the artwork in SVG units, used to center it in safe zones.
CONTENT_CENTER = (35, 33)


def render(size, unit, rounded, centered):
    s, u = size * SUPERSAMPLE, unit * SUPERSAMPLE
    img = Image.new("RGBA", (s, s), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    if rounded:
        d.rounded_rectangle([0, 0, s - 1, s - 1], radius=14 * u, fill=INK)
    else:
        d.rectangle([0, 0, s, s], fill=INK)
    ox = size / (2 * unit) - CONTENT_CENTER[0] if centered else 0
    oy = size / (2 * unit) - CONTENT_CENTER[1] if centered else 0

    def p(x, y):
        return ((x + ox) * u, (y + oy) * u)

    # Flag pole with round caps.
    d.line([p(20, 12), p(20, 52)], fill=GOLD, width=round(4 * u))
    for y in (12, 52):
        cx, cy = p(20, y)
        d.ellipse([cx - 2 * u, cy - 2 * u, cx + 2 * u, cy + 2 * u], fill=GOLD)
    d.polygon([p(22, 14), p(46, 14), p(40, 22), p(46, 30), p(22, 30)], fill=RED)
    font = ImageFont.truetype(FONT, round(20 * u))
    try:
        font.set_variation_by_axes([900])
    except OSError:
        pass
    d.text(p(42, 54), "陣", font=font, fill=PAPER, anchor="ms")
    return img.resize((size, size), Image.LANCZOS)


OUT.mkdir(parents=True, exist_ok=True)
# "any" icons match the SVG exactly, rounded corners included.
render(192, 192 / 64, True, False).save(OUT / "icon-192.png")
render(512, 512 / 64, True, False).save(OUT / "icon-512.png")
# Maskable: full bleed, artwork inside the central 80% safe circle.
render(512, 6.9, False, True).convert("RGB").save(OUT / "icon-maskable-512.png")
# iOS rounds corners itself and turns transparency black.
render(180, 2.6, False, True).convert("RGB").save(OUT / "apple-touch-icon.png")
print("icons written to", OUT)
