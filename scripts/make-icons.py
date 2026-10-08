"""Generate placeholder PWA icons: four track-coloured rounded squares on slate. Stdlib only."""
import struct, zlib, sys, os

BG = (0x16, 0x1A, 0x22)
COLOURS = [(0x5B, 0x84, 0xFF), (0xFF, 0x6F, 0x86), (0xF5, 0xB8, 0x3D), (0x31, 0xC7, 0xB8)]

def inside_round_rect(x, y, x0, y0, s, r):
    if not (x0 <= x < x0 + s and y0 <= y < y0 + s):
        return False
    cx = min(max(x, x0 + r), x0 + s - r)
    cy = min(max(y, y0 + r), y0 + s - r)
    return (x - cx) ** 2 + (y - cy) ** 2 <= r * r

def render(size, pad_ratio, ss=4):
    """Supersampled render for smooth edges."""
    pad = size * pad_ratio
    gap = size * 0.04
    cell = (size - 2 * pad - gap) / 2
    radius = cell * 0.28
    rows = []
    for y in range(size):
        row = bytearray([0])
        for x in range(size):
            acc = [0, 0, 0]
            for sy in range(ss):
                for sx in range(ss):
                    px, py = x + (sx + 0.5) / ss, y + (sy + 0.5) / ss
                    c = BG
                    for i, col in enumerate(COLOURS):
                        x0 = pad + (i % 2) * (cell + gap)
                        y0 = pad + (i // 2) * (cell + gap)
                        if inside_round_rect(px, py, x0, y0, cell, radius):
                            c = col
                            break
                    for k in range(3):
                        acc[k] += c[k]
            row += bytes(round(a / (ss * ss)) for a in acc)
        rows.append(bytes(row))
    raw = b''.join(rows)
    def chunk(t, d):
        return struct.pack('>I', len(d)) + t + d + struct.pack('>I', zlib.crc32(t + d) & 0xFFFFFFFF)
    return (b'\x89PNG\r\n\x1a\n' + chunk(b'IHDR', struct.pack('>IIBBBBB', size, size, 8, 2, 0, 0, 0))
            + chunk(b'IDAT', zlib.compress(raw, 9)) + chunk(b'IEND', b''))

out = sys.argv[1]
for name, size, pad in [('pwa-192.png', 192, 0.2), ('pwa-512.png', 512, 0.2),
                        ('pwa-maskable-512.png', 512, 0.28), ('apple-touch-icon.png', 180, 0.2)]:
    with open(os.path.join(out, name), 'wb') as f:
        f.write(render(size, pad))
    print('wrote', name)
