export type Line = {
  fromPoint: Point;
  toPoint: Point;
};

export type Point = {
  x: number;
  y: number;
};

export class PlayerDrawing {
  private _lines: Line[];

  constructor() {
    this._lines = [];
  }

  get lines(): Line[] {
    return [...this._lines];
  }

  addLine(line: Line): Line[] {
    this._lines = [...this._lines, line];
    return this.lines;
  }

  clear(): Line[] {
    this._lines = [];
    return this.lines;
  }
}

export const encodeLine = (line: Line) => {
  const array = new Uint16Array(4);
  array[0] = Math.floor(line.fromPoint.x * 65535);
  array[1] = Math.floor(line.fromPoint.y * 65535);
  array[2] = Math.floor(line.toPoint.x * 65535);
  array[3] = Math.floor(line.toPoint.y * 65535);
  return new Uint8Array(new Uint8Array(array.buffer).buffer);
};

export const decodeLine = (data: Uint8Array): Line => {
  const buffer = new ArrayBuffer(data.length);
  const view = new Uint8Array(buffer);
  view.set(data);
  const array = new Uint16Array(buffer);
  return {
    fromPoint: {
      x: array[0] / 65535,
      y: array[1] / 65535,
    },
    toPoint: {
      x: array[2] / 65535,
      y: array[3] / 65535,
    },
  };
};
