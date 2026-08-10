import React, { useMemo, useState } from 'react';
import { createRoot } from 'react-dom/client';
import readme from '../README.md?raw';
import {
  accessibility,
  badgeLabel,
  contrast,
  defaultColors,
  hexToHsl,
  hslToHex,
  isLight,
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
  const foreground = palette[selectedColor] || palette[0];
  const ratio = isValidHex(foreground) && isValidHex(background)
    ? contrast(foreground, background)
    : 0;

  const reverse = () => {
    setPalette((colors) => colors.map((color, index) => (
      index === selectedColor ? background : color
    )));
    setBackground(foreground);
  };

  const random = () => {
    const next = randomPassingPair();
    setPalette((colors) => colors.map((_, index) => (
      index === selectedColor ? next.foreground : randomHex()
    )));
    setBackground(next.background);
  };

  const copyPalette = async () => {
    const passing = palette
      .map((color) => `${color}  ${contrast(color, background).toFixed(2)}:1`)
      .join('\n');
    const value = `Background ${background}\n${passing}`;
    if (navigator.clipboard) {
      await navigator.clipboard.writeText(value);
      setCopyLabel('Copied');
      window.setTimeout(() => setCopyLabel('Copy'), 1200);
    }
  };

  const updatePaletteColor = (index, value) => {
    setPalette((colors) => colors.map((color, colorIndex) => (
      colorIndex === index ? normalizeHex(value) : color
    )));
  };

  const addCompanionColor = () => {
    setPalette((colors) => {
      if (colors.length >= 5) return colors;
      const base = hexToHsl(colors[0]);
      const next = hslToHex((base.h + 150 + colors.length * 30) % 360, base.s, base.l);
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
      colorIndex === index ? nudgeToContrast(color, background, 4.5) : color
    )));
  };

  return (
    <main className="contrast-shell">
      <style>{`::selection { color: ${background}; background-color: ${foreground}; }`}</style>
      <div className="contrast-layout">
        <section
          className="contrast-preview"
          style={{ color: foreground, backgroundColor: background }}
        >
          <div className="contrast-score">
            <span>Aa</span>
            <strong>{ratio.toFixed(2)}</strong>
            <b>{badgeLabel(ratio)}</b>
          </div>
          <p>
            Contrast is the difference in luminance or color that makes an object
            (or its representation in an image or display) distinguishable.
          </p>
        </section>

        <aside className="contrast-panel">
          <div className="panel-intro">
            <h1>Hit colors</h1>
            <p>Check text and accent colors against a background for WCAG contrast.</p>
          </div>
          <HitColorControl
            label={selectedColor === 0 ? 'Text' : `Accent ${selectedColor}`}
            value={foreground}
            onChange={(value) => updatePaletteColor(selectedColor, value)}
          />
          <HitColorControl label="Background" value={background} onChange={setBackground} />
          <div className="panel-actions">
            <button onClick={reverse}>Reverse</button>
            <button onClick={random}>Random</button>
            <button className="copy-button" onClick={copyPalette}>{copyLabel}</button>
          </div>
          <section className="palette-panel">
            <div className="palette-head">
              <span>Companion colors</span>
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
                const rowRatio = contrast(color, background);
                const rowLabel = badgeLabel(rowRatio);
                const canFix = rowLabel === 'Fail';

                return (
                  <div
                    className={`palette-row ${index === selectedColor ? 'selected' : ''}`}
                    key={`${color}-${index}`}
                  >
                    <div
                      className="palette-select"
                      onClick={() => setSelectedColor(index)}
                    >
                      <span style={{ backgroundColor: color }} />
                      <input
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
        </aside>
      </div>
    </main>
  );
}

function HitColorControl({ label, value, onChange }) {
  const normalized = normalizeHex(value);
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
            <input
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
    const foreground = randomHex();
    const background = randomHex();
    if (contrast(foreground, background) >= 4.5) {
      return { foreground, background };
    }
  }

  return Math.random() > 0.5
    ? { foreground: '#111111', background: '#FFFFFF' }
    : { foreground: '#FFFFFF', background: '#111111' };
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

function formatHex(value) {
  return normalizeHex(value).toLowerCase();
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

function Demos() {
  return (
    <main className="container demos-page">
      <h1>Demos</h1>
      <ul className="demo-links">
        <li><a href="/demos/text">Text Demo</a></li>
        <li><a href="/demos/matrix">Matrix Demo</a></li>
        <li><a href="http://basscss.com/docs/reference/color-combinations">Basscss Color Combos</a></li>
        <li><a href="http://clrs.cc/a11y">clrs.cc/a11y</a></li>
      </ul>
    </main>
  );
}

function TextDemo() {
  const [foreground, setForeground] = useState('#AACCFF');
  const [background, setBackground] = useState('#222233');
  const ratio = isValidHex(foreground) && isValidHex(background)
    ? contrast(foreground, background)
    : 0;
  const level = accessibility(ratio);

  return (
    <main
      className="text-demo"
      style={{ color: foreground, backgroundColor: background }}
    >
      <section className="text-preview">
        <div>
          <div className="preview-top">
            <HeadingBadge level={level} />
            <div className="contrast-number">{ratio.toFixed(2)}</div>
          </div>
          <h2>Contrast</h2>
          <p>
            Contrast is the difference in luminance or color that makes an object
            (or its representation in an image or display) distinguishable. In
            visual perception of the real world, contrast is determined by the
            difference in the color and brightness of the object and other objects
            within the same field of view. Because the human visual system is more
            sensitive to contrast than absolute luminance, we can perceive the world
            similarly regardless of the huge changes in illumination over the day
            or from place to place. The maximum contrast of an image is the contrast
            ratio or dynamic range.
          </p>
        </div>
      </section>
      <section className="fg-bg-form">
        <ColorControls label="Foreground" value={foreground} onChange={setForeground} />
        <ColorControls label="Background" value={background} onChange={setBackground} />
      </section>
    </main>
  );
}

function MatrixDemo() {
  const [colors, setColors] = useState(defaultColors);
  const [modalColor, setModalColor] = useState(null);

  const matrix = useMemo(() => {
    return colors.map((hex, index) => ({
      hex,
      index,
      combinations: colors
        .map((comboHex, comboIndex) => {
          if (index === comboIndex) return null;
          const ratio = contrast(hex, comboHex);
          return {
            hex: comboHex,
            contrast: ratio,
            accessibility: accessibility(ratio),
          };
        })
        .filter(Boolean),
    }));
  }, [colors]);

  const updateColor = (index, nextColor) => {
    setColors((current) => {
      const next = [...current];
      next[index] = normalizeHex(nextColor);
      return next;
    });
  };

  const removeColor = (index) => {
    setColors((current) => current.filter((_, itemIndex) => itemIndex !== index));
  };

  const addColor = () => {
    setColors((current) => [...current, '#444444']);
  };

  return (
    <main className="matrix-demo">
      <section className="matrix-stage">
        <aside className="color-list">
          {colors.map((color, index) => (
            <ColorListItem
              key={`${index}-${color}`}
              color={color}
              onChange={(nextColor) => updateColor(index, nextColor)}
              onRemove={() => removeColor(index)}
            />
          ))}
          <div className="add-color">
            <button onClick={addColor}>Add Color</button>
          </div>
        </aside>
        <section className="matrix-panel">
          {matrix.map((color) => (
            <div className="matrix-row" key={color.index}>
              {color.combinations.map((combo) => (
                <ColorChip
                  key={`${color.hex}-${combo.hex}`}
                  color={color.hex}
                  combo={combo}
                  onClick={() => setModalColor({ ...color, combo })}
                />
              ))}
            </div>
          ))}
        </section>
      </section>
      {modalColor && (
        <PreviewModal color={modalColor} onClose={() => setModalColor(null)} />
      )}
    </main>
  );
}

function ColorControls({ label, value, onChange }) {
  const normalized = normalizeHex(value);
  const hsl = hexToHsl(normalized);

  const updateHsl = (key, nextValue) => {
    const next = { ...hsl, [key]: Number(nextValue) };
    onChange(hslToHex(next.h, next.s, next.l));
  };

  return (
    <div className="control-group">
      <label htmlFor={`${label}-hex`} className="control-label">{label}</label>
      <input
        id={`${label}-hex`}
        className="hex-input"
        value={value}
        onChange={(event) => onChange(event.target.value)}
      />
      <HslSliders hsl={hsl} onChange={updateHsl} />
    </div>
  );
}

function ColorListItem({ color, onChange, onRemove }) {
  const normalized = normalizeHex(color);
  const foreground = isLight(normalized) ? '#111' : '#fff';
  const hsl = hexToHsl(normalized);

  const updateHsl = (key, nextValue) => {
    const next = { ...hsl, [key]: Number(nextValue) };
    onChange(hslToHex(next.h, next.s, next.l));
  };

  return (
    <article
      className="color-list-item"
      style={{ color: foreground, backgroundColor: normalized }}
    >
      <div className="color-list-head">
        <input
          aria-label="Hex color"
          value={normalized}
          onChange={(event) => onChange(event.target.value)}
        />
        <button title="Remove Color" onClick={onRemove}>&times;</button>
      </div>
      <HslSliders hsl={hsl} onChange={updateHsl} hideValues />
    </article>
  );
}

function HslSliders({ hsl, onChange, hideValues = false }) {
  return (
    <div className="hsl-sliders">
      <Slider
        label="Hue"
        display={hideValues ? '' : `${hsl.h}\u00b0`}
        value={hsl.h}
        max="360"
        onChange={(value) => onChange('h', value)}
      />
      <Slider
        label="Saturation"
        display={hideValues ? '' : (hsl.s / 100).toFixed(2)}
        value={hsl.s}
        max="100"
        onChange={(value) => onChange('s', value)}
      />
      <Slider
        label="Lightness"
        display={hideValues ? '' : (hsl.l / 100).toFixed(2)}
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

function ColorChip({ color, combo, onClick }) {
  return (
    <button
      className="color-chip"
      type="button"
      style={{ color, backgroundColor: combo.hex }}
      title={`Preview ${color} on ${combo.hex}`}
      onClick={onClick}
    >
      <span>{combo.contrast.toFixed(2)}</span>
      <Badge color={color} combo={combo} />
    </button>
  );
}

function Badge({ color, combo }) {
  const value = badgeLabel(combo.contrast);
  if (value === 'Fail') return <span className="badge fail">Fail</span>;
  return (
    <span className="badge" style={{ color: combo.hex, backgroundColor: color }}>
      {value}
    </span>
  );
}

function HeadingBadge({ level }) {
  let value = 'Fail';
  if (level.aaa) value = 'AAA';
  else if (level.aa) value = 'AA';
  else if (level.aaLarge) value = 'Large';

  return <h1 className="heading-badge">{value}</h1>;
}

function PreviewModal({ color, onClose }) {
  const combo = color.combo;
  const level = accessibility(combo.contrast);

  return (
    <div
      className="modal"
      style={{ color: color.hex, backgroundColor: combo.hex }}
      onClick={onClose}
    >
      <div className="modal-header">
        <strong>{color.hex} on {combo.hex}</strong>
        <button onClick={onClose}>&times;</button>
      </div>
      <div className="modal-body">
        <div>
          <div className="preview-top">
            <HeadingBadge level={level} />
            <div className="contrast-number">{combo.contrast.toFixed(2)}</div>
          </div>
          <h2>Contrast</h2>
          <p>
            Contrast is the difference in luminance or color that makes an object
            distinguishable from its background.
          </p>
        </div>
      </div>
    </div>
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
