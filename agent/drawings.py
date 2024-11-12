import hashlib
import struct

from PIL import Image, ImageDraw


class Point:
    def __init__(self, x: float, y: float):
        self.x = x
        self.y = y


class Line:
    def __init__(self, from_point: Point, to_point: Point):
        self.from_point = from_point
        self.to_point = to_point

    def encode(self) -> bytes:
        return struct.pack(
            "<HHHH",
            int(self.from_point.x * 65535),
            int(self.from_point.y * 65535),
            int(self.to_point.x * 65535),
            int(self.to_point.y * 65535),
        )

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

    def hash(self) -> str:
        if self._hash:
            return self._hash

        hash_obj = hashlib.md5()
        for line in self.lines:
            line_str = f"{line.from_point.x},{line.from_point.y},{line.to_point.x},{line.to_point.y}"
            hash_obj.update(line_str.encode())
        self._hash = hash_obj.hexdigest()
        return self._hash

    def add_line(self, line: Line):
        self.lines.add(line)
        self._hash = None

    def clear(self):
        self.lines.clear()
        self._hash = None

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

        debug_path = f"/tmp/drawing_{self.player_identity}.png"
        canvas.save(debug_path)
        return canvas
