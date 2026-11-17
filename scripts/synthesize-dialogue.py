"""Offline generation only. Install piper-tts==1.8.0 in a separate Python venv."""
import json
import sys
import wave
from pathlib import Path
from piper import PiperVoice, SynthesisConfig
import numpy as np
import hashlib
import io

manifest_path = Path(sys.argv[1])
models = Path(sys.argv[2])
clips = json.loads(manifest_path.read_text())["clips"]
for voice_name in dict.fromkeys(clip["voice"] for clip in clips):
    if voice_name == "pf_dora":
        from kokoro_onnx import Kokoro
        kokoro_models = Path(sys.argv[3])
        voice = Kokoro(str(kokoro_models / "kokoro-v1.0.onnx"), str(kokoro_models / "voices-v1.0.bin"))
        # kokoro-onnx 0.4.7 sends int32 speed for input_ids exports, but this
        # official v1.0 graph declares float32. Preserve the requested speed.
        run = voice.sess.run
        def compatible_run(outputs, inputs, *args, **kwargs):
            return run(outputs, {**inputs, "speed": np.array([0.95], dtype=np.float32)}, *args, **kwargs)
        voice.sess.run = compatible_run
    else:
        voice = PiperVoice.load(models / f"{voice_name}.onnx")
    for clip in (clip for clip in clips if clip["voice"] == voice_name):
        destination = manifest_path.parent / f'{clip["id"]}.wav'
        stamp = destination.with_suffix(".sha256")
        key = hashlib.sha256(json.dumps(clip, sort_keys=True).encode()).hexdigest()
        if destination.exists() and stamp.exists() and stamp.read_text() == key:
            continue
        temporary = destination.with_suffix(".tmp.wav")
        if voice_name == "pf_dora":
            samples, rate = voice.create(clip["spokenText"], voice="pf_dora", speed=0.95, lang="pt-br")
            data = (np.clip(samples, -1, 1) * 32767).astype("<i2")
        else:
            output = io.BytesIO()
            with wave.open(output, "wb") as wav:
                voice.synthesize_wav(clip["spokenText"], wav, syn_config=SynthesisConfig(length_scale=1.05))
            with wave.open(io.BytesIO(output.getvalue())) as wav:
                rate = wav.getframerate()
                data = np.frombuffer(wav.readframes(wav.getnframes()), dtype="<i2")
        if clip.get("trim"):
            active = np.flatnonzero(np.abs(data.astype(np.int32)) > max(12, np.max(np.abs(data.astype(np.int32))) * 0.003))
            if active.size:
                pad = int(rate * 0.025)
                data = data[max(0, int(active[0]) - pad):int(active[-1]) + pad + 1]
        with wave.open(str(temporary), "wb") as wav:
            wav.setnchannels(1)
            wav.setsampwidth(2)
            wav.setframerate(rate)
            wav.writeframes(data.tobytes())
        temporary.replace(destination)
        stamp.write_text(key)
        print(destination.name, flush=True)
