import { SaveSystem, type SaveData } from "./SaveSystem";
import { PASTURE_MUSIC } from "../data/musicAssets";

export type AudioCue = "jump" | "land" | "starCollect" | "starGroup" | "nearMiss" | "hit" | "dash" | "powerUp" | "combo" | "gameOver" | "newRecord" | "button" | "bell";
export type AudioChannel = "music" | "sfx";

type CueDefinition = { frequency: number; duration: number; wave: OscillatorType;
  peakGain?: number; notes?: readonly { frequency: number; offsetSeconds: number }[] };

const CUES: Record<AudioCue, CueDefinition> = {
  jump: { frequency: 520, duration: 0.09, wave: "sine" },
  land: { frequency: 180, duration: 0.07, wave: "triangle" },
  starCollect: { frequency: 880, duration: 0.12, wave: "sine" },
  starGroup: { frequency: 660, duration: 0.24, wave: "sine", peakGain: 0.04,
    notes: [{ frequency: 880, offsetSeconds: 0.07 }, { frequency: 1108, offsetSeconds: 0.14 }] },
  nearMiss: { frequency: 660, duration: 0.16, wave: "triangle" },
  hit: { frequency: 120, duration: 0.18, wave: "sawtooth" },
  dash: { frequency: 330, duration: 0.12, wave: "triangle" },
  powerUp: { frequency: 740, duration: 0.2, wave: "sine" },
  combo: { frequency: 990, duration: 0.2, wave: "sine" },
  gameOver: { frequency: 146, duration: 0.28, wave: "triangle" },
  newRecord: { frequency: 1046, duration: 0.3, wave: "sine" },
  button: { frequency: 420, duration: 0.05, wave: "sine" },
  bell: { frequency: 1568, duration: 0.22, wave: "sine" },
};

export class AudioSystem {
  private context: AudioContext | null = null;
  private musicGain: GainNode | null = null;
  private musicBuffer: AudioBuffer | null = null;
  private musicSource: AudioBufferSourceNode | null = null;
  private musicLoading: Promise<void> | null = null;
  private musicAbort: AbortController | null = null;
  private musicOffset = 0;
  private musicStartedAt = 0;
  private pageHidden = false;
  private disposed = false;
  private settings: SaveData["settings"] = SaveSystem.load().settings;

  initializeAfterGesture(): boolean {
    if (this.disposed || document.hidden || this.pageHidden) return false;
    if (this.context) {
      if (this.context.state === "suspended") void this.context.resume().catch(() => undefined);
      this.startMusic();
      return true;
    }

    const Context = window.AudioContext;
    if (!Context) return false;
    try {
      this.context = new Context();
      this.musicGain = this.context.createGain();
      this.musicGain.connect(this.context.destination);
      this.applyMusicSettings();
      document.addEventListener("visibilitychange", this.visibility);
      window.addEventListener("pagehide", this.pageHide);
      window.addEventListener("pageshow", this.pageShow);
      this.startMusic();
      void this.context.resume().catch(() => undefined);
      return true;
    } catch {
      void this.context?.close().catch(() => undefined);
      this.context = null;
      this.musicGain = null;
      return false;
    }
  }

  play(cue: AudioCue): void {
    if (!this.context || document.hidden || this.pageHidden || !this.settings.sfx || this.settings.sfxVolume <= 0) return;
    const definition = CUES[cue];
    const now = this.context.currentTime;
    const oscillator = this.context.createOscillator();
    const envelope = this.context.createGain();
    oscillator.type = definition.wave;
    oscillator.frequency.setValueAtTime(definition.frequency, now);
    for (const note of definition.notes ?? []) oscillator.frequency.setValueAtTime(note.frequency, now + note.offsetSeconds);
    envelope.gain.setValueAtTime(Math.max(0.0001, this.settings.sfxVolume * (definition.peakGain ?? 0.055)), now);
    envelope.gain.exponentialRampToValueAtTime(0.0001, now + definition.duration);
    oscillator.connect(envelope);
    envelope.connect(this.context.destination);
    oscillator.start(now);
    oscillator.stop(now + definition.duration);
  }

  toggleMusic(): boolean {
    this.settings = SaveSystem.updateSettings({ music: !this.settings.music }).settings;
    this.applyMusicSettings();
    return this.settings.music;
  }

  toggleSfx(): boolean {
    this.settings = SaveSystem.updateSettings({ sfx: !this.settings.sfx }).settings;
    return this.settings.sfx;
  }

  adjustVolume(channel: AudioChannel, direction: -1 | 1): number {
    const key = channel === "music" ? "musicVolume" : "sfxVolume";
    const volume = Math.round(Math.max(0, Math.min(1, this.settings[key] + direction * 0.1)) * 10) / 10;
    this.settings = SaveSystem.updateSettings({ [key]: volume }).settings;
    this.applyMusicSettings();
    return volume;
  }

  get currentSettings(): SaveData["settings"] {
    return { ...this.settings };
  }

  destroy(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.musicAbort?.abort();
    this.stopMusic();
    this.musicGain?.disconnect();
    document.removeEventListener("visibilitychange", this.visibility);
    window.removeEventListener("pagehide", this.pageHide);
    window.removeEventListener("pageshow", this.pageShow);
    void this.context?.close().catch(() => undefined);
    this.context = null; this.musicGain = null; this.musicBuffer = null;
  }

  private readonly visibility = (): void => {
    if (document.hidden) this.suspend();
    else this.initializeAfterGesture();
  };
  private readonly pageHide = (): void => { this.pageHidden = true; this.suspend(); };
  private readonly pageShow = (): void => { this.pageHidden = false; this.initializeAfterGesture(); };
  private suspend(): void {
    this.stopMusic();
    if (this.context?.state === "running") void this.context.suspend().catch(() => undefined);
  }

  private applyMusicSettings(): void {
    if (this.musicGain) this.musicGain.gain.value = this.settings.music ? this.settings.musicVolume * PASTURE_MUSIC.volume : 0;
    if (this.settings.music && this.settings.musicVolume > 0) this.startMusic();
    else this.stopMusic();
  }

  private startMusic(): void {
    if (!this.context || !this.musicGain || this.musicSource || this.disposed || document.hidden || this.pageHidden || !this.settings.music || this.settings.musicVolume <= 0) return;
    if (!this.musicBuffer) { this.loadMusic(); return; }
    const source = this.context.createBufferSource();
    source.buffer = this.musicBuffer;
    source.loop = true;
    source.connect(this.musicGain);
    source.onended = () => {
      source.disconnect();
      if (this.musicSource === source) this.musicSource = null;
    };
    source.start(0, this.musicOffset);
    this.musicStartedAt = this.context.currentTime;
    this.musicSource = source;
  }

  private loadMusic(): void {
    if (!this.context || this.musicLoading) return;
    const context = this.context, abort = new AbortController();
    this.musicAbort = abort;
    const load = async (): Promise<void> => {
      const response = await fetch(PASTURE_MUSIC.url, { signal: abort.signal });
      if (!response.ok) throw new Error("Local background music unavailable");
      const bytes = await response.arrayBuffer();
      if (this.disposed || this.context !== context) return;
      const buffer = await context.decodeAudioData(bytes);
      if (this.disposed || this.context !== context) return;
      this.musicBuffer = buffer;
      this.startMusic();
    };
    const loading = load().catch(() => undefined).finally(() => {
      if (this.musicLoading === loading) { this.musicLoading = null; this.musicAbort = null; }
    });
    this.musicLoading = loading;
  }

  private stopMusic(): void {
    const source = this.musicSource;
    if (!source) return;
    if (this.context && this.musicBuffer) {
      this.musicOffset = (this.musicOffset + Math.max(0, this.context.currentTime - this.musicStartedAt)) % this.musicBuffer.duration;
    }
    this.musicSource = null;
    source.onended = null;
    source.stop(); source.disconnect();
  }
}
