//#region Type Def
export type SoundPreference = 'unmute' | 'mute';

export type SoundPresets =
  | 'sound-toggle-on'
  | 'woosh'
  | 'pop'
  | 'light-switch'
  | 'button-click'
  | 'button-hover'
  | 'link-button-hover'
  | 'tap'
  | 'drop'
  | 'envelope-open'
  | 'page-change'
  | 'close-window'
  | 'open-window';
//#endregion

//#region Constant Keys
const MUTE_CLASSNAME = 'mute-audio';

const SOUND_KEY = 'sound';
//#endregion

//#region Audio Constants
// CTX
const audioContext = new (
  window.AudioContext || (window as any).webkitAudioContext
)();

// OTHER
const SOUND_TOGGLE_ON = bufferSoundEffect('../assets/sfx/sound-toggle-on.ogg');
const WOOSH_SFX = bufferSoundEffect('../assets/sfx/woosh.ogg');
const POP_SFX = bufferSoundEffect('../assets/sfx/pop.ogg');
const LIGHT_SWITCH_SFX = bufferSoundEffect('../assets/sfx/light-switch.ogg');

// BUTTON
const BUTTON_CLICK_SFX = bufferSoundEffect('../assets/sfx/button-click.ogg');
const BUTTON_HOVER_SFX = bufferSoundEffect('../assets/sfx/button-hover.ogg');
const LINK_BUTTON_HOVER_SFX = bufferSoundEffect(
  '../assets/sfx/link-button-hover.ogg'
);

// OBJECT
const TAP_SFX = bufferSoundEffect('../assets/sfx/tap.ogg');
const DROP_SFX = bufferSoundEffect('../assets/sfx/drop.ogg');

// DESKTOP
const DESKTOP_ENVELOPE_OPEN_SFX = bufferSoundEffect(
  '../assets/sfx/desktop-envelope-open.ogg'
);
const DESKTOP_PAGE_CHANGE_SFX = bufferSoundEffect(
  '../assets/sfx/desktop-page-change.ogg'
);

// MOBILE
const MOBILE_OPEN_WINDOW_SFX = bufferSoundEffect(
  '../assets/sfx/mobile-open-window.ogg'
);
const MOBILE_CLOSE_WINDOW_SFX = bufferSoundEffect(
  '../assets/sfx/mobile-close-window.ogg'
);
//#endregion

//#region Public Variables
let isUnmuted: boolean = true;
//#endregion

//#region Listeners
document.addEventListener('pointerdown', () => {
  playPresetSFX('tap');
});
//#endregion

//#region Audio Methods
async function bufferSoundEffect(url: string): Promise<AudioBuffer | null> {
  try {
    const response = await fetch(url);
    const arrayBuffer = await response.arrayBuffer();
    return await audioContext.decodeAudioData(arrayBuffer);
  } catch (error) {
    console.error('Error buffering sound:', error);
  }
  return null;
}

async function playSoundEffectRandomBuffer(
  buffer: Promise<AudioBuffer | null>,
  minPitch: number,
  maxPitch: number,
  targetVolume: number = 1.0
): Promise<void> {
  await playSoundEffectBuffer(
    buffer,
    Math.random() * (maxPitch - minPitch) + minPitch,
    targetVolume
  );
}
async function playSoundEffectBuffer(
  buffer: Promise<AudioBuffer | null>,
  targetPitch: number,
  targetVolume: number
): Promise<void> {
  const audioBuffer = await buffer;
  if (audioBuffer === null) {
    return;
  }

  const sourceNode = audioContext.createBufferSource();
  const gainNode = audioContext.createGain();

  sourceNode.buffer = audioBuffer;
  sourceNode.playbackRate.value = targetPitch;
  gainNode.gain.value = targetVolume;

  sourceNode.connect(gainNode);
  gainNode.connect(audioContext.destination);

  sourceNode.start(0);
}

export function playPresetSFX(soundType: SoundPresets): void {
  if (!isUnmuted) {
    return;
  }

  switch (soundType) {
    case 'sound-toggle-on':
      playSoundEffectRandomBuffer(SOUND_TOGGLE_ON, 0.8, 0.8, 1);
      break;
    case 'woosh':
      playSoundEffectRandomBuffer(WOOSH_SFX, 0.9, 1.1, 0.5);
      break;
    case 'pop':
      playSoundEffectRandomBuffer(POP_SFX, 0.8, 1.2, 0.45);
      break;
    case 'light-switch':
      playSoundEffectRandomBuffer(LIGHT_SWITCH_SFX, 0.9, 1.1, 0.85);
      break;
    case 'button-click':
      playSoundEffectRandomBuffer(BUTTON_CLICK_SFX, 0.8, 1.2, 0.7);
      break;
    case 'button-hover':
      playSoundEffectRandomBuffer(BUTTON_HOVER_SFX, 0.9, 1.1, 0.85);
      break;
    case 'link-button-hover':
      playSoundEffectRandomBuffer(LINK_BUTTON_HOVER_SFX, 0.9, 1.1, 0.85);
      break;
    case 'tap':
      playSoundEffectRandomBuffer(TAP_SFX, 0.7, 1.3, 0.7);
      break;
    case 'drop':
      playSoundEffectRandomBuffer(DROP_SFX, 0.8, 1.2, 0.45);
      break;
    case 'envelope-open':
      playSoundEffectRandomBuffer(DESKTOP_ENVELOPE_OPEN_SFX, 0.9, 1.1, 0.4);
      break;
    case 'page-change':
      playSoundEffectRandomBuffer(DESKTOP_PAGE_CHANGE_SFX, 0.9, 1.1, 1);
      break;
    case 'open-window':
      playSoundEffectRandomBuffer(MOBILE_OPEN_WINDOW_SFX, 1, 1, 1);
      break;
    case 'close-window':
      playSoundEffectRandomBuffer(MOBILE_CLOSE_WINDOW_SFX, 1, 1, 1);
      break;
  }
}
export async function playSoundEffectRandom(
  soundType: SoundPresets,
  minPitch: number = 1.0,
  maxPitch: number = 1.0,
  targetVolume: number = 1.0
): Promise<void> {
  await playSoundEffect(
    soundType,
    Math.random() * (maxPitch - minPitch) + minPitch,
    targetVolume
  );
}
export async function playSoundEffect(
  soundType: SoundPresets,
  targetPitch: number = 1.0,
  targetVolume: number = 1.0
): Promise<void> {
  if (!isUnmuted) {
    return;
  }

  switch (soundType) {
    case 'sound-toggle-on':
      playSoundEffectBuffer(SOUND_TOGGLE_ON, targetPitch, targetVolume);
      break;
    case 'woosh':
      playSoundEffectBuffer(WOOSH_SFX, targetPitch, targetVolume);
      break;
    case 'pop':
      playSoundEffectBuffer(POP_SFX, targetPitch, targetVolume);
      break;
    case 'light-switch':
      playSoundEffectBuffer(LIGHT_SWITCH_SFX, targetPitch, targetVolume);
      break;
    case 'button-click':
      playSoundEffectBuffer(BUTTON_CLICK_SFX, targetPitch, targetVolume);
      break;
    case 'button-hover':
      playSoundEffectBuffer(BUTTON_HOVER_SFX, targetPitch, targetVolume);
      break;
    case 'link-button-hover':
      playSoundEffectRandomBuffer(
        LINK_BUTTON_HOVER_SFX,
        targetPitch,
        targetVolume
      );
      break;
    case 'tap':
      playSoundEffectBuffer(TAP_SFX, targetPitch, targetVolume);
      break;
    case 'drop':
      playSoundEffectBuffer(DROP_SFX, targetPitch, targetVolume);
      break;
    case 'envelope-open':
      playSoundEffectBuffer(
        DESKTOP_ENVELOPE_OPEN_SFX,
        targetPitch,
        targetVolume
      );
      break;
    case 'page-change':
      playSoundEffectBuffer(DESKTOP_PAGE_CHANGE_SFX, targetPitch, targetVolume);
      break;
    case 'open-window':
      playSoundEffectBuffer(MOBILE_OPEN_WINDOW_SFX, targetPitch, targetVolume);
      break;
    case 'close-window':
      playSoundEffectBuffer(MOBILE_CLOSE_WINDOW_SFX, targetPitch, targetVolume);
      break;
  }
}
//#endregion

//#region Export Methods
export function getSavedSound(): SoundPreference {
  const savedTheme = localStorage.getItem(SOUND_KEY);
  if (savedTheme === null) {
    return 'unmute';
  }
  return savedTheme as SoundPreference;
}

export function setSoundMode(theme: SoundPreference): void {
  toggleSoundMode(theme === 'unmute');
}
export function toggleSoundMode(toggle?: boolean): void {
  if (toggle === undefined) {
    const newTheme =
      localStorage.getItem(SOUND_KEY) === 'unmute' ? 'mute' : 'unmute';

    document.body.classList.toggle(MUTE_CLASSNAME);
    localStorage.setItem(SOUND_KEY, newTheme);

    isUnmuted = newTheme === 'unmute';
    return;
  }

  isUnmuted = toggle;

  if (toggle) {
    document.body.classList.remove(MUTE_CLASSNAME);
    localStorage.setItem(SOUND_KEY, 'unmute');
    return;
  }
  document.body.classList.add(MUTE_CLASSNAME);
  localStorage.setItem(SOUND_KEY, 'mute');
}
//#endregion

//#region Initialization
function initializeSoundMode(): void {
  setSoundMode('unmute');
}
initializeSoundMode();
//#endregion
