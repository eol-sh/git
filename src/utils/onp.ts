


//// util

interface DiffResult {
  file1: [number, number];
  file2: [number, number];
}

interface DiffComposer {
  compose: () => DiffResult[];
}

interface PathPosition {
  endX: number;
  endY: number;
  r: number;
  startX: number;
  startY: number;
}



//// export

export default function diff<T>(a_: T[], b_: T[]): DiffComposer {
  const path: number[] = [];
  const pathposi: PathPosition[] = [];
  let a = a_;
  let b = b_;
  let m = a.length;
  let n = b.length;
  let reverse = false;
  let offset = m + 1;

  const init = (): void => {
    if (m >= n) {
      const tmp1 = a;
      const tmp2 = m;

      a = b;
      b = tmp1;
      m = n;
      n = tmp2;
      reverse = true;
      offset = m + 1;
    }
  };

  const P = (
    startX: number,
    startY: number,
    endX: number,
    endY: number,
    r: number
  ): PathPosition => {
    return {
      endX,
      endY,
      r,
      startX,
      startY
    };
  };

  const snake = (k: number, p: number, pp: number): number => {
    let r: number;
    let x: number;
    let y: number;

    if (p > pp)
      r = path[k - 1 + offset];
    else
      r = path[k + 1 + offset];

    const startY = y = Math.max(p, pp);
    const startX = x = y - k;

    while (x < m && y < n && a[x] === b[y]) {
      ++x;
      ++y;
    }

    if (startX === x && startY === y) {
      path[k + offset] = r;
    } else {
      path[k + offset] = pathposi.length;
      pathposi[pathposi.length] = P(startX, startY, x, y, r);
    }

    return y;
  };

  init();

  return {
    compose: (): DiffResult[] => {
      const delta = n - m;
      const size = m + n + 3;
      const fp: Record<number, number> = {};

      for (let i = 0; i < size; ++i) {
        fp[i] = -1;
        path[i] = -1;
      }

      let p = -1;

      do {
        ++p;

        for (let k = -p; k <= delta - 1; ++k) {
          fp[k + offset] = snake(k, fp[k - 1 + offset] + 1, fp[k + 1 + offset]);
        }

        for (let k = delta + p; k >= delta + 1; --k) {
          fp[k + offset] = snake(k, fp[k - 1 + offset] + 1, fp[k + 1 + offset]);
        }

        fp[delta + offset] = snake(delta, fp[delta - 1 + offset] + 1, fp[delta + 1 + offset]);
      } while (fp[delta + offset] !== n);

      const r = path[delta + offset];
      const result: DiffResult[] = [];
      let currentR = r;
      let lastStartX = m;
      let lastStartY = n;

      while (currentR !== -1) {
        const elem = pathposi[currentR];

        if (m !== elem.endX || n !== elem.endY) {
          result.push({
            file1: [
              reverse ? elem.endY : elem.endX,
              reverse ? lastStartY - elem.endY : lastStartX - elem.endX
            ],
            file2: [
              reverse ? elem.endX : elem.endY,
              reverse ? lastStartX - elem.endX : lastStartY - elem.endY
            ]
          });
        }

        lastStartX = elem.startX;
        lastStartY = elem.startY;

        currentR = pathposi[currentR].r;
      }

      if (lastStartX !== 0 || lastStartY !== 0) {
        result.push({
          file1: [0, reverse ? lastStartY : lastStartX],
          file2: [0, reverse ? lastStartX : lastStartY]
        });
      }

      result.reverse();
      return result;
    }
  };
}



/*** adapted from https://github.com/Axosoft/diff3/blob/master/onp.js ***/
