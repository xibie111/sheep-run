import { afterEach, describe, expect, it, vi } from "vitest";
import { STORAGE } from "../game/Constants";
import { AudioSystem, type AudioCue } from "./AudioSystem";
import { PASTURE_MUSIC } from "../data/musicAssets";

const settle = async () => { for (let index = 0; index < 8; index++) await Promise.resolve(); };

function installAudioEnvironment(initial: Record<string, string> = {}) {
  const values = new Map(Object.entries(initial));
  const oscillators: Array<{ start: ReturnType<typeof vi.fn>; stop: ReturnType<typeof vi.fn>; frequency: { setValueAtTime: ReturnType<typeof vi.fn> } }> = [];
  const contexts: FakeAudioContext[] = [];
  const sources: Array<{ buffer: unknown; loop: boolean; onended: (() => void) | null; start: ReturnType<typeof vi.fn>; stop: ReturnType<typeof vi.fn>; connect: ReturnType<typeof vi.fn>; disconnect: ReturnType<typeof vi.fn> }> = [];
  const documentListeners = new Map<string, () => void>(), windowListeners = new Map<string, () => void>();
  const doc = {
    hidden: false,
    addEventListener: vi.fn((name: string, listener: () => void) => documentListeners.set(name, listener)),
    removeEventListener: vi.fn((name: string) => documentListeners.delete(name)),
  };

  class FakeAudioContext {
    currentTime = 1;
    state = "suspended";
    destination = {};
    resume = vi.fn(async () => { this.state = "running"; });
    suspend = vi.fn(async () => { this.state = "suspended"; });
    close = vi.fn(async () => { this.state = "closed"; });
    decodeAudioData = vi.fn(async (_bytes: ArrayBuffer) => ({ duration: 74 }) as AudioBuffer);
    createGain = vi.fn(() => ({
      gain: { value: 0, setValueAtTime: vi.fn(), exponentialRampToValueAtTime: vi.fn() },
      connect: vi.fn(), disconnect: vi.fn(),
    }));
    createOscillator = vi.fn(() => {
      const oscillator = {
        type: "sine",
        frequency: { setValueAtTime: vi.fn() },
        connect: vi.fn(),
        start: vi.fn(),
        stop: vi.fn(),
      };
      oscillators.push(oscillator);
      return oscillator;
    });
    createBufferSource = vi.fn(() => {
      const source = { buffer: null as unknown, loop: false, onended: null as (() => void) | null, connect: vi.fn(), disconnect: vi.fn(), start: vi.fn(), stop: vi.fn() };
      sources.push(source); return source;
    });
    constructor() { contexts.push(this); }
  }

  vi.stubGlobal("window", {
    AudioContext: FakeAudioContext,
    addEventListener: vi.fn((name: string, listener: () => void) => windowListeners.set(name, listener)),
    removeEventListener: vi.fn((name: string) => windowListeners.delete(name)),
    localStorage: {
      getItem: vi.fn((key: string) => values.get(key) ?? null),
      setItem: vi.fn((key: string, value: string) => values.set(key, value)),
    },
  });
  vi.stubGlobal("document", doc);
  const fetchMusic = vi.fn(async (_url: string, _options: RequestInit) => ({ ok: true, arrayBuffer: async () => new ArrayBuffer(8) }));
  vi.stubGlobal("fetch", fetchMusic);
  return { values, oscillators, contexts, sources, fetchMusic, doc, documentListeners, windowListeners };
}

describe("AudioSystem", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("creates no audio context or download until a user gesture, then loops one decoded track", async () => {
    const { contexts, sources, fetchMusic, oscillators } = installAudioEnvironment();
    const audio = new AudioSystem();

    expect(contexts).toHaveLength(0);
    expect(fetchMusic).not.toHaveBeenCalled();
    expect(audio.initializeAfterGesture()).toBe(true);
    expect(contexts).toHaveLength(1);
    expect(contexts[0]!.resume).toHaveBeenCalledOnce();
    await settle();
    expect(fetchMusic).toHaveBeenCalledExactlyOnceWith(PASTURE_MUSIC.url, expect.objectContaining({ signal: expect.any(AbortSignal) }));
    expect(sources).toHaveLength(1);
    expect(sources[0]!.loop).toBe(true);
    expect(sources[0]!.buffer).toMatchObject({ duration: 74 });
    expect(sources[0]!.start).toHaveBeenCalledWith(0, 0);
    audio.initializeAfterGesture(); audio.initializeAfterGesture();
    expect(sources).toHaveLength(1);
    expect(oscillators).toHaveLength(0);
    audio.destroy();
  });

  it("plays generated event tones only when SFX is enabled", () => {
    const { oscillators } = installAudioEnvironment();
    const audio = new AudioSystem();
    audio.initializeAfterGesture();
    const before = oscillators.length;

    audio.play("starCollect");
    expect(oscillators.length).toBe(before + 1);
    expect(oscillators.at(-1)!.start).toHaveBeenCalledOnce();
    expect(oscillators.at(-1)!.stop).toHaveBeenCalledOnce();

    audio.toggleSfx();
    const mutedCount = oscillators.length;
    audio.play("hit");
    expect(oscillators).toHaveLength(mutedCount);
    audio.destroy();
  });

  it("honors saved music mute, loads when enabled and retains the playback position across toggles", async () => {
    const { fetchMusic, sources, contexts } = installAudioEnvironment({ [STORAGE.saveKey]: JSON.stringify({ version: 4, settings: { music: false } }) });
    const audio = new AudioSystem(); audio.initializeAfterGesture();
    expect(fetchMusic).not.toHaveBeenCalled();
    expect(audio.toggleMusic()).toBe(true);
    await settle();
    contexts[0]!.currentTime = 11;
    expect(audio.toggleMusic()).toBe(false);
    expect(sources[0]!.stop).toHaveBeenCalledOnce();
    expect(audio.toggleMusic()).toBe(true);
    expect(sources[1]!.start).toHaveBeenCalledWith(0, 10);
    expect(fetchMusic).toHaveBeenCalledOnce();
    audio.destroy();
  });

  it("does not start a late download after muting, but reuses it when music is enabled again", async () => {
    const { fetchMusic, sources } = installAudioEnvironment();
    let release!: (response: { ok: boolean; arrayBuffer: () => Promise<ArrayBuffer> }) => void;
    fetchMusic.mockImplementationOnce(() => new Promise(resolve => { release = resolve; }));
    const audio = new AudioSystem(); audio.initializeAfterGesture();
    audio.toggleMusic();
    release({ ok: true, arrayBuffer: async () => new ArrayBuffer(8) }); await settle();
    expect(sources).toHaveLength(0);
    audio.toggleMusic();
    expect(sources).toHaveLength(1);
    expect(fetchMusic).toHaveBeenCalledOnce();
    audio.destroy();
  });

  it("stops at zero music volume and starts from the cached track when volume is raised", async () => {
    const { contexts, sources } = installAudioEnvironment();
    const audio = new AudioSystem(); audio.initializeAfterGesture(); await settle();
    for (let step = 0; step < 10; step++) audio.adjustVolume("music", -1);
    expect(audio.currentSettings.musicVolume).toBe(0);
    expect(sources[0]!.stop).toHaveBeenCalledOnce();
    audio.adjustVolume("music", 1);
    expect(sources).toHaveLength(2);
    expect(contexts[0]!.createGain.mock.results[0]!.value.gain.value).toBeCloseTo(PASTURE_MUSIC.volume * .1);
    audio.destroy();
  });

  it("suspends in the background and resumes once at the saved position including page cache restores", async () => {
    const { contexts, sources, doc, documentListeners, windowListeners } = installAudioEnvironment();
    const audio = new AudioSystem(); audio.initializeAfterGesture(); await settle();
    contexts[0]!.currentTime = 8;
    doc.hidden = true; documentListeners.get("visibilitychange")!();
    expect(sources[0]!.stop).toHaveBeenCalledOnce();
    expect(contexts[0]!.suspend).toHaveBeenCalledOnce();
    expect(audio.initializeAfterGesture()).toBe(false);
    doc.hidden = false; documentListeners.get("visibilitychange")!();
    expect(sources[1]!.start).toHaveBeenCalledWith(0, 7);
    windowListeners.get("pagehide")!();
    expect(sources[1]!.stop).toHaveBeenCalledOnce();
    windowListeners.get("pageshow")!();
    expect(sources).toHaveLength(3);
    expect(sources[2]!.start).toHaveBeenCalledWith(0, 7);
    audio.destroy();
  });

  it("ignores completed decoding after destroy and releases its owned listeners/context", async () => {
    const { contexts, sources, fetchMusic, documentListeners, windowListeners } = installAudioEnvironment();
    const audio = new AudioSystem();
    audio.initializeAfterGesture();
    let decoded!: (buffer: AudioBuffer) => void;
    contexts[0]!.decodeAudioData.mockImplementationOnce(() => new Promise(resolve => { decoded = resolve; }));
    await settle();
    audio.destroy(); audio.destroy();
    decoded({ duration: 74 } as AudioBuffer); await settle();
    expect(sources).toHaveLength(0);
    expect(contexts[0]!.close).toHaveBeenCalledOnce();
    expect(fetchMusic.mock.calls[0]![1].signal!.aborted).toBe(true);
    expect(documentListeners.size + windowListeners.size).toBe(0);
    expect(audio.initializeAfterGesture()).toBe(false);
  });

  it("keeps SFX available if the music file fails and retries the track on a later touch", async () => {
    const { sources, fetchMusic, oscillators } = installAudioEnvironment();
    fetchMusic.mockResolvedValueOnce({ ok: false, arrayBuffer: async () => new ArrayBuffer(0) });
    const audio = new AudioSystem();
    audio.initializeAfterGesture(); await settle();
    expect(sources).toHaveLength(0);
    audio.play("jump"); expect(oscillators).toHaveLength(1);
    audio.initializeAfterGesture(); await settle();
    expect(fetchMusic).toHaveBeenCalledTimes(2);
    expect(sources).toHaveLength(1);
    audio.destroy();
  });

  it("persists mute and bounded volume controls for both audio channels", () => {
    const { values } = installAudioEnvironment();
    const audio = new AudioSystem();

    expect(audio.toggleMusic()).toBe(false);
    expect(audio.adjustVolume("music", -1)).toBe(0.9);
    expect(audio.adjustVolume("sfx", -1)).toBe(0.9);
    expect(audio.adjustVolume("sfx", 1)).toBe(1);
    expect(JSON.parse(values.get(STORAGE.saveKey)!).settings).toMatchObject({
      music: false,
      sfx: true,
      musicVolume: 0.9,
      sfxVolume: 1,
    });
  });

  it("covers the Phase 5 gameplay cue set", () => {
    const cues: AudioCue[] = ["jump", "land", "starCollect", "nearMiss", "hit", "dash", "powerUp", "combo", "gameOver", "newRecord", "button"];
    expect(new Set(cues).size).toBe(11);
  });

  it("plays one short bell envelope at the saved SFX volume and respects mute/zero volume", () => {
    const { oscillators, contexts } = installAudioEnvironment({ [STORAGE.saveKey]: JSON.stringify({ version: 4, settings: { music: false, sfxVolume: .4 } }) });
    const audio = new AudioSystem(); audio.initializeAfterGesture(); audio.play("bell");
    expect(oscillators).toHaveLength(1);
    expect(oscillators[0]!.frequency.setValueAtTime).toHaveBeenCalledWith(1568, 1);
    expect(oscillators[0]!.stop).toHaveBeenCalledExactlyOnceWith(1.22);
    expect(contexts[0]!.createGain.mock.results.at(-1)!.value.gain.setValueAtTime).toHaveBeenCalledWith(.4 * .055, 1);
    audio.toggleSfx(); audio.play("bell"); expect(oscillators).toHaveLength(1);
    audio.toggleSfx(); for (let step = 0; step < 4; step++) audio.adjustVolume("sfx", -1);
    audio.play("bell"); expect(oscillators).toHaveLength(1);
    audio.destroy();
  });

  it("schedules the completed-star-group ascending notes in one quiet short oscillator", () => {
    const { oscillators, contexts } = installAudioEnvironment({ [STORAGE.saveKey]: JSON.stringify({ version: 4, settings: { music: false, sfxVolume: .4 } }) });
    const audio = new AudioSystem(); audio.initializeAfterGesture(); audio.play("starGroup");
    expect(oscillators).toHaveLength(1);
    const oscillator = oscillators[0]!;
    expect(oscillator.frequency.setValueAtTime.mock.calls).toEqual([[660, 1], [880, 1 + .07], [1108, 1 + .14]]);
    expect(oscillator.start).toHaveBeenCalledExactlyOnceWith(1);
    expect(oscillator.stop).toHaveBeenCalledExactlyOnceWith(1.24);
    const envelope = contexts[0]!.createGain.mock.results.at(-1)!.value.gain;
    expect(envelope.setValueAtTime).toHaveBeenCalledExactlyOnceWith(.4 * .04, 1);
    expect(envelope.exponentialRampToValueAtTime).toHaveBeenCalledExactlyOnceWith(.0001, 1.24);
    audio.destroy();
  });

  it.each([{ sfx: false, sfxVolume: 1 }, { sfx: true, sfxVolume: 0 }])(
    "does not schedule any star-group notes when its SFX settings are %j", settings => {
      const { oscillators } = installAudioEnvironment({ [STORAGE.saveKey]: JSON.stringify({ version: 4, settings: { music: false, ...settings } }) });
      const audio = new AudioSystem(); audio.initializeAfterGesture(); audio.play("starGroup");
      expect(oscillators).toHaveLength(0); audio.destroy();
    });

  it("keeps the star-group cue silent before a gesture, while hidden and after destruction", () => {
    const { oscillators, doc } = installAudioEnvironment({ [STORAGE.saveKey]: JSON.stringify({ version: 4, settings: { music: false } }) });
    const audio = new AudioSystem(); audio.play("starGroup"); expect(oscillators).toHaveLength(0);
    audio.initializeAfterGesture(); doc.hidden = true; audio.play("starGroup"); expect(oscillators).toHaveLength(0);
    doc.hidden = false; audio.destroy(); audio.play("starGroup"); expect(oscillators).toHaveLength(0);
  });
});
