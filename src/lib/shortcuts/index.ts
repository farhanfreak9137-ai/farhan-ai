import fs from 'fs';
import path from 'path';

export interface CustomShortcut {
  id: string;
  name: string;
  triggers: string[];
  action: 'open_url' | 'launch_app' | 'command';
  target: string;
  browser?: 'edge' | 'chrome' | 'default';
  response?: string;
  enabled: boolean;
  createdAt?: string;
}

const SHORTCUTS_FILE = path.resolve(process.cwd(), 'data', 'custom_shortcuts.json');

/**
 * Ensures data directory and custom_shortcuts.json exist
 */
function ensureStorage(): void {
  const dir = path.dirname(SHORTCUTS_FILE);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  if (!fs.existsSync(SHORTCUTS_FILE)) {
    fs.writeFileSync(SHORTCUTS_FILE, JSON.stringify([], null, 2), 'utf-8');
  }
}

/**
 * Retrieves all saved custom shortcuts
 */
export function getCustomShortcuts(): CustomShortcut[] {
  try {
    ensureStorage();
    const raw = fs.readFileSync(SHORTCUTS_FILE, 'utf-8');
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) {
      return parsed.filter((item): item is CustomShortcut => Boolean(item && item.id && item.target));
    }
    return [];
  } catch (err) {
    console.error('[CustomShortcuts] Failed to load shortcuts:', err);
    return [];
  }
}

/**
 * Saves or updates a custom shortcut
 */
export function saveCustomShortcut(shortcut: Omit<CustomShortcut, 'id'> & { id?: string }): CustomShortcut {
  ensureStorage();
  const current = getCustomShortcuts();
  const id = shortcut.id || `sc-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
  
  const cleanTriggers = Array.isArray(shortcut.triggers)
    ? shortcut.triggers.map((t) => t.trim().toLowerCase()).filter(Boolean)
    : [];

  const entry: CustomShortcut = {
    id,
    name: shortcut.name.trim() || 'Custom Shortcut',
    triggers: cleanTriggers,
    action: shortcut.action || 'open_url',
    target: shortcut.target.trim(),
    browser: shortcut.browser || 'edge',
    response: shortcut.response?.trim() || `Opening ${shortcut.name}`,
    enabled: shortcut.enabled !== false,
    createdAt: shortcut.createdAt || new Date().toISOString(),
  };

  const existingIdx = current.findIndex((c) => c.id === id);
  if (existingIdx >= 0) {
    current[existingIdx] = entry;
  } else {
    current.push(entry);
  }

  fs.writeFileSync(SHORTCUTS_FILE, JSON.stringify(current, null, 2), 'utf-8');
  return entry;
}

/**
 * Deletes a shortcut by ID
 */
export function deleteCustomShortcut(id: string): boolean {
  ensureStorage();
  const current = getCustomShortcuts();
  const filtered = current.filter((c) => c.id !== id);
  if (filtered.length !== current.length) {
    fs.writeFileSync(SHORTCUTS_FILE, JSON.stringify(filtered, null, 2), 'utf-8');
    return true;
  }
  return false;
}

/**
 * Matches normalized user speech/text against all custom shortcut triggers.
 * Supports exact match, common prefix variations ("open X", "go to X", "message X"),
 * and keyword containment.
 */
export function matchCustomShortcut(normalizedSpeech: string): CustomShortcut | null {
  const clean = normalizedSpeech.toLowerCase().trim();
  if (!clean) return null;

  const shortcuts = getCustomShortcuts().filter((s) => s.enabled);

  for (const sc of shortcuts) {
    for (const trigger of sc.triggers) {
      const t = trigger.toLowerCase().trim();
      if (!t) continue;

      // 1. Exact match (e.g. "nila")
      if (clean === t) {
        return sc;
      }

      // 2. Action prefixes (e.g. "open nila", "go to nila", "launch nila", "show nila", "message nila", "chat with nila")
      const verbPrefixes = ['open', 'launch', 'start', 'show', 'go to', 'message', 'chat with', 'text', 'talk to', 'dm'];
      for (const v of verbPrefixes) {
        if (clean === `${v} ${t}` || clean === `${v} to ${t}`) {
          return sc;
        }
      }

      // 3. Isolated word match in short sentence (e.g. "hey auren open nila please")
      const words = clean.split(/\s+/);
      if (words.length <= 4 && words.includes(t)) {
        return sc;
      }
    }
  }

  return null;
}
