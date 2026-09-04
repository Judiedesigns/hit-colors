import React, { useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import hello from 'hello-color';
import { ArrowUpDown, Shuffle } from 'lucide-react';
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

const SAVED_SYSTEMS_KEY = 'hitcolors:systems';
const MAX_SAVED_SYSTEMS = 12;

function normalizeColorSystem(system) {
  const palette = Array.isArray(system?.palette)
    ? system.palette.filter(isValidHex).map(normalizeHex).slice(0, 5)
    : [];
  const background = isValidHex(system?.background) ? normalizeHex(system.background) : null;
  if (!palette.length || !background) return null;
  return { palette, background };
}

function colorSystemKey(system) {
  return `${system.background}:${system.palette.join(',')}`;
}

function loadSavedSystems() {
  try {
    const raw = window.localStorage.getItem(SAVED_SYSTEMS_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    if (!Array.isArray(parsed)) return [];
    return parsed
      .map(normalizeColorSystem)
      .filter(Boolean)
      .slice(0, MAX_SAVED_SYSTEMS);
  } catch {
    return [];
  }
}

function writeSavedSystems(systems) {
  try {
    window.localStorage.setItem(SAVED_SYSTEMS_KEY, JSON.stringify(systems));
  } catch {
    // Storage can be unavailable (private browsing, quota) - saving is best-effort.
  }
}

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
  const [saved, setSaved] = useState(loadSavedSystems);
  const [mobileTab, setMobileTab] = useState('fg');
  const [mobileEditor, setMobileEditor] = useState(null);
  const [randomHistory, setRandomHistory] = useState([]);
  const foreground = palette[selectedColor] || palette[0];
  const displayForeground = safeHex(foreground);
  const displayBackground = safeHex(background);
  const currentSystem = {
    palette: palette.map((color) => safeHex(color)),
    background: displayBackground,
  };
  const ratio = contrast(displayForeground, displayBackground);
  const previewUiColor = contrast('#0e1012', displayBackground) >= contrast('#e8e9ea', displayBackground)
    ? '#0e1012'
    : '#e8e9ea';

  const activateForeground = () => {
    setMobileTab('fg');
  };

  const activateBackground = () => {
    setMobileTab('bg');
  };

  const openMobileEditor = (nextTab) => {
    setMobileTab(nextTab);
    setMobileEditor(nextTab);
  };

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
    const next = randomPassingPair(randomHistory);
    saveActionHistory();
    setRandomHistory((history) => [colorPairFamily(next), ...history].slice(0, 6));
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
      activateForeground();
      return [...colors, next];
    });
  };

  const shuffleCompanionColors = () => {
    if (palette.length <= 1) return;
    saveActionHistory();
    setPalette((colors) => buildShuffledCompanionPalette(
      safeHex(colors[0]),
      displayBackground,
      colors.length,
    ));
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

  const saveCurrentSystem = () => {
    setSaved((systems) => {
      if (systems.some((system) => colorSystemKey(system) === colorSystemKey(currentSystem))) {
        return systems;
      }
      const next = [...systems, currentSystem].slice(-MAX_SAVED_SYSTEMS);
      writeSavedSystems(next);
      return next;
    });
  };

  const removeSavedSystem = (index) => {
    setSaved((systems) => {
      const next = systems.filter((_, systemIndex) => systemIndex !== index);
      writeSavedSystems(next);
      return next;
    });
  };

  const loadSavedSystem = (system) => {
    setPalette(system.palette);
    setBackground(system.background);
    setSelectedColor(0);
    activateForeground();
  };

  return (
    <main className="contrast-shell">
      <style>{`::selection { color: ${displayBackground}; background-color: ${displayForeground}; }`}</style>
      <div className="contrast-layout">
        <section
          className="contrast-preview"
          style={{
            color: displayForeground,
            backgroundColor: displayBackground,
          }}
        >
          <div className="contrast-score">
            <span>Aa</span>
            <strong>{ratio.toFixed(2)}</strong>
            <b>{badgeLabel(ratio)}</b>
            <button
              type="button"
              className="contrast-info"
              style={{ color: previewUiColor }}
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
            <h1 className="hit-wordmark" aria-label="Hit colors">
              <span className="hit-wordmark-h" aria-hidden="true">H</span>
              <span aria-hidden="true">it colors</span>
            </h1>
            <p>WCAG contrast for text and accent colors.</p>
          </div>
          <div className="mobile-editor-bar" aria-label="Mobile contrast controls">
            <button
              type="button"
              className={`mobile-editor-swatch ${mobileTab === 'fg' ? 'active' : ''}`}
              style={{ backgroundColor: displayForeground }}
              onClick={() => openMobileEditor('fg')}
              aria-label={`Edit ${selectedColor === 0 ? 'text' : `accent ${selectedColor}`} color`}
            />
            <button
              type="button"
              className="mobile-editor-swap"
              onClick={reverse}
              aria-label="Swap text and background colors"
              title="Swap text and background colors"
            >
              <ArrowUpDown aria-hidden="true" />
            </button>
            <button
              type="button"
              className={`mobile-editor-swatch mobile-editor-background ${mobileTab === 'bg' ? 'active' : ''}`}
              style={{ backgroundColor: displayBackground }}
              onClick={() => openMobileEditor('bg')}
              aria-label="Edit background color"
            />
            <button
              type="button"
              className="mobile-editor-random"
              onClick={random}
              aria-label="Randomize contrast pair"
              title="Randomize contrast pair"
            >
              <Shuffle aria-hidden="true" />
            </button>
          </div>
          <div className={`mobile-tabs ${mobileTab === 'bg' ? 'is-background' : 'is-foreground'}`}>
            <button
              type="button"
              className={`mobile-tab ${mobileTab === 'fg' ? 'active' : ''}`}
              onClick={activateForeground}
              aria-pressed={mobileTab === 'fg'}
            >
              <span style={{ backgroundColor: displayForeground }} />
              {selectedColor === 0 ? 'Text' : `Accent ${selectedColor}`}
            </button>
            <button
              type="button"
              className={`mobile-tab ${mobileTab === 'bg' ? 'active' : ''}`}
              onClick={activateBackground}
              aria-pressed={mobileTab === 'bg'}
            >
              <span style={{ backgroundColor: displayBackground }} />
              Background
            </button>
          </div>
          <HitColorControl
            label={selectedColor === 0 ? 'Text' : `Accent ${selectedColor}`}
            value={foreground}
            onChange={(value) => updatePaletteColor(selectedColor, value)}
            onActivate={activateForeground}
            hiddenOnMobile={mobileTab !== 'fg'}
            idPrefix="desktop"
          />
          <HitColorControl
            label="Background"
            value={background}
            onChange={setBackground}
            onActivate={activateBackground}
            hiddenOnMobile={mobileTab !== 'bg'}
            idPrefix="desktop"
          />
          {mobileEditor && (
            <div className="mobile-editor-overlay" role="dialog" aria-modal="true">
              <button
                type="button"
                className="mobile-editor-backdrop"
                onClick={() => setMobileEditor(null)}
                aria-label="Close color editor"
              />
              <div className="mobile-editor-sheet">
                <div className="mobile-editor-sheet-head">
                  <span>{mobileEditor === 'fg' ? (selectedColor === 0 ? 'Text' : `Accent ${selectedColor}`) : 'Background'}</span>
                  <button type="button" onClick={() => setMobileEditor(null)}>Done</button>
                </div>
                <HitColorControl
                  label={mobileEditor === 'fg' ? (selectedColor === 0 ? 'Text' : `Accent ${selectedColor}`) : 'Background'}
                  value={mobileEditor === 'fg' ? foreground : background}
                  onChange={mobileEditor === 'fg' ? (value) => updatePaletteColor(selectedColor, value) : setBackground}
                  onActivate={mobileEditor === 'fg' ? activateForeground : activateBackground}
                  idPrefix="mobile"
                />
              </div>
            </div>
          )}
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
              <div className="palette-actions">
                <button
                  type="button"
                  className="palette-shuffle"
                  onClick={shuffleCompanionColors}
                  disabled={palette.length <= 1}
                  aria-label="Shuffle palette colors"
                  title="Shuffle palette colors"
                >
                  <Shuffle
                    aria-hidden="true"
                  />
                </button>
                <button
                  type="button"
                  onClick={addCompanionColor}
                  disabled={palette.length >= 5}
                  aria-label="Add companion color"
                  title="Add companion color"
                >
                  +
                </button>
              </div>
            </div>
            <div className="palette-list">
              {palette.map((color, index) => {
                const rowRatio = contrast(safeHex(color), displayBackground);
                const rowLabel = badgeLabel(rowRatio);
                const canFix = rowLabel === 'Fail';

                return (
                  <div
                    className={`palette-row ${index === selectedColor ? 'selected' : ''} ${canFix ? 'can-fix' : ''}`}
                    key={`companion-${index}`}
                    onClick={() => {
                      setSelectedColor(index);
                      activateForeground();
                    }}
                  >
                    <div className="palette-select">
                      <span style={{ backgroundColor: safeHex(color) }} />
                      <HexTextInput
                        value={formatHex(color)}
                        autoComplete="off"
                        autoCorrect="off"
                        autoCapitalize="off"
                        spellCheck="false"
                        onFocus={() => {
                          setSelectedColor(index);
                          activateForeground();
                        }}
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
                      onClick={(event) => {
                        event.stopPropagation();
                        removeCompanionColor(index);
                      }}
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
          <section className="saved-panel">
            <div className="saved-head">
              <span>Saved</span>
            </div>
            <div className="saved-list">
              <button
                type="button"
                className="saved-add"
                onClick={saveCurrentSystem}
                aria-label="Save current color system"
                title="Save current color system"
              >
                +
              </button>
              {saved.length === 0 && (
                <span className="saved-hint">Save this system</span>
              )}
              {saved.map((system, index) => (
                <span
                  className="saved-color"
                  key={`${colorSystemKey(system)}-${index}`}
                >
                  <button
                    type="button"
                    className="saved-swatch"
                    style={{ backgroundColor: system.background }}
                    title={`Use saved system ${index + 1}`}
                    onClick={() => loadSavedSystem(system)}
                    aria-label={`Use saved color system ${index + 1}`}
                  >
                    <span style={{ backgroundColor: system.palette[0] }} />
                  </button>
                  <button
                    type="button"
                    className="saved-remove"
                    onClick={() => removeSavedSystem(index)}
                    aria-label={`Remove saved color system ${index + 1}`}
                  >
                    &times;
                  </button>
                </span>
              ))}
            </div>
          </section>
          <section className="maker-panel">
            <div>
              <a href="https://florenceeze.com">Made by Mars</a>
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

function HitColorControl({ label, value, onChange, onActivate, hiddenOnMobile, idPrefix = 'control' }) {
  const normalized = safeHex(value);
  const hsl = hexToHsl(normalized);
  const canUseEyeDropper = typeof window !== 'undefined' && 'EyeDropper' in window;
  const inputId = `${idPrefix}-${label.toLowerCase().replace(/[^a-z0-9]+/g, '-')}-tool-hex`;

  const updateHsl = (key, nextValue) => {
    onActivate?.();
    const next = { ...hsl, [key]: Number(nextValue) };
    onChange(hslToHex(next.h, next.s, next.l));
  };

  const pickFromScreen = async () => {
    if (!canUseEyeDropper) return;
    onActivate?.();
    try {
      const result = await new window.EyeDropper().open();
      onChange(result.sRGBHex);
    } catch {
      // The browser throws when the user cancels the picker.
    }
  };

  return (
    <section
      className="panel-control"
      style={{ '--control-color': normalized }}
      data-mobile-hidden={hiddenOnMobile ? 'true' : undefined}
    >
      <div className="panel-control-head">
        <label htmlFor={inputId}>{label}</label>
        <div className="control-field-row">
          <div className="control-field">
            <span className="control-swatch" style={{ backgroundColor: normalized }}>
              <input
                type="color"
                value={normalized}
                onChange={(event) => {
                  onActivate?.();
                  onChange(event.target.value);
                }}
                aria-label={`Pick ${label.toLowerCase()} color`}
              />
            </span>
            <HexTextInput
              id={inputId}
              value={formatHex(value)}
              autoComplete="off"
              autoCorrect="off"
              autoCapitalize="off"
              spellCheck="false"
              onFocus={onActivate}
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

function randomPassingPair(recentFamilies = []) {
  let best = null;

  for (let index = 0; index < 120; index += 1) {
    const candidate = buildRandomPair(index);
    const ratio = contrast(candidate.foreground, candidate.background);

    if (ratio < 4.5) continue;

    const score = scoreRandomPair(candidate, recentFamilies);
    if (!best || score > best.score) {
      best = { ...candidate, score };
    }
  }

  if (best) {
    return {
      foreground: best.foreground,
      background: best.background,
    };
  }

  return Math.random() > 0.5
    ? { foreground: '#111111', background: '#FFFFFF' }
    : { foreground: '#FFFFFF', background: '#111111' };
}

function buildRandomPair(attempt) {
  const background = randomExpressiveColor(attempt);
  const backgroundHsl = hexToHsl(background);
  const offsets = [0, 30, -40, 75, -95, 140, -150, 180];
  const targetHue = wrapHue(backgroundHsl.h + offsets[attempt % offsets.length] + randomBetween(-18, 18));
  const targetSaturation = clamp(randomBetween(50, 96), 46, 98);
  const lightDirection = backgroundHsl.l > 52 ? -1 : 1;
  const targetLightness = lightDirection > 0
    ? randomBetween(68, 96)
    : randomBetween(5, 34);
  const expressiveForeground = hslToHex(targetHue, targetSaturation, targetLightness);
  const foreground = nudgeToContrast(expressiveForeground, background, 4.5);

  if (contrast(foreground, background) >= 4.5) {
    return { foreground, background };
  }

  const fallback = hello(background, { contrast: 4.5 });
  return {
    foreground: fallback?.color ? normalizeHex(fallback.color) : (backgroundHsl.l > 50 ? '#111111' : '#FFFFFF'),
    background,
  };
}

function randomExpressiveColor(attempt) {
  const hue = wrapHue(randomBetween(0, 360));
  const families = [
    { saturation: [58, 94], lightness: [12, 30] },
    { saturation: [54, 96], lightness: [32, 50] },
    { saturation: [48, 90], lightness: [52, 70] },
    { saturation: [38, 82], lightness: [72, 90] },
  ];
  const family = families[attempt % families.length];

  return hslToHex(
    hue,
    randomBetween(...family.saturation),
    randomBetween(...family.lightness),
  );
}

function scoreRandomPair(pair, recentFamilies) {
  const family = colorPairFamily(pair);
  const background = hexToHsl(pair.background);
  const foreground = hexToHsl(pair.foreground);
  const repeatedPenalty = recentFamilies.includes(family) ? 18 : 0;
  const contrastScore = Math.min(contrast(pair.foreground, pair.background), 9) * 2;
  const hueDistanceScore = Math.min(hueDistance(background.h, foreground.h), 150) / 150 * 10;
  const colorfulnessScore = (background.s + foreground.s) / 200 * 8;

  return contrastScore + hueDistanceScore + colorfulnessScore - repeatedPenalty;
}

function colorPairFamily(pair) {
  const background = hexToHsl(pair.background);
  const foreground = hexToHsl(pair.foreground);
  const hueBand = Math.floor(background.h / 45);
  const lightBand = background.l < 35 ? 'dark' : background.l > 68 ? 'light' : 'mid';
  const relationship = hueDistance(background.h, foreground.h) > 120 ? 'wide' : 'near';

  return `${hueBand}:${lightBand}:${relationship}`;
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

function buildShuffledCompanionPalette(foreground, background, count) {
  const next = [foreground];

  for (let index = 1; index < count; index += 1) {
    next.push(buildShuffledCompanionColor(foreground, background, index, next));
  }

  return next;
}

function buildCompanionColor(seed, background, index) {
  if (!isValidHex(seed) || !isValidHex(background)) return seed;

  const base = hexToHsl(seed);
  const offsets = [0, 150, -115, 70, -170];
  const saturations = [base.s, base.s + 8, base.s - 8, base.s + 4, base.s - 12];
  const lightness = [base.l, base.l - 2, base.l + 5, base.l - 6, base.l + 8];
  const next = hslToHex(
    wrapHue(base.h + offsets[index % offsets.length]),
    clamp(saturations[index % saturations.length], 42, 96),
    clamp(lightness[index % lightness.length], 18, 82),
  );

  return nudgeToContrast(next, background, 3);
}

function buildShuffledCompanionColor(seed, background, index, existingColors) {
  if (!isValidHex(seed) || !isValidHex(background)) return seed;

  const base = hexToHsl(seed);
  const zones = [150, -115, 70, -170, 35, -70, 115, -150];
  let best = null;

  for (let attempt = 0; attempt < 80; attempt += 1) {
    const zone = zones[(index + attempt) % zones.length];
    const hue = wrapHue(base.h + zone + randomBetween(-20, 20));
    const saturation = clamp(randomBetween(
      Math.max(54, base.s - 12),
      Math.min(96, base.s + 24),
    ), 50, 96);
    const lightness = clamp(randomBetween(24, 76), 18, 82);
    const candidate = nudgeToContrast(hslToHex(hue, saturation, lightness), background, 3);
    const ratio = contrast(candidate, background);

    if (ratio < 3) continue;

    const score = scoreCompanionCandidate(candidate, background, existingColors);
    if (!best || score > best.score) {
      best = { color: candidate, score };
    }
  }

  return best?.color || buildCompanionColor(seed, background, index);
}

function scoreCompanionCandidate(candidate, background, existingColors) {
  const hsl = hexToHsl(candidate);
  const ratio = contrast(candidate, background);
  const nearestHue = Math.min(
    ...existingColors.map((color) => hueDistance(hsl.h, hexToHsl(color).h)),
  );
  const nearestLightness = Math.min(
    ...existingColors.map((color) => Math.abs(hsl.l - hexToHsl(color).l)),
  );
  const contrastScore = ratio >= 4.5 ? 12 : 6;
  const hueScore = Math.min(nearestHue, 120) / 120;
  const saturationScore = hsl.s / 100;
  const lightnessScore = Math.min(nearestLightness, 24) / 24;

  return contrastScore + hueScore * 8 + saturationScore * 3 + lightnessScore * 2;
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

function hueDistance(first, second) {
  const distance = Math.abs(first - second) % 360;
  return Math.min(distance, 360 - distance);
}

function randomBetween(min, max) {
  return min + Math.random() * (max - min);
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
