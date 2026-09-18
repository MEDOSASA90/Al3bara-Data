"""Generate final brand icons (navy + gold ferry mark) at all PWA sizes."""
from PIL import Image, ImageDraw
import math

NAVY = (11, 31, 77)
GOLD = (201, 162, 39)
GOLD_LT = (231, 197, 90)
GOLD_PALE = (244, 227, 172)
WHITE = (255, 255, 255)
WAVE1 = (127, 166, 232)
WAVE2 = (61, 90, 153)


def sine_wave(x0, x1, y_base, amp, waves, step=2):
    pts = []
    x = x0
    while x <= x1:
        t = (x - x0) / (x1 - x0) * waves * 2 * math.pi
        pts.append((x, y_base + amp * math.sin(t)))
        x += step
    return pts


def draw_mark(S):
    img = Image.new('RGBA', (S, S), (0, 0, 0, 0))
    d = ImageDraw.Draw(img, 'RGBA')
    u = S / 96.0
    d.rounded_rectangle([2*u, 2*u, 94*u, 94*u], radius=24*u, fill=NAVY)
    d.rounded_rectangle([2*u, 2*u, 94*u, 94*u], radius=24*u, outline=GOLD, width=max(1, int(4*u)))
    d.arc([18*u, 22*u, 78*u, 82*u], start=200, end=340, fill=GOLD, width=max(1, int(3.5*u)))
    d.rounded_rectangle([32*u, 30*u, 45*u, 41*u], radius=1.5*u, fill=GOLD_LT)
    d.rounded_rectangle([47*u, 30*u, 60*u, 41*u], radius=1.5*u, fill=GOLD_PALE)
    d.rounded_rectangle([39*u, 19*u, 52*u, 28*u], radius=1.5*u, fill=GOLD)
    d.polygon([(24*u, 46*u), (72*u, 46*u), (65*u, 58*u), (31*u, 58*u)], fill=WHITE)
    d.rounded_rectangle([24*u, 43.5*u, 72*u, 47*u], radius=1.75*u, fill=WHITE)
    d.line(sine_wave(20*u, 76*u, 68*u, 2.2*u, 2.5), fill=WAVE1, width=max(1, int(4*u)), joint='curve')
    d.line(sine_wave(28*u, 68*u, 78*u, 1.8*u, 2), fill=WAVE2, width=max(1, int(3.5*u)), joint='curve')
    return img


OUT = 'public'
NAVY_BG = Image.new('RGBA', (512, 512), NAVY + (255,))
mark = draw_mark(390)
NAVY_BG.alpha_composite(mark, (61, 61))
NAVY_BG.save(f'{OUT}/icon-512x512.png')
NAVY_BG.resize((192, 192), Image.LANCZOS).save(f'{OUT}/icon-192x192.png')
draw_mark(180).save(f'{OUT}/apple-touch-icon.png')
draw_mark(64).save(f'{OUT}/favicon.png')
print('ICONS_DONE')
