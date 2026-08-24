from pathlib import Path

from PIL import Image, ImageDraw, ImageFont


ROOT = Path(r"D:\Github\bduck-system\outputs\invoice-management-guide\screenshots")
FONT = r"C:\Windows\Fonts\arial.ttf"
FONT_BOLD = r"C:\Windows\Fonts\arialbd.ttf"


def font(size: int, bold: bool = False):
    return ImageFont.truetype(FONT_BOLD if bold else FONT, size)


def annotate(source: str, target: str, crop, marks):
    image = Image.open(ROOT / source).convert("RGBA")
    x0, y0, x1, y1 = crop
    image = image.crop(crop)
    overlay = Image.new("RGBA", image.size, (0, 0, 0, 0))
    draw = ImageDraw.Draw(overlay)

    for idx, rect, color in marks:
        rx0, ry0, rx1, ry1 = rect
        box = (rx0 - x0, ry0 - y0, rx1 - x0, ry1 - y0)
        draw.rounded_rectangle(box, radius=10, fill=(*color, 28), outline=(*color, 255), width=5)

        cx = max(22, box[0] + 18)
        cy = max(22, box[1] + 18)
        radius = 17
        draw.ellipse((cx - radius, cy - radius, cx + radius, cy + radius), fill=(*color, 255), outline=(255, 255, 255, 255), width=3)
        label = str(idx)
        bbox = draw.textbbox((0, 0), label, font=font(18, True))
        draw.text((cx - (bbox[2] - bbox[0]) / 2, cy - (bbox[3] - bbox[1]) / 2 - 1), label, font=font(18, True), fill="white")

    image = Image.alpha_composite(image, overlay).convert("RGB")
    image.save(ROOT / target, quality=95)


annotate(
    "01-overview-data-raw.png",
    "01-overview-highlight.png",
    (220, 45, 1467, 807),
    [
        (1, (244, 146, 1438, 222), (245, 158, 11)),
        (2, (1035, 171, 1203, 224), (2, 132, 199)),
        (3, (1202, 171, 1390, 224), (220, 38, 38)),
        (4, (234, 245, 1452, 299), (124, 58, 237)),
        (5, (244, 437, 855, 477), (5, 150, 105)),
    ],
)

annotate(
    "02-status-detail-raw.png",
    "02-status-detail-highlight.png",
    (215, 40, 1250, 807),
    [
        (1, (247, 495, 1210, 625), (220, 38, 38)),
        (2, (248, 660, 430, 703), (245, 158, 11)),
    ],
)

annotate(
    "04-edit-form-lower-raw.png",
    "03-edit-form-highlight.png",
    (215, 55, 1250, 807),
    [
        (1, (248, 222, 1210, 412), (2, 132, 199)),
        (2, (248, 425, 1210, 474), (124, 58, 237)),
        (3, (248, 487, 1210, 625), (5, 150, 105)),
        (4, (1128, 628, 1205, 678), (220, 38, 38)),
    ],
)

annotate(
    "05-retry-page-raw.png",
    "04-retry-page-highlight.png",
    (220, 45, 1467, 807),
    [
        (1, (1286, 78, 1439, 124), (2, 132, 199)),
        (2, (232, 326, 1454, 399), (245, 158, 11)),
        (3, (232, 407, 1290, 466), (124, 58, 237)),
        (4, (1288, 407, 1442, 466), (5, 150, 105)),
    ],
)

print("Annotated screenshots created")
