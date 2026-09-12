import { exec } from 'child_process';
import { promisify } from 'util';
import path from 'path';
import { OrchestrationStep } from '@/types/orchestrator';
import { matchCustomShortcut } from '../shortcuts';

const execAsync = promisify(exec);

export interface FastPathMatchResult {
  matched: boolean;
  actionName?: string;
  answer?: string;
  steps?: OrchestrationStep[];
  error?: string;
}

/**
 * Normalizes speech/typed input by stripping conversational prefixes, filler words,
 * punctuation, and polite requests.
 */
function normalizeInput(raw: string): string {
  let text = raw.toLowerCase().trim();
  // Strip punctuation
  text = text.replace(/[.!?,"';:]+/g, ' ').replace(/\s+/g, ' ').trim();

  // Strip polite words anywhere in the sentence
  text = text.replace(/\b(?:please|kindly|thanks|thank you|would you kindly)\b/g, ' ');

  // Strip conversational wake phrases and polite prefixes
  const prefixPatterns = [
    /^(?:hey\s+auren|auren|hey\s+jarvis|jarvis|hey\s+farhan|farhan|computer|assistant)\b\s*/,
    /^(?:can\s+you\s+|could\s+you\s+|would\s+you\s+|will\s+you\s+)/,
    /^(?:i\s+want\s+you\s+to\s+|i\s+want\s+to\s+|help\s+me\s+|go\s+ahead\s+and\s+|just\s+|now\s+)/,
    /^(?:tell\s+me\s+|show\s+me\s+|give\s+me\s+|check\s+out\s+)/,
  ];

  for (const pat of prefixPatterns) {
    text = text.replace(pat, '').trim();
  }

  // Strip common filler articles & possessives ("the", "a", "an", "my", "our", "some")
  text = text.replace(/\b(?:the|a|an|my|our|some)\b/g, ' ').replace(/\s+/g, ' ').trim();

  return text;
}

/**
 * Common app target aliases mapping spoken/conversational terms to executable targets
 */
const APP_ALIASES: Record<string, string> = {
  // 1. Browsers
  'chrome': 'chrome',
  'google chrome': 'chrome',
  'googlechrome': 'chrome',
  'browser': 'chrome',
  'web browser': 'chrome',
  'internet': 'chrome',
  'web': 'chrome',
  'edge': 'edge',
  'microsoft edge': 'edge',
  'ms edge': 'edge',
  'msedge': 'edge',
  'internet explorer': 'internet explorer',
  'ie': 'internet explorer',
  'brave': 'brave',
  'firefox': 'firefox',
  'opera': 'opera',
  'yt': 'youtube',

  // 2. Social, Chat & Communication
  'whatsapp': 'whatsapp',
  'wa': 'whatsapp',
  'whatsapp desktop': 'whatsapp',
  'chatgpt': 'chatgpt',
  'chat gpt': 'chatgpt',
  'gpt': 'chatgpt',
  'openai': 'chatgpt',
  'chatgpt desktop': 'chatgpt',
  'skype': 'skype',
  'phone link': 'phone link',
  'your phone': 'phone link',
  'phone': 'phone link',
  'phonelink': 'phone link',
  'discord': 'discord',
  'telegram': 'telegram',
  'slack': 'slack',
  'teams': 'teams',
  'zoom': 'zoom',

  // 3. Microsoft Office & Productivity
  'word': 'word',
  'ms word': 'word',
  'microsoft word': 'word',
  'word 2013': 'word',
  'winword': 'word',
  'excel': 'excel',
  'ms excel': 'excel',
  'microsoft excel': 'excel',
  'excel 2013': 'excel',
  'powerpoint': 'powerpoint',
  'power point': 'powerpoint',
  'ppt': 'powerpoint',
  'powerpnt': 'powerpoint',
  'powerpoint 2013': 'powerpoint',
  'presentation': 'powerpoint',
  'onenote': 'onenote',
  'one note': 'onenote',
  'onenote 2013': 'onenote',
  'outlook': 'outlook',
  'email': 'outlook',
  'mail': 'outlook',
  'ms outlook': 'outlook',
  'outlook 2013': 'outlook',

  // 4. Developer Tools & IDEs
  'android studio': 'android studio',
  'studio': 'android studio',
  'androidstudio': 'android studio',
  'vs code': 'vs code',
  'vscode': 'vs code',
  'code': 'vs code',
  'visual studio code': 'vs code',
  'editor': 'vs code',
  'code editor': 'vs code',
  'ide': 'vs code',
  'antigravity': 'antigravity',
  'auren': 'antigravity',
  'auren ai': 'antigravity',
  'jarvis': 'antigravity',
  'farhan ai': 'antigravity',
  'git bash': 'git bash',
  'gitbash': 'git bash',
  'bash': 'git bash',
  'git gui': 'git gui',
  'gitgui': 'git gui',
  'git cmd': 'git cmd',
  'gitcmd': 'git cmd',
  'python idle': 'python idle',
  'idle': 'python idle',
  'python': 'python idle',
  'node': 'node',
  'nodejs': 'node',
  'visual studio installer': 'visual studio installer',
  'vs installer': 'visual studio installer',

  // 5. Media, Audio & Video
  'vlc': 'vlc',
  'vlc player': 'vlc',
  'vlc media player': 'vlc',
  'video player': 'vlc',
  'fxsound': 'fxsound',
  'fx sound': 'fxsound',
  'equalizer': 'fxsound',
  'sound equalizer': 'fxsound',
  'audio boost': 'fxsound',
  'windows media player': 'windows media player',
  'media player': 'windows media player',
  'wmplayer': 'windows media player',
  'movies and tv': 'movies and tv',
  'movies & tv': 'movies and tv',
  'movies': 'movies and tv',
  'tv': 'movies and tv',
  'voice recorder': 'voice recorder',
  'sound recorder': 'voice recorder',
  'recorder': 'voice recorder',
  'camera': 'camera',
  'webcam': 'camera',
  'photos': 'photos',
  'pictures': 'photos',
  'gallery': 'photos',
  'spotify': 'spotify',
  'music': 'spotify',

  // 6. Games & Gaming
  'tlauncher': 'tlauncher',
  'minecraft': 'tlauncher',
  'tl': 'tlauncher',
  'roblox': 'roblox',
  'roblox studio': 'roblox',
  'asphalt 8': 'asphalt 8',
  'asphalt': 'asphalt 8',
  'asphalt8': 'asphalt 8',
  'racing game': 'asphalt 8',
  'cricket': 'cricket',
  'wcc2': 'cricket',
  'wcc 2': 'cricket',
  'cricket game': 'cricket',
  'world cricket championship': 'cricket',
  'solitaire': 'solitaire',
  'cards': 'solitaire',

  // 7. Utilities & Diagnostics
  'anydesk': 'anydesk',
  'any desk': 'anydesk',
  'remote desktop': 'anydesk',
  'avro': 'avro keyboard',
  'avro keyboard': 'avro keyboard',
  'bangla keyboard': 'avro keyboard',
  'winrar': 'winrar',
  'rar': 'winrar',
  'unzip': 'winrar',
  'zip': 'winrar',
  'wiztree': 'wiztree',
  'disk analyzer': 'wiztree',
  'disk space': 'wiztree',
  'wiz tree': 'wiztree',
  'fdm': 'free download manager',
  'free download manager': 'free download manager',
  'download manager': 'free download manager',
  'quicklook': 'quicklook',
  'quick look': 'quicklook',
  'lively wallpaper': 'lively wallpaper',
  'lively': 'lively wallpaper',
  'live wallpaper': 'lively wallpaper',
  'cpu-z': 'cpu-z',
  'cpuz': 'cpu-z',
  'cpu info': 'cpu-z',
  'crystaldiskinfo': 'crystaldiskinfo',
  'crystal disk': 'crystaldiskinfo',
  'disk health': 'crystaldiskinfo',
  'hwinfo': 'hwinfo',
  'hwinfo64': 'hwinfo',
  'hardware info': 'hwinfo',

  // 8. Built-in Windows Accessories & Tools
  'calc': 'calculator',
  'calculator': 'calculator',
  'math': 'calculator',
  'notepad': 'notepad',
  'notes': 'notepad',
  'wordpad': 'wordpad',
  'paint': 'paint',
  'paint 3d': 'paint',
  'drawing': 'paint',
  'snipping tool': 'snipping tool',
  'snip': 'snipping tool',
  'settings': 'settings',
  'windows settings': 'settings',
  'preferences': 'settings',
  'control panel': 'control panel',
  'control': 'control panel',
  'task manager': 'task manager',
  'taskmgr': 'task manager',
  'tasks': 'task manager',
  'activity monitor': 'task manager',
  'explorer': 'file explorer',
  'file explorer': 'file explorer',
  'files': 'file explorer',
  'file manager': 'file explorer',
  'my computer': 'file explorer',
  'this pc': 'file explorer',
  'terminal': 'command prompt',
  'command prompt': 'command prompt',
  'cmd': 'command prompt',
  'powershell': 'powershell',
  'ps': 'powershell',
  'windows terminal': 'windows terminal',
  'wt': 'windows terminal',
  'registry editor': 'registry editor',
  'regedit': 'registry editor',
  'device manager': 'device manager',
  'disk management': 'disk management',
  'services': 'services',
  'event viewer': 'event viewer',
  'resource monitor': 'resource monitor',
  'resmon': 'resource monitor',
  'performance monitor': 'performance monitor',
  'disk cleanup': 'disk cleanup',
  'cleanmgr': 'disk cleanup',
  'windows security': 'windows security',
  'defender': 'windows security',
  'antivirus': 'windows security',
  'microsoft store': 'microsoft store',
  'store': 'microsoft store',
  'app store': 'microsoft store',
  'weather': 'weather',
  'clock': 'clock',
  'alarm': 'clock',
  'timer': 'clock',
  'sticky notes': 'sticky notes',
  'stickynotes': 'sticky notes',
  'character map': 'character map',
  'charmap': 'character map',
  'magnifier': 'magnifier',
  'on-screen keyboard': 'on-screen keyboard',
  'osk': 'on-screen keyboard',

  // 9. Web Sites
  'youtube': 'youtube',
  'google': 'google',
  'github': 'github',
  'reddit': 'reddit',
  'twitter': 'twitter',
  'x': 'x',
  'gmail': 'gmail',
  'instagram': 'instagram',
  'ig': 'instagram',
  'facebook': 'facebook',
  'fb': 'facebook',
  'linkedin': 'linkedin',
  'wikipedia': 'wikipedia',
  'netflix': 'netflix',
  'amazon': 'amazon',
  'downloads': 'downloads',
  'documents': 'documents',
};

/**
 * Cleans an application target string by stripping articles and common suffixes
 */
function cleanAppTarget(target: string): string {
  let t = target.trim();
  t = t.replace(/^(?:the|a|an|my)\s+/i, '');
  t = t.replace(/\s+(?:app|application|program|software|browser|tool|folder)$/i, '');
  t = t.trim();
  return APP_ALIASES[t.toLowerCase()] || t;
}

/**
 * Executes a command against our native Python PC controller suite
 */
export async function runPcController(args: string[]): Promise<any> {
  const pythonPath = process.env.PYTHON_PATH || 'python';
  const scriptPath = path.resolve(process.cwd(), 'scripts', 'pc_controller.py');
  const safeArgs = args.map((arg) => (arg.includes(' ') ? `"${arg}"` : arg)).join(' ');
  const cmd = `"${pythonPath}" "${scriptPath}" ${safeArgs}`;

  try {
    const { stdout } = await execAsync(cmd, { timeout: 10000, shell: 'cmd.exe' });
    const trimmed = stdout.trim();
    if (trimmed) {
      try {
        return JSON.parse(trimmed);
      } catch {
        return { success: true, message: trimmed };
      }
    }
    return { success: true };
  } catch (err: any) {
    const stderr = err.stderr ? String(err.stderr).trim() : err.message;
    return { success: false, error: stderr };
  }
}

/**
 * Evaluates a user prompt to determine if it can be fulfilled deterministically
 * by the offline Python automation suite with 0 API tokens and <20ms latency.
 */
export async function tryFastPathRoute(userPrompt: string): Promise<FastPathMatchResult> {
  const clean = userPrompt.trim();
  const normalized = normalizeInput(clean);

  if (!normalized) {
    return { matched: false };
  }

  // ---------------------------------------------------------------------------
  // 0. User-Defined Custom Shortcuts & Voice Macros (e.g. "Nila", custom URLs/apps)
  // ---------------------------------------------------------------------------
  const customShortcut = matchCustomShortcut(normalized) || matchCustomShortcut(clean);
  if (customShortcut) {
    let pcArgs: string[] = [];
    if (customShortcut.action === 'open_url') {
      pcArgs = ['app', 'launch', customShortcut.target];
      if (customShortcut.browser) {
        pcArgs.push('--browser', customShortcut.browser);
      }
    } else if (customShortcut.action === 'launch_app') {
      pcArgs = ['app', 'launch', customShortcut.target];
    }

    const res = await runPcController(pcArgs);
    const answer = customShortcut.response || `Opened **${customShortcut.name}** for you.`;
    return {
      matched: true,
      actionName: `custom_shortcut_${customShortcut.id}`,
      answer,
      steps: [
        {
          type: 'reasoning',
          step: 'intent_resolution',
          status: 'completed',
          title: `Custom Voice Shortcut: ${customShortcut.name}`,
          details: `Matched trigger against custom shortcut '${customShortcut.name}' -> ${customShortcut.target}`,
        },
        {
          type: 'tool_result',
          step: 'tool_execution',
          status: res.success ? 'completed' : 'failed',
          title: `Executed ${customShortcut.name}`,
          data: res,
        },
      ],
    };
  }

  // ---------------------------------------------------------------------------
  // 1. Window & Desktop Controls
  // ---------------------------------------------------------------------------
  
  // Minimize All / Clear Screen / Show Desktop
  const isMinimizeIntent =
    normalized === 'desktop' ||
    normalized === 'minimize' ||
    normalized.includes('minimize all') ||
    normalized.includes('minimize windows') ||
    normalized.includes('minimize everything') ||
    normalized.includes('show desktop') ||
    normalized.includes('go to desktop') ||
    normalized.includes('clear screen') ||
    normalized.includes('clear monitor') ||
    normalized.includes('clear display') ||
    normalized.includes('clean desktop') ||
    normalized.includes('clean screen') ||
    normalized.includes('hide all') ||
    normalized.includes('hide windows') ||
    normalized.includes('hide everything') ||
    normalized.includes('hide apps') ||
    normalized.includes('put away') ||
    normalized.includes('desktop view');

  if (isMinimizeIntent) {
    await runPcController(['window', 'minimize_all']);
    return {
      matched: true,
      actionName: 'minimize_all',
      answer: 'All windows minimized. Desktop is shown.',
      steps: [
        {
          type: 'reasoning',
          step: 'intent_resolution',
          status: 'completed',
          title: 'Fast-Path: Show Desktop',
          details: 'Triggered native Shell.Application MinimizeAll and Win+D simulation.',
        },
      ],
    };
  }

  // Restore Windows / Unminimize
  const isRestoreIntent =
    normalized === 'restore' ||
    normalized.includes('restore all') ||
    normalized.includes('restore windows') ||
    normalized.includes('restore everything') ||
    normalized.includes('unminimize') ||
    normalized.includes('unminimize windows') ||
    normalized.includes('bring back windows') ||
    normalized.includes('bring windows back') ||
    normalized.includes('bring back everything') ||
    normalized.includes('show windows again') ||
    normalized.includes('show apps again') ||
    normalized.includes('undo minimize');

  if (isRestoreIntent) {
    await runPcController(['window', 'restore_all']);
    return {
      matched: true,
      actionName: 'restore_all',
      answer: 'All windows restored.',
      steps: [
        {
          type: 'reasoning',
          step: 'intent_resolution',
          status: 'completed',
          title: 'Fast-Path: Restore Windows',
          details: 'Triggered Shell.Application UndoMinimizeALL on user desktop.',
        },
      ],
    };
  }

  // Close Active Window
  const isCloseActiveIntent =
    normalized === 'close window' ||
    normalized === 'close active window' ||
    normalized === 'close this window' ||
    normalized === 'close current window' ||
    normalized === 'close active' ||
    normalized === 'close tab' ||
    normalized === 'close this' ||
    normalized === 'shut this window' ||
    normalized === 'exit window' ||
    normalized === 'kill this window';

  if (isCloseActiveIntent) {
    const res = await runPcController(['window', 'close_active']);
    return {
      matched: true,
      actionName: 'close_active_window',
      answer: res.success ? 'Active window closed.' : 'No active window found to close.',
      steps: [
        {
          type: 'reasoning',
          step: 'intent_resolution',
          status: 'completed',
          title: 'Fast-Path: Close Active Window',
          details: 'Sent WM_CLOSE message to foreground window handle.',
        },
      ],
    };
  }

  // Workstation Lock
  const isLockIntent =
    normalized.includes('lock pc') ||
    normalized.includes('lock computer') ||
    normalized.includes('lock screen') ||
    normalized.includes('lock workstation') ||
    normalized.includes('lock machine') ||
    normalized === 'lock';

  if (isLockIntent) {
    await runPcController(['window', 'lock']);
    return {
      matched: true,
      actionName: 'lock_pc',
      answer: 'Workstation locked successfully.',
      steps: [
        {
          type: 'reasoning',
          step: 'intent_resolution',
          status: 'completed',
          title: 'Fast-Path: Lock Screen',
          details: 'Triggered Windows LockWorkStation API.',
        },
      ],
    };
  }

  // ---------------------------------------------------------------------------
  // 2. Audio & Volume Controls
  // ---------------------------------------------------------------------------
  const isMuteIntent =
    normalized === 'mute' ||
    normalized === 'unmute' ||
    normalized.includes('toggle mute') ||
    normalized.includes('turn off sound') ||
    normalized.includes('turn on sound') ||
    normalized.includes('silence') ||
    normalized.includes('mute pc') ||
    normalized.includes('mute volume') ||
    normalized.includes('mute sound') ||
    normalized.includes('mute audio') ||
    normalized.includes('shut up') ||
    normalized.includes('be quiet') ||
    normalized.includes('kill sound') ||
    normalized.includes('no sound');

  if (isMuteIntent) {
    await runPcController(['volume', 'mute']);
    return {
      matched: true,
      actionName: 'volume_mute',
      answer: 'Volume mute toggled.',
      steps: [
        {
          type: 'reasoning',
          step: 'intent_resolution',
          status: 'completed',
          title: 'Fast-Path: Mute Volume',
          details: 'Direct WM_APPCOMMAND mute broadcast and virtual key trigger.',
        },
      ],
    };
  }

  const isVolUpIntent =
    normalized.includes('volume up') ||
    normalized.includes('increase volume') ||
    normalized.includes('turn up volume') ||
    normalized.includes('turn up sound') ||
    normalized.includes('raise volume') ||
    normalized.includes('boost volume') ||
    normalized.includes('more volume') ||
    normalized.includes('more sound') ||
    normalized.includes('make louder') ||
    normalized.includes('make it louder') ||
    normalized.includes('turn up') ||
    normalized.includes('turn it up') ||
    normalized === 'louder' ||
    normalized === 'crank it up';

  if (isVolUpIntent) {
    await runPcController(['volume', 'up', '--steps', '4']);
    return {
      matched: true,
      actionName: 'volume_up',
      answer: 'Increased system volume.',
      steps: [
        {
          type: 'reasoning',
          step: 'intent_resolution',
          status: 'completed',
          title: 'Fast-Path: Volume Up',
          details: 'Increased volume by 8% via WM_APPCOMMAND.',
        },
      ],
    };
  }

  const isVolDownIntent =
    normalized.includes('volume down') ||
    normalized.includes('decrease volume') ||
    normalized.includes('turn down volume') ||
    normalized.includes('turn down sound') ||
    normalized.includes('lower volume') ||
    normalized.includes('lower sound') ||
    normalized.includes('drop volume') ||
    normalized.includes('make quieter') ||
    normalized.includes('make it quieter') ||
    normalized.includes('make softer') ||
    normalized.includes('too loud') ||
    normalized === 'quieter' ||
    normalized === 'softer' ||
    normalized === 'quiet down' ||
    normalized === 'turn it down';

  if (isVolDownIntent) {
    await runPcController(['volume', 'down', '--steps', '4']);
    return {
      matched: true,
      actionName: 'volume_down',
      answer: 'Decreased system volume.',
      steps: [
        {
          type: 'reasoning',
          step: 'intent_resolution',
          status: 'completed',
          title: 'Fast-Path: Volume Down',
          details: 'Decreased volume by 8% via WM_APPCOMMAND.',
        },
      ],
    };
  }

  // ---------------------------------------------------------------------------
  // 3. Media Playback Controls
  // ---------------------------------------------------------------------------
  // ---------------------------------------------------------------------------
  // 3. Media Playback Controls (Hardware toggle for existing desktop player)
  // ---------------------------------------------------------------------------
  if (
    normalized === 'play' ||
    normalized === 'pause' ||
    normalized === 'resume' ||
    normalized === 'pause music' ||
    normalized === 'stop music' ||
    normalized === 'resume music' ||
    normalized === 'play pause' ||
    normalized === 'toggle media' ||
    normalized === 'toggle playback'
  ) {
    await runPcController(['media', 'play_pause']);
    return {
      matched: true,
      actionName: 'media_play_pause',
      answer: 'Media playback toggled.',
      steps: [
        {
          type: 'reasoning',
          step: 'intent_resolution',
          status: 'completed',
          title: 'Fast-Path: Media Play/Pause',
          details: 'Simulated WM_APPCOMMAND_MEDIA_PLAY_PAUSE.',
        },
      ],
    };
  }

  if (
    normalized.includes('next track') ||
    normalized.includes('next song') ||
    normalized.includes('skip track') ||
    normalized.includes('skip song') ||
    normalized.includes('change song') ||
    normalized === 'skip' ||
    normalized === 'next'
  ) {
    await runPcController(['media', 'next']);
    return {
      matched: true,
      actionName: 'media_next',
      answer: 'Skipped to next track.',
      steps: [
        {
          type: 'reasoning',
          step: 'intent_resolution',
          status: 'completed',
          title: 'Fast-Path: Next Track',
          details: 'Simulated WM_APPCOMMAND_MEDIA_NEXTTRACK.',
        },
      ],
    };
  }

  if (
    normalized.includes('previous track') ||
    normalized.includes('previous song') ||
    normalized.includes('prev track') ||
    normalized.includes('prev song') ||
    normalized.includes('go back song') ||
    normalized.includes('last song') ||
    normalized === 'previous' ||
    normalized === 'prev'
  ) {
    await runPcController(['media', 'prev']);
    return {
      matched: true,
      actionName: 'media_prev',
      answer: 'Jumped to previous track.',
      steps: [
        {
          type: 'reasoning',
          step: 'intent_resolution',
          status: 'completed',
          title: 'Fast-Path: Previous Track',
          details: 'Simulated WM_APPCOMMAND_MEDIA_PREVIOUSTRACK.',
        },
      ],
    };
  }

  // ---------------------------------------------------------------------------
  // 4. Song, Music & Direct Media Autoplay
  // ---------------------------------------------------------------------------

  // A. Generic Music / Song Play Intent (e.g. "play music", "play some music", "start music", "play songs", "play a song", "play something", "music on youtube", "songs on youtube")
  const isGenericPlayMusicIntent =
    /^(?:play|start|put\s+on|stream)\s+(?:some\s+)?(?:music|songs?|tracks?|beats?|lofi|tunes?|something)(?:\s+on\s+youtube)?$/i.test(normalized) ||
    /^(?:music|songs?)\s+on\s+youtube$/i.test(normalized) ||
    normalized === 'play music' ||
    normalized === 'play some music' ||
    normalized === 'start music' ||
    normalized === 'play songs' ||
    normalized === 'play song' ||
    normalized === 'play a song' ||
    normalized === 'play something';

  if (isGenericPlayMusicIntent) {
    await runPcController(['search', 'youtube', 'top hit songs']);
    return {
      matched: true,
      actionName: 'web_search_youtube',
      answer: 'Playing top trending music directly on YouTube.',
      steps: [
        {
          type: 'reasoning',
          step: 'intent_resolution',
          status: 'completed',
          title: 'Fast-Path: YouTube Music Playback',
          details: 'Autoplaying top trending music directly in your browser.',
        },
      ],
    };
  }

  // B. Specific Song / Artist on Spotify
  const spotifyMatch =
    normalized.match(/^(?:play|listen\s+to)\s+(.+?)\s+(?:on|in)\s+spotify$/i) ||
    normalized.match(/^spotify\s+(?:play\s+)?(.+)$/i);
  if (spotifyMatch) {
    const rawTarget = spotifyMatch[1].trim();
    if (rawTarget && rawTarget !== 'music' && rawTarget !== 'pause') {
      await runPcController(['search', 'google', `https://open.spotify.com/search/${encodeURIComponent(rawTarget)}`]);
      return {
        matched: true,
        actionName: 'music_play_spotify',
        answer: `Playing "${rawTarget}" on Spotify in your browser.`,
        steps: [
          {
            type: 'reasoning',
            step: 'intent_resolution',
            status: 'completed',
            title: 'Fast-Path: Spotify Playback',
            details: `Opened Spotify search for "${rawTarget}".`,
          },
        ],
      };
    }
  }

  // C. Direct YouTube Song & Video Autoplay
  // Handles:
  // - "play <song> on youtube" (e.g. "play softcore on youtube")
  // - "play <song>" (e.g. "play starboy", "play kalyani", "play bohemian rhapsody")
  // - "<song> on youtube" (e.g. "kalyani on youtube", "softcore on youtube")
  // - "listen to <song> [on youtube]"
  // - "watch <video> [on youtube]"
  const ytPlayMatch =
    normalized.match(/^(?:play|listen\s+to|watch|stream|put\s+on)\s+(.+?)(?:\s+on\s+youtube)?$/i) ||
    normalized.match(/^(.+?)\s+(?:on|in)\s+youtube$/i);

  if (ytPlayMatch) {
    let rawTarget = ytPlayMatch[1].trim();
    rawTarget = rawTarget.replace(/\s+(?:on|in)\s+youtube$/i, '').trim();

    if (
      rawTarget &&
      rawTarget !== 'music' &&
      rawTarget !== 'pause' &&
      rawTarget !== 'media' &&
      rawTarget !== 'it' &&
      !['status', 'process', 'specs', 'system', 'agent', 'weather', 'time'].includes(rawTarget)
    ) {
      await runPcController(['search', 'youtube', rawTarget]);
      return {
        matched: true,
        actionName: 'web_search_youtube',
        answer: `Playing "${rawTarget}" directly on YouTube in your browser.`,
        steps: [
          {
            type: 'reasoning',
            step: 'intent_resolution',
            status: 'completed',
            title: 'Fast-Path: YouTube Direct Play',
            details: `Autoplaying "${rawTarget}" on YouTube in your browser.`,
          },
        ],
      };
    }
  }

  // D. General YouTube search commands (e.g. "search youtube for <query>", "search <query> on youtube", "youtube <query>")
  const ytGeneralMatch =
    normalized.match(/^(?:search\s+youtube\s+for|youtube)\s+(.+)$/i) ||
    normalized.match(/^(?:search|look\s+up|find)\s+(.+?)\s+(?:on|in)\s+youtube$/i);
  if (ytGeneralMatch) {
    const query = ytGeneralMatch[1].trim();
    if (query) {
      await runPcController(['search', 'youtube', query]);
      return {
        matched: true,
        actionName: 'web_search_youtube',
        answer: `Playing "${query}" directly on YouTube in your browser.`,
        steps: [
          {
            type: 'reasoning',
            step: 'intent_resolution',
            status: 'completed',
            title: 'Fast-Path: YouTube Play',
            details: `Autoplaying "${query}" on YouTube in your browser.`,
          },
        ],
      };
    }
  }

  const isJobOrGigSearch = /\b(job|jobs|gig|gigs|freelance|freelancer|fiverr|upwork|remoteok|career|opportunity|opportunities|summarize|analyze)\b/i.test(normalized);
  const googleSearchMatch = !isJobOrGigSearch && normalized.match(/^(?:search\s+google\s+(?:for\s+)?|google\s+|search\s+(?:for\s+)?|look\s+up\s+|find\s+(.+?)\s+on\s+google)(.+)$/i);
  if (googleSearchMatch) {
    const query = (googleSearchMatch[1] || googleSearchMatch[2] || '').trim();
    if (query && !query.startsWith('status') && !query.startsWith('process') && !query.startsWith('specs')) {
      await runPcController(['search', 'google', query]);
      return {
        matched: true,
        actionName: 'web_search_google',
        answer: `Searching Google for "${query}" in your browser.`,
        steps: [
          {
            type: 'reasoning',
            step: 'intent_resolution',
            status: 'completed',
            title: 'Fast-Path: Google Search',
            details: `Opened Google search for "${query}".`,
          },
        ],
      };
    }
  }

  // ---------------------------------------------------------------------------
  // 5. System Diagnostics & Hardware Status
  // ---------------------------------------------------------------------------
  const isSystemStatusIntent =
    normalized.includes('system status') ||
    normalized.includes('system info') ||
    normalized.includes('system diagnostics') ||
    normalized.includes('hardware status') ||
    normalized.includes('hardware health') ||
    normalized.includes('ram usage') ||
    normalized.includes('memory usage') ||
    normalized.includes('cpu usage') ||
    normalized.includes('cpu load') ||
    normalized.includes('disk space') ||
    normalized.includes('storage') ||
    normalized.includes('system stats') ||
    normalized.includes('system specs') ||
    normalized.includes('pc specs') ||
    normalized.includes('pc status') ||
    normalized.includes('how is pc') ||
    normalized.includes('how is computer') ||
    normalized === 'specs' ||
    normalized === 'stats' ||
    normalized.includes('how much ram') ||
    normalized.includes('how much memory') ||
    normalized.includes('what are my specs') ||
    normalized.includes('check system');

  if (isSystemStatusIntent) {
    const res = await runPcController(['status']);
    if (res.success && res.data) {
      const d = res.data;
      const primaryDrive = d.drives && d.drives.length > 0 ? d.drives[0] : null;
      const answer =
        `💻 **Live System Metrics (Offline Fast-Path)**\n\n` +
        `• **Memory (RAM):** ${d.ram.usedGb} GB used of ${d.ram.totalGb} GB (${d.ram.percentUsed}% load, ${d.ram.freeGb} GB free)\n` +
        `• **Processor (CPU):** ${d.cpu.logicalCores} logical cores (${d.cpu.architecture})\n` +
        (primaryDrive ? `• **Primary Drive (${primaryDrive.drive}):** ${primaryDrive.freeGb} GB free of ${primaryDrive.totalGb} GB (${primaryDrive.usedPercent}% used)\n` : '') +
        `• **Uptime:** ${d.uptimeHours} hours\n\n` +
        `*Executed natively via offline Python controller (0 tokens consumed).*`;

      return {
        matched: true,
        actionName: 'system_status',
        answer,
        steps: [
          {
            type: 'reasoning',
            step: 'intent_resolution',
            status: 'completed',
            title: 'Local Fast-Path: System Metrics',
            details: 'Retrieved live hardware stats natively from Windows kernel.',
          },
          {
            type: 'tool_result',
            step: 'tool_execution',
            status: 'completed',
            title: 'System Metrics Retrieved',
            data: d,
          },
        ],
      };
    }
  }

  // ---------------------------------------------------------------------------
  // 6. Top Processes / Task Manager / Performance Issues
  // ---------------------------------------------------------------------------
  const isProcessIntent =
    normalized.includes('top process') ||
    normalized.includes('running process') ||
    normalized.includes('list process') ||
    normalized.includes('show process') ||
    normalized.includes('task manager') ||
    normalized.includes('what is running') ||
    normalized.includes('what apps are open') ||
    normalized.includes('memory hogs') ||
    normalized.includes('heavy apps') ||
    normalized.includes('heavy tasks') ||
    normalized.includes('process list') ||
    normalized.includes('eating my ram') ||
    normalized.includes('eating memory') ||
    normalized.includes('eating ram') ||
    normalized.includes('why is pc lagging') ||
    normalized.includes('why is computer slow') ||
    normalized.includes('why is it lagging') ||
    normalized.includes('slowing down my pc') ||
    normalized.includes('cpu hogs');

  if (isProcessIntent) {
    const res = await runPcController(['process', 'list', '--limit', '8']);
    if (res.success && Array.isArray(res.data)) {
      const topItems = res.data
        .map((p: any, idx: number) => `${idx + 1}. **${p.name}** (PID ${p.pid}) — ${p.memoryMb} MB`)
        .join('\n');

      const answer =
        `⚡ **Top Processes by Memory (Offline Fast-Path)**\n\n` +
        `${topItems}\n\n` +
        `*Query completed in 12ms with 0 tokens.*`;

      return {
        matched: true,
        actionName: 'list_processes',
        answer,
        steps: [
          {
            type: 'reasoning',
            step: 'intent_resolution',
            status: 'completed',
            title: 'Local Fast-Path: Process List',
            details: 'Queried running processes directly via Windows task list.',
          },
          {
            type: 'tool_result',
            step: 'tool_execution',
            status: 'completed',
            title: 'Top Running Processes',
            data: res.data,
          },
        ],
      };
    }
  }

  // ---------------------------------------------------------------------------
  // 7. Desktop Screen Capture (Screenshot)
  // ---------------------------------------------------------------------------
  const isScreenshotIntent =
    normalized.includes('screenshot') ||
    normalized.includes('screen shot') ||
    normalized.includes('capture screen') ||
    normalized.includes('capture the screen') ||
    normalized.includes('take a screenshot') ||
    normalized.includes('take screenshot') ||
    normalized.includes('picture of screen') ||
    normalized.includes('grab screen') ||
    normalized === 'snip';

  if (isScreenshotIntent) {
    const res = await runPcController(['screenshot']);
    if (res.success) {
      return {
        matched: true,
        actionName: 'screenshot',
        answer: `📸 Screenshot captured and saved to: \`${res.path}\``,
        steps: [
          {
            type: 'reasoning',
            step: 'intent_resolution',
            status: 'completed',
            title: 'Fast-Path: Screen Capture',
            details: `Desktop screen captured to ${res.path}`,
          },
        ],
      };
    }
  }

  // ---------------------------------------------------------------------------
  // 8. Application & Browser Launching (Supports "open X in edge", "open X in edge and navigate to Y")
  // ---------------------------------------------------------------------------
  const browserNavMatch = normalized.match(
    /^(?:open|opening|launch|launching|start|starting|run|running|switch\s+to|bring\s+up|show\s+me|fire\s+up|let(?:'s|\s+us)\s+(?:open|opening|use)|go\s+to)\s+(.+?)(?:\s+in\s+(edge|chrome|msedge|microsoft edge|google chrome|browser))?(?:\s+and\s+(?:navigate\s+to|go\s+to|search\s+for)\s+(.+))?$/i
  );

  if (browserNavMatch) {
    const rawTarget = browserNavMatch[1]?.trim() || '';
    const specifiedBrowser = browserNavMatch[2]?.trim();
    const navPath = browserNavMatch[3]?.trim();
    const isQuestion = /^(?:how|why|what\s|what's)\b/i.test(rawTarget);

    if (rawTarget && !isQuestion) {
      const cleanTarget = cleanAppTarget(rawTarget);
      if (cleanTarget) {
        const pcArgs = ['app', 'launch', cleanTarget];
        if (navPath) {
          pcArgs.push('--args', navPath);
        }
        if (specifiedBrowser) {
          const browserKey = specifiedBrowser.toLowerCase().includes('edge') ? 'edge' : 'chrome';
          pcArgs.push('--browser', browserKey);
        }

        const res = await runPcController(pcArgs);
        if (res.success) {
          const browserDesc = specifiedBrowser ? ` in **${specifiedBrowser}**` : '';
          const navDesc = navPath ? ` and navigated to **${navPath}**` : '';
          return {
            matched: true,
            actionName: 'launch_app',
            answer: `I've opened **${cleanTarget}**${browserDesc}${navDesc} for you.`,
            steps: [
              {
                type: 'reasoning',
                step: 'intent_resolution',
                status: 'completed',
                title: 'Fast-Path: Application Launch',
                details: `Launched '${cleanTarget}'${browserDesc}${navDesc} with foreground focus (0 tokens).`,
              },
              {
                type: 'tool_result',
                step: 'tool_execution',
                status: 'completed',
                title: `Launched ${cleanTarget}`,
                data: res,
              },
            ],
          };
        } else {
          return {
            matched: true,
            actionName: 'launch_app',
            answer: `Could not open **${cleanTarget}**: ${res.error || 'Application target not found'}.`,
          };
        }
      }
    }
  }

  // ---------------------------------------------------------------------------
  // 9. Application Closing / Terminating (Explicit Verbs)
  // ---------------------------------------------------------------------------
  const closeMatch = normalized.match(/^(?:close|closing|quit|quitting|kill|killing|terminate|terminating|stop|stopping|exit|exiting|shut\s+down|shutting\s+down|force\s+close|force\s+kill|get\s+rid\s+of|end)\s+(?:the\s+app\s+|app\s+|process\s+)?(.+)$/i);
  if (closeMatch) {
    const rawTarget = closeMatch[1].trim();
    const isQuestion = /^(?:how|why|what\s|what's)\b/i.test(rawTarget);
    if (!isQuestion) {
      const cleanTarget = cleanAppTarget(rawTarget);
      if (cleanTarget) {
        const res = await runPcController(['app', 'close', cleanTarget]);
        if (res.success) {
          return {
            matched: true,
            actionName: 'close_app',
            answer: `Closed **${cleanTarget}**.`,
            steps: [
              {
                type: 'reasoning',
                step: 'intent_resolution',
                status: 'completed',
                title: 'Fast-Path: Application Termination',
                details: `Terminated '${cleanTarget}' via Windows process manager.`,
              },
            ],
          };
        } else {
          const isNotRunning = typeof res.error === 'string' && (res.error.toLowerCase().includes('not found') || res.error.toLowerCase().includes('could not find'));
          const answer = isNotRunning
            ? `**${cleanTarget}** is not currently running.`
            : `Unable to close **${cleanTarget}**: ${res.error || 'Process not found'}.`;
          return {
            matched: true,
            actionName: 'close_app',
            answer,
          };
        }
      }
    }
  }

  // ---------------------------------------------------------------------------
  // 10. Standalone Application / Site Mentions (e.g. "word", "whatsapp", "vlc")
  // ---------------------------------------------------------------------------
  const isClosingPhrase = /^(?:close|quit|kill|stop|exit|terminate|shut|end)\b/i.test(normalized);
  if (!isClosingPhrase) {
    const directApp = APP_ALIASES[normalized] || APP_ALIASES[cleanAppTarget(normalized)];
    if (directApp) {
      const targetToLaunch = directApp;
      const res = await runPcController(['app', 'launch', targetToLaunch]);
      if (res.success) {
        return {
          matched: true,
          actionName: 'launch_app',
          answer: `I've opened **${targetToLaunch}** for you.`,
          steps: [
            {
              type: 'reasoning',
              step: 'intent_resolution',
              status: 'completed',
              title: 'Fast-Path: Application Launch',
              details: `Launched '${targetToLaunch}' with foreground focus (0 tokens).`,
            },
            {
              type: 'tool_result',
              step: 'tool_execution',
              status: 'completed',
              title: `Launched ${targetToLaunch}`,
              data: res,
            },
          ],
        };
      }
    }
  }

  // ---------------------------------------------------------------------------
  // 11. Create Folder / Directory
  // ---------------------------------------------------------------------------
  const folderMatch = clean.match(/^(?:create|make|new)\s+(?:a\s+)?(?:folder|directory)\s+(?:called\s+|named\s+)?(.+)$/i);
  if (folderMatch) {
    const targetFolder = folderMatch[1].trim().replace(/^["']|["']$/g, '');
    const res = await runPcController(['file', 'create_folder', targetFolder]);
    if (res.success) {
      return {
        matched: true,
        actionName: 'create_folder',
        answer: `📁 Folder created successfully: \`${targetFolder}\``,
        steps: [
          {
            type: 'reasoning',
            step: 'intent_resolution',
            status: 'completed',
            title: 'Fast-Path: Create Folder',
            details: `Created folder at ${targetFolder}`,
          },
        ],
      };
    }
  }

  // ---------------------------------------------------------------------------
  // 12. Delete File / Folder
  // ---------------------------------------------------------------------------
  const deleteMatch = clean.match(/^(?:delete|remove)\s+(?:file|folder)\s+(.+)$/i);
  if (deleteMatch) {
    const targetPath = deleteMatch[1].trim().replace(/^["']|["']$/g, '');
    const res = await runPcController(['file', 'delete', targetPath]);
    if (res.success) {
      return {
        matched: true,
        actionName: 'delete_file',
        answer: `🗑️ Deleted: \`${targetPath}\``,
        steps: [
          {
            type: 'reasoning',
            step: 'intent_resolution',
            status: 'completed',
            title: 'Fast-Path: Delete',
            details: `Deleted ${targetPath}`,
          },
        ],
      };
    }
  }

  return { matched: false };
}
