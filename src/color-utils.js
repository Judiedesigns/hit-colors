const namedColors = {
  black: '#000000',
  blue: '#0000FF',
  gray: '#808080',
  green: '#008000',
  grey: '#808080',
  orange: '#FFA500',
  purple: '#800080',
  red: '#FF0000',
  white: '#FFFFFF',
  yellow: '#FFFF00',
};

export function normalizeHex(value) {
  if (!value) return '#000000';
  const raw = String(value).trim();
  const named = namedColors[raw.toLowerCase()];
  if (named) return named;
  if (/^#[0-9a-f]{6}$/i.test(raw)) return raw.toUpperCase();
  if (/^[0-9a-f]{6}$/i.test(raw)) return `#${raw}`.toUpperCase();
  if (/^#[0-9a-f]{3}$/i.test(raw)) {
    return `#${raw.slice(1).split('').map((char) => char + char).join('')}`.toUpperCase();
  }
  if (/^[0-9a-f]{3}$/i.test(raw)) {
    return `#${raw.split('').map((char) => char + char).join('')}`.toUpperCase();
  }
  return raw;
}

export function isValidHex(value) {
  return /^#[0-9a-f]{6}$/i.test(normalizeHex(value));
}

export function hexToRgb(hex) {
  const normalized = normalizeHex(hex);
  if (!/^#[0-9a-f]{6}$/i.test(normalized)) {
    return [0, 0, 0];
  }
  return [
    parseInt(normalized.slice(1, 3), 16),
    parseInt(normalized.slice(3, 5), 16),
    parseInt(normalized.slice(5, 7), 16),
  ];
}

export function rgbToHex(r, g, b) {
  return `#${[r, g, b].map((channel) => {
    return Math.round(channel).toString(16).padStart(2, '0');
  }).join('')}`.toUpperCase();
}

export function hexToHsl(hex) {
  const [red, green, blue] = hexToRgb(hex).map((value) => value / 255);
  const max = Math.max(red, green, blue);
  const min = Math.min(red, green, blue);
  const lightness = (max + min) / 2;
  let hue = 0;
  let saturation = 0;

  if (max !== min) {
    const delta = max - min;
    saturation = lightness > 0.5
      ? delta / (2 - max - min)
      : delta / (max + min);

    if (max === red) hue = (green - blue) / delta + (green < blue ? 6 : 0);
    if (max === green) hue = (blue - red) / delta + 2;
    if (max === blue) hue = (red - green) / delta + 4;
    hue *= 60;
  }

  return {
    h: Math.round(hue),
    s: Math.round(saturation * 100),
    l: Math.round(lightness * 100),
  };
}

export function hslToHex(hue, saturation, lightness) {
  const h = Number(hue) / 360;
  const s = Number(saturation) / 100;
  const l = Number(lightness) / 100;

  if (s === 0) {
    const channel = l * 255;
    return rgbToHex(channel, channel, channel);
  }

  const hueToRgb = (p, q, t) => {
    let next = t;
    if (next < 0) next += 1;
    if (next > 1) next -= 1;
    if (next < 1 / 6) return p + (q - p) * 6 * next;
    if (next < 1 / 2) return q;
    if (next < 2 / 3) return p + (q - p) * (2 / 3 - next) * 6;
    return p;
  };

  const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
  const p = 2 * l - q;
  return rgbToHex(
    hueToRgb(p, q, h + 1 / 3) * 255,
    hueToRgb(p, q, h) * 255,
    hueToRgb(p, q, h - 1 / 3) * 255,
  );
}

export function luminance(hex) {
  const [red, green, blue] = hexToRgb(hex).map((channel) => {
    const value = channel / 255;
    return value <= 0.03928
      ? value / 12.92
      : ((value + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * red + 0.7152 * green + 0.0722 * blue;
}

export function contrast(a, b) {
  const first = luminance(a);
  const second = luminance(b);
  return (Math.max(first, second) + 0.05) / (Math.min(first, second) + 0.05);
}

export function accessibility(ratio) {
  return {
    aa: ratio >= 4.5,
    aaLarge: ratio >= 3,
    aaa: ratio >= 7,
    aaaLarge: ratio >= 4.5,
  };
}

export function badgeLabel(ratio) {
  const level = accessibility(ratio);
  if (level.aaa) return 'AAA';
  if (level.aa) return 'AA';
  if (level.aaLarge) return 'Large';
  return 'Fail';
}
