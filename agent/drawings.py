import hashlib
import struct

from PIL import Image, ImageDraw


# Points are stored as floats between 0 and 1 and assume a square canvas
# This allows the actual display canvas size to differ between players and the host to fit their needs
class Point:
    def __init__(self, x: float, y: float):
        self.x = x
        self.y = y


class Line:
    def __init__(self, from_point: Point, to_point: Point):
        self.from_point = from_point
        self.to_point = to_point

    # Lines are encoded as efficiently as possible as they are sent over the network in high frequency as data messages
    # and also encoded in bulk as base64 for drawing restoration (the `player.get_drawing` RPC call)
    # While points are normally stored as 32-bit floats, we can can save 50% of the space by using 16-bit integers instead when they are sent over the network
    # The integers are thus in the range of 0 to 65535. This is more than enough for our purposes, as no player is likely to have a canvas larger than about 1024x1024 pixels anyways
    # Also note that we have a parallel implementation in the client in `drawing.ts` that performs the same operations in TypeScript
    def encode(self) -> bytes:
        return struct.pack(
            "<HHHH",
            int(self.from_point.x * 65535),
            int(self.from_point.y * 65535),
            int(self.to_point.x * 65535),
            int(self.to_point.y * 65535),
        )

    # We decode lines by reversing the packing operation performed above
    @staticmethod
    def decode(data: bytes) -> "Line":
        return Line(
            Point(
                struct.unpack("<H", data[0:2])[0] / 65535,
                struct.unpack("<H", data[2:4])[0] / 65535,
            ),
            Point(
                struct.unpack("<H", data[4:6])[0] / 65535,
                struct.unpack("<H", data[6:8])[0] / 65535,
            ),
        )


class PlayerDrawing:
    def __init__(self, player_identity: str):
        self.player_identity = player_identity
        self.lines = set()
        self._hash = None

    # We use an MD5 hash of the line segments to identify duplicate drawings
    # This allows us to make efficient keys for the `GuessCache` that will automatically change when the drawing is modified
    def hash(self) -> str:
        if self._hash:
            return self._hash

        hash_obj = hashlib.md5()
        for line in self.lines:
            line_str = f"{line.from_point.x},{line.from_point.y},{line.to_point.x},{line.to_point.y}"
            hash_obj.update(line_str.encode())
        self._hash = hash_obj.hexdigest()
        return self._hash

    # Adds a new line to the drawing
    def add_line(self, line: Line):
        self.lines.add(line)
        self._hash = None

    # Clears the drawing (removes all lines)
    def clear(self):
        self.lines.clear()
        self._hash = None

    # Generates an image representing the current state of the drawing
    # We use a size of 512x512 by default, which is an efficient size for GPT-4o-mini in "low detail" mode
    # See https://platform.openai.com/docs/guides/vision#low-or-high-fidelity-image-understanding for more information
    def get_image(self, size: int = 512, stroke_width: int = 4) -> Image:
        canvas = Image.new("1", (size, size), 1)
        draw = ImageDraw.Draw(canvas)

        CHUNK_SIZE = 1000
        lines_list = list(self.lines)

        for i in range(0, len(lines_list), CHUNK_SIZE):
            chunk = lines_list[i : i + CHUNK_SIZE]
            for line in chunk:
                draw.line(
                    [
                        (int(line.from_point.x * size), int(line.from_point.y * size)),
                        (int(line.to_point.x * size), int(line.to_point.y * size)),
                    ],
                    fill=0,
                    width=stroke_width,
                )

        return canvas
