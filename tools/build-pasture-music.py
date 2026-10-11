"""Render an original, deterministic pastoral loop; no sampled soundtrack material."""
from pathlib import Path
import hashlib
import json
import math
import wave

import numpy as np
from scipy.signal import butter, sosfilt

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "assets/audio"
OUT.mkdir(parents=True, exist_ok=True)
RATE, BPM, BARS = 22050, 104, 32
BEAT = 60 / BPM
LENGTH = round(BARS * 4 * BEAT * RATE)
rng = np.random.default_rng(20261011)
mix = np.zeros((LENGTH, 2), dtype=np.float64)
counts = {}


def note_frequency(midi):
    return 440 * 2 ** ((midi - 69) / 12)


def voice(midi, duration, instrument):
    t = np.arange(round((duration + .5) * RATE)) / RATE
    f = note_frequency(midi)
    attack = 1 - np.exp(-t / (.032 if instrument == "flute" else .006))
    release = np.clip((duration + .12 - t) / .12, 0, 1)
    if instrument == "piano":
        sound = np.zeros_like(t)
        for harmonic, level in enumerate([1, .32, .13, .065, .035, .014], 1):
            sound += level * np.sin(2 * np.pi * f * harmonic * (1 + .00011 * harmonic ** 2) * t) * np.exp(-t * (1.7 + harmonic * .65))
        sound += .12 * np.sin(2 * np.pi * f * 1.0013 * t) * np.exp(-t * 3)
    elif instrument == "guitar":
        sound = np.zeros_like(t)
        for harmonic in range(1, 10):
            level = harmonic ** -1.5 * (.75 if harmonic % 2 == 0 else 1)
            sound += level * np.sin(2 * np.pi * f * harmonic * t) * np.exp(-t * (2 + harmonic * .7))
    elif instrument == "flute":
        phase = 2 * np.pi * f * (t + .003 / (2 * np.pi * 4.8) * (1 - np.cos(2 * np.pi * 4.8 * t)))
        breath = sosfilt(butter(2, [700, 4500], btype="bandpass", fs=RATE, output="sos"), rng.normal(0, 1, len(t)))
        sound = (.8 * np.sin(phase) + .09 * np.sin(2 * phase) + .04 * np.sin(3 * phase) + .028 * breath) * np.exp(-t * .22)
    elif instrument == "bass":
        sound = (np.sin(2 * np.pi * f * t) + .38 * np.sin(4 * np.pi * f * t)) * np.exp(-t * 3.8)
    else:
        raise ValueError(instrument)
    return sound * attack * release


def place(sound, start, volume, pan=0):
    # Wrap every release/reverb tail into the next lap instead of truncating it.
    indices = (round(start * RATE) + np.arange(len(sound))) % LENGTH
    angle = (pan + 1) * math.pi / 4
    np.add.at(mix[:, 0], indices, sound * volume * math.cos(angle))
    np.add.at(mix[:, 1], indices, sound * volume * math.sin(angle))


def note(midi, bar, beat, duration, volume, instrument, pan=0):
    counts[instrument] = counts.get(instrument, 0) + 1
    start = (bar * 4 + beat) * BEAT + rng.uniform(-.004, .004)
    place(voice(midi, duration * BEAT, instrument), start, volume * rng.uniform(.93, 1.04), pan)


# Independent melody phrases in D major: two verses, a bridge and a closing verse.
theme = [
    [(0, 66, .5), (.5, 69, .5), (1, 74, 1), (2, 73, .5), (2.5, 69, .5), (3, 66, 1)],
    [(0, 66, 1), (1, 69, .5), (1.5, 71, .5), (2, 74, 1.5)],
    [(0, 71, .5), (.5, 69, .5), (1, 67, 1), (2, 66, .5), (2.5, 64, .5), (3, 62, .75)],
    [(0, 64, 1), (1, 66, .5), (1.5, 69, .5), (2, 73, 1), (3, 71, .5)],
    [(0, 69, .5), (.5, 66, .5), (1, 62, 1), (2, 66, .5), (2.5, 69, .5), (3, 74, .75)],
    [(0, 73, 1), (1, 69, .5), (1.5, 66, .5), (2, 64, 1.5)],
    [(0, 67, .5), (.5, 71, .5), (1, 74, 1), (2, 76, .5), (2.5, 74, .5), (3, 71, .75)],
    [(0, 69, 1), (1, 66, .5), (1.5, 64, .5), (2, 62, 1.5)],
]
bridge = [
    [(0, 71, 1), (1, 74, .5), (1.5, 76, .5), (2, 78, 1.5)],
    [(0, 76, .5), (.5, 73, .5), (1, 69, 1), (2, 71, .5), (2.5, 73, .5), (3, 76, .75)],
    [(0, 73, 1), (1, 69, .5), (1.5, 66, .5), (2, 69, 1.5)],
    [(0, 71, .5), (.5, 74, .5), (1, 78, 1), (2, 76, .5), (2.5, 74, .5), (3, 71, .75)],
    [(0, 67, 1), (1, 71, .5), (1.5, 74, .5), (2, 76, 1.5)],
    [(0, 73, .5), (.5, 71, .5), (1, 69, 1), (2, 66, .5), (2.5, 64, .5), (3, 66, .75)],
    [(0, 67, 1), (1, 69, .5), (1.5, 71, .5), (2, 74, 1.5)],
    [(0, 73, 1), (1, 71, .5), (1.5, 69, .5), (2, 64, 1), (3, 69, .5)],
]
chords = {
    "D": (38, [50, 57, 62, 66, 69]), "Bm7": (35, [47, 54, 59, 62, 66]),
    "Gmaj7": (31, [43, 50, 55, 59, 66]), "Aadd9": (33, [45, 52, 57, 61, 64]),
    "F#m7": (30, [42, 49, 54, 57, 64]), "Em7": (28, [40, 47, 52, 55, 59]),
}
verse_chords = ["D", "Bm7", "Gmaj7", "Aadd9", "D", "F#m7", "Gmaj7", "Aadd9"]
bridge_chords = ["Gmaj7", "Aadd9", "F#m7", "Bm7", "Em7", "Aadd9", "Gmaj7", "Aadd9"]
for bar in range(BARS):
    middle = 16 <= bar < 24
    chord = (bridge_chords if middle else verse_chords)[bar % 8]
    bass, harmony = chords[chord]
    for beat, pitch in [(0, bass), (2, bass + 7)]:
        note(pitch, bar, beat, 1.25, .15, "bass")
    for index, pitch_index in enumerate([0, 2, 3, 4, 1, 2, 4, 3]):
        beat = index * .5 + (.026 if index % 2 else 0)
        note(harmony[pitch_index], bar, beat, 1.1, .068, "guitar", -.32)
    for index, pitch in enumerate(harmony[2:]):
        note(pitch, bar, 0 + .018 * index, 2.4, .027, "piano", .28)
    phrase = (bridge if middle else theme)[bar % 8]
    instrument = "flute" if 8 <= bar < 24 else "piano"
    for beat, pitch, duration in phrase:
        note(pitch, bar, beat, duration * .9, .19 if instrument == "piano" else .12, instrument, .06)
    # Quiet brushes and wooden taps supply movement without competing with jump cues.
    for index in range(8):
        t = np.arange(round(.065 * RATE)) / RATE
        noise = sosfilt(butter(2, 4200, btype="highpass", fs=RATE, output="sos"), rng.normal(0, 1, len(t)))
        sound = noise * (1 - np.exp(-t / .001)) * np.exp(-t * 95)
        place(sound, (bar * 4 + index * .5 + .25) * BEAT, .012 if index % 2 else .008, .4)
    for beat in [1, 3]:
        t = np.arange(round(.045 * RATE)) / RATE
        sound = (np.sin(2 * np.pi * 1480 * t) + .3 * np.sin(2 * np.pi * 2470 * t)) * (1 - np.exp(-t / .0006)) * np.exp(-t * 160)
        place(sound, (bar * 4 + beat) * BEAT, .02, -.25)

dry = mix.copy()
for seconds, level in [(.083, .07), (.129, .05), (.181, .035), (.237, .02)]:
    mix += np.roll(dry[:, ::-1], round(seconds * RATE), axis=0) * level
# Warm, very gentle saturation and no DC/low-frequency rumble. Pre-roll makes the filter periodic.
mix = np.tanh(mix * 1.1)
filter_ = butter(2, 38, btype="highpass", fs=RATE, output="sos")
mix = sosfilt(filter_, np.concatenate([mix[-RATE:], mix]), axis=0)[RATE:]
mix *= .74 / np.max(np.abs(mix))
pcm = np.round(mix * 32767).astype("<i2")
target = OUT / "pasture-morning-v1.wav"
with wave.open(str(target), "wb") as file:
    file.setnchannels(2)
    file.setsampwidth(2)
    file.setframerate(RATE)
    file.writeframes(pcm.tobytes())
rms = float(np.sqrt(np.mean(mix ** 2)))
jump = float(np.max(np.abs(mix[0] - mix[-1])))
assert jump < .03, f"Discontinuous loop boundary: {jump}"
assert np.isfinite(mix).all() and np.max(np.abs(mix)) < 1
metadata = {
    "title": "牧场晨光 / Pasture Morning", "composition": "Original melody, arrangement and generated instruments for Sheep Run",
    "source": "tools/build-pasture-music.py", "thirdPartySamples": [],
    "tempoBpm": BPM, "key": "D major", "meter": "4/4", "bars": BARS,
    "instruments": counts, "durationSeconds": LENGTH / RATE, "sampleRate": RATE,
    "channels": 2, "format": "PCM 16-bit WAV", "peak": float(np.max(np.abs(mix))),
    "rmsDbfs": 20 * math.log10(rms), "loopBoundaryDelta": jump,
    "loop": "32 bars; release and reverb tails wrap into the next lap",
    "sha256": hashlib.sha256(target.read_bytes()).hexdigest(),
}
(OUT / "pasture-morning-v1.json").write_text(json.dumps(metadata, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
print(json.dumps(metadata, ensure_ascii=False))
