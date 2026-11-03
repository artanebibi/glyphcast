import { DEFAULTS, sanitize, type Settings } from './settings';

/** Version of the share-link format. Bump when a change can't be read by older code. */
export const RECIPE_VERSION = 1;

function toBase64Url(text: string): string {
  const bytes = new TextEncoder().encode(text);
  let binary = '';
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function fromBase64Url(code: string): string {
  let b64 = code.replace(/-/g, '+').replace(/_/g, '/');
  while (b64.length % 4) b64 += '=';
  const binary = atob(b64);
  const bytes = Uint8Array.from(binary, (c) => c.charCodeAt(0));
  return new TextDecoder().decode(bytes);
}

/** Only the settings that differ from the defaults. */
export function settingsDelta(settings: Settings): Partial<Settings> {
  const delta: Partial<Settings> = {};
  for (const key of Object.keys(DEFAULTS) as (keyof Settings)[]) {
    if (settings[key] !== DEFAULTS[key]) {
      (delta as Record<string, unknown>)[key] = settings[key];
    }
  }
  return delta;
}

export function encodeRecipe(settings: Settings): string {
  return toBase64Url(JSON.stringify({ v: RECIPE_VERSION, ...settingsDelta(settings) }));
}

export type DecodeResult = { ok: true; settings: Settings } | { ok: false; error: string };

/** Accepts a bare code or any URL containing `?r=<code>`. */
export function decodeRecipe(input: string): DecodeResult {
  const trimmed = input.trim();
  if (!trimmed) return { ok: false, error: 'Paste a recipe code or link.' };
  const fromUrl = trimmed.match(/[?&]r=([A-Za-z0-9_\-+/=]+)/);
  const code = fromUrl ? fromUrl[1] : trimmed;
  let parsed: unknown;
  try {
    parsed = JSON.parse(fromBase64Url(code));
  } catch {
    return { ok: false, error: "That doesn't look like a valid recipe." };
  }
  if (!parsed || typeof parsed !== 'object') return { ok: false, error: 'Recipe is empty.' };
  const version = (parsed as { v?: unknown }).v;
  if (typeof version !== 'number') return { ok: false, error: 'Recipe is missing its version.' };
  if (version > RECIPE_VERSION) {
    return { ok: false, error: 'This recipe was made with a newer version of Glyphcast.' };
  }
  return { ok: true, settings: sanitize(parsed) };
}
