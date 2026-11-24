"""
Generates placeholder PWA icons at public/icons/icon-192.png and icon-512.png.
Run once: python3 scripts/generate_icons.py
Replace with real brand icons before launch.
"""
from PIL import Image, ImageDraw, ImageFont
import os

# TODO before launch: replace these placeholder icons with real brand assets.
# Icons must be opaque (no transparency) for maskable icon support on Android.

os.makedirs("frontend/public/icons", exist_ok=True)

for size in [192, 512]:
    img = Image.new("RGB", (size, size), color="#1a1a2e")
    draw = ImageDraw.Draw(img)
    # Draw a simple "N" lettermark centered
    font_size = size // 3
    try:
        font = ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf", font_size)
    except Exception:
        font = ImageFont.load_default()
    text = "N"
    bbox = draw.textbbox((0, 0), text, font=font)
    x = (size - (bbox[2] - bbox[0])) // 2
    y = (size - (bbox[3] - bbox[1])) // 2
    draw.text((x, y), text, fill="#ffffff", font=font)
    img.save(f"frontend/public/icons/icon-{size}.png")
    print(f"Generated icon-{size}.png")
