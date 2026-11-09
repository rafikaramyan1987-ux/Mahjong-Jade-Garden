"""Before / after comparison of 8 Garden tiles, cropped from two 2x renders of the tile-set sheet (?shot=tiles).
usage: python3 -I scripts/compare-sheet.py old.png new.png out.png"""
import sys
from PIL import Image, ImageDraw, ImageFont

old, new, out = sys.argv[1:4]
S = 2  # renders are at 2x
TW = 105
FACES = [(0, 'koi'), (2, 'lantern'), (3, 'teapot'), (6, 'panda'), (7, 'crane'), (8, 'rabbit'), (10, 'dragon'), (13, 'peach')]
ROWS = [8, 8, 8, 7, 7]


def tile_box(face, depth):
    h = round(TW * 1.3)
    d = round(TW * depth)
    gap = TW * 0.14
    row_h = h + d + TW * 0.42
    top = 1920 / 30 + TW * 0.4
    r, c, k = 0, face, face
    for n in ROWS:
        if k < n:
            c = k
            break
        k -= n
        r += 1
    total = ROWS[r] * (TW + d + gap) - gap
    x = (1920 - total) / 2 + c * (TW + d + gap)
    y = top + r * row_h
    m = 10
    return tuple(int(v * S) for v in (x - m, y - m, x + TW + d + m + 4, y + h + d + 8))


oi, ni = Image.open(old), Image.open(new)
crops_old = [oi.crop(tile_box(f, 0.11)) for f, _ in FACES]
crops_new = [ni.crop(tile_box(f, 0.15)) for f, _ in FACES]
cw = max(c.width for c in crops_old + crops_new)
ch = max(c.height for c in crops_old + crops_new)
pad, label_w, head = 30, 360, 150
W = label_w + len(FACES) * (cw + pad) + pad
H = head + 2 * (ch + 90) + 40
img = Image.new('RGB', (W, H), crops_old[0].getpixel((4, 4))[:3])
dr = ImageDraw.Draw(img)
font = lambda size, bold=True: ImageFont.truetype('/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf' if bold else '/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf', size)
dr.text((pad, 40), 'Mahjong Jade Garden — Garden tiles: before / after', fill=(255, 246, 220), font=font(54))
for r, (label, sub, crops) in enumerate([('Before', 'flat icons', crops_old), ('After', 'glossy, shaded, bold', crops_new)]):
    y = head + r * (ch + 90)
    dr.text((pad, y + ch / 2 - 40), label, fill=(255, 246, 220), font=font(52))
    dr.text((pad, y + ch / 2 + 22), sub, fill=(220, 240, 225), font=font(30, False))
    for i, c in enumerate(crops):
        x = label_w + pad + i * (cw + pad)
        img.paste(c, (x, y))
        if r == 1:
            name = FACES[i][1]
            tw = dr.textlength(name, font=font(30, False))
            dr.text((x + (cw - tw) / 2, y + ch + 14), name, fill=(255, 246, 220), font=font(30, False))
img.save(out)
print('wrote', out, img.size)
