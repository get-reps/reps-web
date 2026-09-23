#!/usr/bin/env python
"""
Generate the getreps.io/r/willc QR code with the REPS brand mark centered.

Crew task 1cc02408-d3d5-408c-8fc1-ff4091a6050f. Encodes the redirect URL
(NOT a direct App Store link) so the printed code can be repointed later by
updating the `willc` row in public.links (see scripts/add-willc-gateway-slug.sql)
without reprinting anything.

Usage: python scripts/generate-willc-qr.py
"""

import qrcode
import qrcode.constants
from PIL import Image, ImageDraw

URL = "https://www.getreps.io/r/willc"
LOGO_PATH = "angel/assets/logos/app-mark.png"  # real REPS brand mark (squircle app icon, RGBA)
OUTPUT_PATH = "qr/willc-r-getreps-io.png"

BOX_SIZE = 30              # pixels per QR module
BORDER = 4                 # quiet zone in modules — the QR spec minimum, do not go lower
MIN_PX = 1024               # print-friendly resolution floor
LOGO_WIDTH_RATIO = 0.22     # logo width as fraction of QR width — well under error-correction H's ~30% damage budget
PAD_RATIO = 0.18            # white backing plate is 18% larger than the logo on each axis
PAD_CORNER_RATIO = 0.22     # rounded-corner radius as a fraction of the pad's short side, matching the app icon's squircle

# 1. Encode with error correction H — the headroom that makes a logo overlay safe.
qr = qrcode.QRCode(
    version=None,  # auto-pick the smallest version that fits the data at this error level
    error_correction=qrcode.constants.ERROR_CORRECT_H,
    box_size=BOX_SIZE,
    border=BORDER,
)
qr.add_data(URL)
qr.make(fit=True)
qr_img = qr.make_image(fill_color="black", back_color="white").convert("RGB")

# 2. Guarantee the print-resolution floor. NEAREST keeps module edges crisp — no
#    blur across the hard black/white boundaries the way LANCZOS/BICUBIC would add.
if qr_img.width < MIN_PX:
    scale = -(-MIN_PX // qr_img.width)  # ceil division
    qr_img = qr_img.resize((qr_img.width * scale, qr_img.height * scale), Image.NEAREST)
qr_w, qr_h = qr_img.size

# 3. Load the real REPS brand mark (already a squircle with transparent corners)
#    and resize it to a safe fraction of the QR's width.
logo = Image.open(LOGO_PATH).convert("RGBA")
logo_w = int(qr_w * LOGO_WIDTH_RATIO)
logo_h = int(logo.height * (logo_w / logo.width))
logo = logo.resize((logo_w, logo_h), Image.LANCZOS)

# 4. White rounded backing plate so the mark reads cleanly against the QR modules
#    underneath it, with a quiet margin on all sides.
pad_w, pad_h = int(logo_w * (1 + PAD_RATIO)), int(logo_h * (1 + PAD_RATIO))
plate = Image.new("RGBA", (pad_w, pad_h), (0, 0, 0, 0))
draw = ImageDraw.Draw(plate)
radius = int(min(pad_w, pad_h) * PAD_CORNER_RATIO)
draw.rounded_rectangle([(0, 0), (pad_w - 1, pad_h - 1)], radius=radius, fill=(255, 255, 255, 255))
plate.paste(logo, ((pad_w - logo_w) // 2, (pad_h - logo_h) // 2), mask=logo)

# 5. Composite the plate dead-center on the QR code and save at print resolution.
center = ((qr_w - pad_w) // 2, (qr_h - pad_h) // 2)
qr_img.paste(plate, center, mask=plate)
qr_img.save(OUTPUT_PATH, "PNG")

print(f"wrote {OUTPUT_PATH} ({qr_img.width}x{qr_img.height})")
