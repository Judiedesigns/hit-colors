import React, { useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import chroma from 'chroma-js';
import hello from 'hello-color';
import readme from '../README.md?raw';
import {
  badgeLabel,
  contrast,
  hexToRgb,
  hexToHsl,
  hslToHex,
  isValidHex,
  normalizeHex,
} from './color-utils';
import './styles.css';

const pkg = {
  version: '0.1.0',
  description: 'A color contrast tool for testing text, background, and companion colors.',
};

function App() {
  const route = normalizeRoute(window.location.pathname);

  if (route !== 'docs') {
    return <HitColorsTool />;
  }

  return (
    <>
      <Nav />
      <Home />
      <Footer />
    </>
  );
}

function normalizeRoute(pathname) {
  const path = pathname.replace(/\/$/, '');
  if (path.endsWith('/docs')) return 'docs';
  return 'home';
}

function Nav() {
  return (
    <nav className="nav">
      <a href="/">Hit Colors</a>
      <div className="nav-spacer" />
      <a href="/docs">Docs</a>
      <a href="https://github.com/Judiedesigns/hit-colors">GitHub</a>
    </nav>
  );
}

function HitColorsTool() {
  const initial = parseInitialColors();
  const [palette, setPalette] = useState(initial.palette);
  const [selectedColor, setSelectedColor] = useState(0);
  const [background, setBackground] = useState(initial.background);
  const [copyLabel, setCopyLabel] = useState('Copy');
  const [actionHistory, setActionHistory] = useState([]);
  const foreground = palette[selectedColor] || palette[0];
  const displayForeground = safeHex(foreground);
  const displayBackground = safeHex(background);
  const ratio = contrast(displayForeground, displayBackground);

  const saveActionHistory = () => {
    setActionHistory((history) => [
      ...history,
      { palette, background, selectedColor },
    ].slice(-12));
  };

  const reverse = () => {
    saveActionHistory();
    setPalette((colors) => colors.map((color, index) => (
      index === selectedColor ? displayBackground : color
    )));
    setBackground(displayForeground);
  };

  const random = () => {
    const next = randomPassingPair();
    saveActionHistory();
    setPalette((colors) => buildCompanionPalette(
      next.foreground,
      next.background,
      colors.length,
      selectedColor,
    ));
    setBackground(next.background);
  };

  const undoAction = () => {
    setActionHistory((history) => {
      const previous = history[history.length - 1];
      if (!previous) return history;
      setPalette(previous.palette);
      setBackground(previous.background);
      setSelectedColor(previous.selectedColor);
      return history.slice(0, -1);
    });
  };

  const copyPalette = async () => {
    const colors = palette
      .map((color, index) => `${index === 0 ? 'Text' : `Accent ${index}`}: ${formatHex(safeHex(color))}`)
      .join('\n');
    const value = `Background: ${formatHex(displayBackground)}\n${colors}`;
    if (navigator.clipboard) {
      await navigator.clipboard.writeText(value);
      setCopyLabel('Copied');
      window.setTimeout(() => setCopyLabel('Copy'), 1200);
    }
  };

  const downloadPalette = () => {
    exportPaletteImage(displayBackground, palette.map((color) => safeHex(color)));
  };

  const updatePaletteColor = (index, value) => {
    setPalette((colors) => colors.map((color, colorIndex) => (
      colorIndex === index ? normalizeColorValue(value) : color
    )));
  };

  const addCompanionColor = () => {
    setPalette((colors) => {
      if (colors.length >= 5) return colors;
      const next = buildCompanionColor(safeHex(colors[0]), displayBackground, colors.length);
      setSelectedColor(colors.length);
      return [...colors, next];
    });
  };

  const removeCompanionColor = (index) => {
    if (index === 0) return;
    setPalette((colors) => colors.filter((_, colorIndex) => colorIndex !== index));
    setSelectedColor((current) => (current >= index ? Math.max(0, current - 1) : current));
  };

  const fixCompanionColor = (index) => {
    setPalette((colors) => colors.map((color, colorIndex) => (
      colorIndex === index ? nudgeToContrast(safeHex(color), displayBackground, 4.5) : color
    )));
  };

  return (
    <main className="contrast-shell">
      <style>{`::selection { color: ${displayBackground}; background-color: ${displayForeground}; }`}</style>
      <div className="contrast-layout">
        <section
          className="contrast-preview"
          style={{ color: displayForeground, backgroundColor: displayBackground }}
        >
          <div className="contrast-score">
            <span>Aa</span>
            <strong>{ratio.toFixed(2)}</strong>
            <b>{badgeLabel(ratio)}</b>
            <button
              type="button"
              className="contrast-info"
              aria-label={contrastDescription(ratio)}
            >
              i
              <span role="tooltip">{contrastDescription(ratio)}</span>
            </button>
          </div>
          <p>
            Contrast is the difference in luminance or color that makes an object
            (or its representation in an image or display) distinguishable.
          </p>
        </section>

        <aside className="contrast-panel">
          <div className="panel-intro">
            <h1>Hit colors</h1>
            <p>WCAG contrast for text and accent colors.</p>
          </div>
          <HitColorControl
            label={selectedColor === 0 ? 'Text' : `Accent ${selectedColor}`}
            value={foreground}
            onChange={(value) => updatePaletteColor(selectedColor, value)}
          />
          <HitColorControl label="Background" value={background} onChange={setBackground} />
          <div className="panel-actions">
            <button type="button" onClick={reverse}>Reverse</button>
            <div className="random-group">
              <button type="button" onClick={random}>Random</button>
              <button
                type="button"
                className="random-undo"
                onClick={undoAction}
                disabled={actionHistory.length === 0}
                aria-label="Undo last action"
                title="Undo last action"
              >
                <svg
                  width="14"
                  height="14"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden="true"
                >
                  <path d="M3 7v6h6" />
                  <path d="M21 17a9 9 0 0 0-15-6.7L3 13" />
                </svg>
              </button>
            </div>
            <button className="copy-button" onClick={copyPalette}>{copyLabel}</button>
          </div>
          <section className="palette-panel">
            <div className="palette-head">
              <span>Palette</span>
              <button
                type="button"
                className="palette-download"
                onClick={downloadPalette}
                aria-label="Download palette"
                title="Download palette"
              >
                <svg
                  width="16"
                  height="16"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden="true"
                >
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                  <polyline points="7 10 12 15 17 10" />
                  <line x1="12" y1="15" x2="12" y2="3" />
                </svg>
              </button>
              <button
                type="button"
                onClick={addCompanionColor}
                disabled={palette.length >= 5}
                aria-label="Add companion color"
              >
                +
              </button>
            </div>
            <div className="palette-list">
              {palette.map((color, index) => {
                const rowRatio = contrast(safeHex(color), displayBackground);
                const rowLabel = badgeLabel(rowRatio);
                const canFix = rowLabel === 'Fail';

                return (
                  <div
                    className={`palette-row ${index === selectedColor ? 'selected' : ''}`}
                    key={`companion-${index}`}
                  >
                    <div
                      className="palette-select"
                      onClick={() => setSelectedColor(index)}
                    >
                      <span style={{ backgroundColor: safeHex(color) }} />
                      <HexTextInput
                        value={formatHex(color)}
                        autoComplete="off"
                        autoCorrect="off"
                        autoCapitalize="off"
                        spellCheck="false"
                        onFocus={() => setSelectedColor(index)}
                        onChange={(event) => updatePaletteColor(index, event.target.value)}
                      />
                    </div>
                    <span className={`palette-grade ${rowRatio >= 3 ? 'passing' : 'failing'}`}>
                      {rowLabel}
                    </span>
                    <button
                      type="button"
                      className="palette-fix"
                      onClick={(event) => {
                        event.stopPropagation();
                        fixCompanionColor(index);
                      }}
                      disabled={!canFix}
                      aria-label={`Fix ${formatHex(color)} contrast`}
                    >
                      Fix
                    </button>
                    <button
                      type="button"
                      className="palette-remove"
                      onClick={() => removeCompanionColor(index)}
                      disabled={index === 0}
                      aria-label={`Remove accent ${index}`}
                    >
                      -
                    </button>
                  </div>
                );
              })}
            </div>
          </section>
          <section className="maker-panel">
            <div>
              <a href="https://florenceeze.com">Made by Mars</a>
              <span>Product designer</span>
            </div>
            <a href="mailto:florencekey22@gmail.com">
              Send a message
              <svg
                width="13"
                height="13"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <path d="M5 12h14" />
                <path d="m12 5 7 7-7 7" />
              </svg>
            </a>
          </section>
        </aside>
      </div>
    </main>
  );
}

function HitColorControl({ label, value, onChange }) {
  const normalized = safeHex(value);
  const hsl = hexToHsl(normalized);
  const canUseEyeDropper = typeof window !== 'undefined' && 'EyeDropper' in window;

  const updateHsl = (key, nextValue) => {
    const next = { ...hsl, [key]: Number(nextValue) };
    onChange(hslToHex(next.h, next.s, next.l));
  };

  const pickFromScreen = async () => {
    if (!canUseEyeDropper) return;
    try {
      const result = await new window.EyeDropper().open();
      onChange(result.sRGBHex);
    } catch {
      // The browser throws when the user cancels the picker.
    }
  };

  return (
    <section className="panel-control" style={{ '--control-color': normalized }}>
      <div className="panel-control-head">
        <label htmlFor={`${label}-tool-hex`}>{label}</label>
        <div className="control-field-row">
          <div className="control-field">
            <span className="control-swatch" style={{ backgroundColor: normalized }}>
              <input
                type="color"
                value={normalized}
                onChange={(event) => onChange(event.target.value)}
                aria-label={`Pick ${label.toLowerCase()} color`}
              />
            </span>
            <HexTextInput
              id={`${label}-tool-hex`}
              value={formatHex(value)}
              autoComplete="off"
              autoCorrect="off"
              autoCapitalize="off"
              spellCheck="false"
              onChange={(event) => onChange(event.target.value)}
            />
          </div>
          {canUseEyeDropper && (
            <button
              type="button"
              className="screen-picker"
              onClick={pickFromScreen}
              title="Pick a color from the screen"
              aria-label={`Pick ${label.toLowerCase()} color from the screen`}
            >
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                <path d="m2 22 1-1h3l9-9" />
                <path d="M3 21v-3l9-9" />
                <path d="m15 6 3.4-3.4a2.1 2.1 0 1 1 3 3L18 9l.4.4a2.1 2.1 0 1 1-3 3l-3.8-3.8a2.1 2.1 0 1 1 3-3l.4.4Z" />
              </svg>
            </button>
          )}
        </div>
      </div>
      <HslSliders hsl={hsl} onChange={updateHsl} />
    </section>
  );
}

function HexTextInput({ value, onChange, onFocus, onBlur, ...props }) {
  const [draft, setDraft] = useState(formatHexInput(value));
  const [editing, setEditing] = useState(false);

  useEffect(() => {
    if (!editing) setDraft(formatHexInput(value));
  }, [editing, value]);

  const emitChange = (nextValue) => {
    onChange({ target: { value: nextValue } });
  };

  return (
    <input
      {...props}
      value={draft}
      onFocus={(event) => {
        setEditing(true);
        onFocus?.(event);
      }}
      onChange={(event) => {
        const nextDraft = event.target.value;
        setDraft(nextDraft);
      }}
      onKeyDown={(event) => {
        if (event.key === 'Enter' && isCompleteHex(draft)) {
          const nextValue = normalizeHex(draft);
          setDraft(formatHex(nextValue));
          emitChange(nextValue);
          event.currentTarget.blur();
        }
      }}
      onBlur={(event) => {
        setEditing(false);
        if (isCompleteHex(draft)) {
          const nextValue = normalizeHex(draft);
          setDraft(formatHex(nextValue));
          emitChange(nextValue);
        } else {
          setDraft(formatHexInput(value));
        }
        onBlur?.(event);
      }}
    />
  );
}

function parseInitialColors() {
  const parts = window.location.pathname
    .split('/')
    .filter(Boolean)
    .map((part) => normalizeHex(part));

  if (parts.length >= 2 && isValidHex(parts[0]) && isValidHex(parts[1])) {
    return {
      palette: [parts[0]],
      background: parts[1],
    };
  }

  return {
    palette: ['#14DCEB', '#F585FF', '#FFC800'],
    background: '#004466',
  };
}

function randomHex() {
  return `#${Math.floor(Math.random() * 0xffffff)
    .toString(16)
    .padStart(6, '0')}`.toUpperCase();
}

function randomPassingPair() {
  for (let index = 0; index < 80; index += 1) {
    const background = chroma.random().hex().toUpperCase();
    const result = hello(background, { contrast: 4.5 });
    const foreground = result?.color ? normalizeHex(result.color) : null;

    if (foreground && contrast(foreground, background) >= 4.5) {
      return { foreground, background };
    }
  }

  return Math.random() > 0.5
    ? { foreground: '#111111', background: '#FFFFFF' }
    : { foreground: '#FFFFFF', background: '#111111' };
}

function contrastDescription(ratio) {
  if (ratio >= 7) return 'AAA: passes enhanced contrast for normal text.';
  if (ratio >= 4.5) return 'AA: passes standard contrast for normal text.';
  if (ratio >= 3) return 'Large: only passes for large or bold text.';
  return 'Fail: does not meet WCAG contrast for readable text.';
}

function buildCompanionPalette(foreground, background, count, selectedIndex) {
  return Array.from({ length: count }, (_, index) => (
    index === selectedIndex
      ? foreground
      : buildCompanionColor(foreground, background, index)
  ));
}

function buildCompanionColor(seed, background, index) {
  if (!isValidHex(seed) || !isValidHex(background)) return seed;

  const base = hexToHsl(seed);
  const offsets = [0, 32, -38, 154, -154];
  const saturations = [base.s, base.s + 2, base.s - 6, base.s - 10, base.s + 4];
  const lightness = [base.l, base.l + 4, base.l - 4, base.l + 8, base.l - 8];
  const next = hslToHex(
    wrapHue(base.h + offsets[index % offsets.length]),
    clamp(saturations[index % saturations.length], 42, 96),
    clamp(lightness[index % lightness.length], 18, 82),
  );

  return nudgeToContrast(next, background, 3);
}

function nudgeToContrast(color, background, target) {
  if (!isValidHex(color) || !isValidHex(background)) return color;

  const hsl = hexToHsl(color);
  for (let step = 1; step <= 100; step += 1) {
    for (const direction of [1, -1]) {
      const lightness = hsl.l + direction * step;
      if (lightness < 0 || lightness > 100) continue;

      const next = hslToHex(hsl.h, hsl.s, lightness);
      if (contrast(next, background) >= target) return next;
    }
  }

  return color;
}

function wrapHue(value) {
  return ((value % 360) + 360) % 360;
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function formatHex(value) {
  return normalizeHex(value).toLowerCase();
}

function formatHexInput(value) {
  return String(value).trim() === '' ? '' : formatHex(value);
}

function safeHex(value, fallback = '#000000') {
  return isCompleteHex(value) ? normalizeHex(value) : fallback;
}

function isCompleteHex(value) {
  return String(value).trim() !== '' && isValidHex(value);
}

function normalizeColorValue(value) {
  return String(value).trim() === '' ? '' : normalizeHex(value);
}

function exportPaletteImage(background, palette) {
  const colors = [
    { role: 'Background', hex: normalizeHex(background), ratio: null },
    ...palette.map((color, index) => {
      const hex = normalizeHex(color);
      return {
        role: index === 0 ? 'Text' : `Accent ${index}`,
        hex,
        ratio: contrast(hex, background),
      };
    }),
  ];
  const width = 1920;
  const height = 1080;
  const canvas = document.createElement('canvas');
  const context = canvas.getContext('2d');
  const bandWidth = width / colors.length;

  canvas.width = width;
  canvas.height = height;

  colors.forEach((color, index) => {
    const left = index * bandWidth;
    const textColor = readableTextColor(color.hex);
    const grade = color.ratio ? badgeLabel(color.ratio).toUpperCase() : null;
    const lines = [
      color.role.toUpperCase(),
      color.hex.toUpperCase(),
    ];

    if (grade) lines.unshift(grade);

    context.fillStyle = color.hex;
    context.fillRect(left, 0, bandWidth + 1, height);
    context.save();
    context.translate(left + bandWidth * 0.34, 148);
    context.rotate(-Math.PI / 2);
    context.fillStyle = textColor;
    context.font = '500 21px JetBrains Mono, Menlo, Consolas, monospace';
    context.textBaseline = 'top';
    lines.forEach((line, lineIndex) => {
      context.fillText(line, 0, lineIndex * 30);
    });
    context.restore();
  });

  const link = document.createElement('a');
  link.href = canvas.toDataURL('image/png');
  link.download = `hit-colors-${Date.now()}.png`;
  link.click();
}

function readableTextColor(color) {
  return contrast(color, '#FFFFFF') >= contrast(color, '#111111') ? '#FFFFFF' : '#111111';
}

function Home() {
  return (
    <main className="container home">
      <header className="header">
        <div>
          <h1>Hit Colors</h1>
          <p className="lede">{pkg.description}</p>
        </div>
      </header>
      <article
        className="prose"
        dangerouslySetInnerHTML={{ __html: renderMarkdown(readme) }}
      />
    </main>
  );
}

function HslSliders({ hsl, onChange }) {
  return (
    <div className="hsl-sliders">
      <Slider
        label="Hue"
        display={`${hsl.h}\u00b0`}
        value={hsl.h}
        max="360"
        onChange={(value) => onChange('h', value)}
      />
      <Slider
        label="Saturation"
        display={(hsl.s / 100).toFixed(2)}
        value={hsl.s}
        max="100"
        onChange={(value) => onChange('s', value)}
      />
      <Slider
        label="Lightness"
        display={(hsl.l / 100).toFixed(2)}
        value={hsl.l}
        max="100"
        onChange={(value) => onChange('l', value)}
      />
    </div>
  );
}

function Slider({ label, display, value, max, onChange }) {
  return (
    <label>
      <span>
        <b>{label}</b>
        <em>{display}</em>
      </span>
      <input
        type="range"
        min="0"
        max={max}
        value={value}
        onChange={(event) => onChange(event.target.value)}
      />
    </label>
  );
}

function Footer() {
  return (
    <footer className="footer">
      <div className="container footer-inner">
        <a href="/">hit colors</a>
        <span>v{pkg.version}</span>
        <a href="https://github.com/Judiedesigns/hit-colors">GitHub</a>
        <div className="nav-spacer" />
      </div>
    </footer>
  );
}

function renderMarkdown(markdown) {
  const lines = markdown.split('\n');
  let html = '';
  let inCode = false;
  let code = [];
  let inList = false;
  let paragraph = [];
  let skippedTitle = false;

  const closeList = () => {
    if (inList) {
      html += '</ul>';
      inList = false;
    }
  };

  const closeParagraph = () => {
    if (paragraph.length) {
      html += `<p>${inlineMarkdown(paragraph.join(' '))}</p>`;
      paragraph = [];
    }
  };

  lines.forEach((line) => {
    if (line.startsWith('```')) {
      if (inCode) {
        html += `<pre><code>${escapeHtml(code.join('\n'))}</code></pre>`;
        code = [];
        inCode = false;
      } else {
        closeParagraph();
        closeList();
        inCode = true;
      }
      return;
    }

    if (inCode) {
      code.push(line);
      return;
    }

    if (!line.trim()) {
      closeParagraph();
      closeList();
      return;
    }

    if (line.startsWith('# ')) {
      closeParagraph();
      closeList();
      if (skippedTitle) {
        html += `<h1>${inlineMarkdown(line.slice(2))}</h1>`;
      }
      skippedTitle = true;
    } else if (line.startsWith('## ')) {
      closeParagraph();
      closeList();
      html += `<h2>${inlineMarkdown(line.slice(3))}</h2>`;
    } else if (line.startsWith('### ')) {
      closeParagraph();
      closeList();
      html += `<h3>${inlineMarkdown(line.slice(4))}</h3>`;
    } else if (line.startsWith('- ')) {
      closeParagraph();
      if (!inList) {
        html += '<ul>';
        inList = true;
      }
      html += `<li>${inlineMarkdown(line.slice(2))}</li>`;
    } else if (line === '---') {
      closeParagraph();
      closeList();
      html += '<hr>';
    } else {
      closeList();
      paragraph.push(line.trim());
    }
  });

  closeParagraph();
  closeList();
  return html;
}

function inlineMarkdown(value) {
  return escapeHtml(value)
    .replace(/`([^`]+)`/g, '<code>$1</code>')
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2">$1</a>')
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    .replace(/_([^_]+)_/g, '<em>$1</em>');
}

function escapeHtml(value) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

createRoot(document.getElementById('root')).render(<App />);
