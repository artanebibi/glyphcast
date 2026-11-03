import type { TextGrid } from './render';

/** Plain text, one line per row, trailing spaces trimmed. */
export function toPlainText(grid: TextGrid): string {
  const lines: string[] = [];
  for (let r = 0; r < grid.rows; r++) {
    lines.push(grid.chars.slice(r * grid.cols, (r + 1) * grid.cols).join('').replace(/\s+$/u, ''));
  }
  return lines.join('\n');
}

const escapeHtml = (text: string): string =>
  text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

const hex = (n: number): string => n.toString(16).padStart(2, '0');

/**
 * A standalone HTML page with colored text. Neighbouring cells of the
 * same color share one <span> to keep the file small.
 */
export function toHtml(grid: TextGrid, background: string, title = 'Glyphcast'): string {
  const rows: string[] = [];
  for (let r = 0; r < grid.rows; r++) {
    let line = '';
    let runColor = '';
    let run = '';
    const flush = () => {
      if (!run) return;
      line += runColor ? `<span style="color:${runColor}">${escapeHtml(run)}</span>` : escapeHtml(run);
      run = '';
    };
    let end = grid.cols;
    while (end > 0 && grid.chars[r * grid.cols + end - 1] === ' ') end--;
    for (let c = 0; c < end; c++) {
      const i = r * grid.cols + c;
      const ch = grid.chars[i];
      // Quantize colors a little so runs merge and the file stays small.
      const color =
        ch === ' '
          ? runColor
          : `#${hex(grid.rgb[i * 3] & 0xf8)}${hex(grid.rgb[i * 3 + 1] & 0xf8)}${hex(grid.rgb[i * 3 + 2] & 0xf8)}`;
      if (color !== runColor) {
        flush();
        runColor = color;
      }
      run += ch;
    }
    flush();
    rows.push(line);
  }
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escapeHtml(title)}</title>
<style>
  body { margin: 0; background: ${background}; display: grid; place-items: center; min-height: 100vh; }
  pre { margin: 0; padding: 16px; font: 10px/1 ui-monospace, Menlo, Consolas, "DejaVu Sans Mono", monospace; letter-spacing: 0; }
</style>
</head>
<body>
<pre>${rows.join('\n')}</pre>
</body>
</html>
`;
}
