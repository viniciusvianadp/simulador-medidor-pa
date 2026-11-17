# Offline Portuguese dialogue recordings

Generated locally with Piper TTS 1.8.0 and kokoro-onnx 0.4.7 on 2026-11-17. No speech service, API key,
Piper engine, or ONNX voice model is included in the browser application.

Provisional assignments, pending the user's listening review:

- Professional and narration: `pt_BR-cadu-medium`.
- Ana, Clara and Elisa: Kokoro `pf_dora` (Brazilian Portuguese female voice).
- Bruno and Diego: Piper `pt_BR-faber-medium` (male voice).
- Assignments are explicit in each patient case’s `voiceProfile`; they are not guessed from names.

These are synthetic voices. The in-scene caption footer discloses this.
No listening-quality or physical-headset acceptance is claimed by automation.

## Recordings and playback

`manifest.json` matches exact subtitle text to each WAV. Fixed phrases come from
`src/interaction/dialoguePhrases.json`; five introductions are generated from
`src/simulation/patientCases.ts`. Dates are expanded into Portuguese for speech.
The UI retains the original date string. Each audio file contains speech only,
without reading the professional/patient label aloud.

The simulator advances on the recording's `ended` event, stops playback on reset,
and falls back to browser speech if a recording cannot play. Unmatched text,
including custom patient identities, uses browser speech. Pressure results are
assembled into one decoded buffer from professional prefix, exact recorded number,
“por”, exact recorded number, units and the persistent-sounds suffix when applicable.
Numbers 0–300 are bundled; the normal adapter records even integers. These
composites retain one subtitle and finish before the patient reply. No case
reference readings are substituted into spoken results. Browser speech remains
a fallback for unsupported text or playback failure.

## Attribution and provenance

Piper engine: [OHF-Voice/piper1-gpl](https://github.com/OHF-Voice/piper1-gpl),
GPL-3.0-or-later. It is used as an external generation tool, not shipped here.

Voice source: [rhasspy/piper-voices](https://huggingface.co/rhasspy/piper-voices).
The downloaded model cards and their complete training chains are retained in
`provenance/`. The model-card license fields describe training datasets, not a
separate license grant over model weights or synthesized recordings. See
[Piper's licensing explanation](https://github.com/OHF-Voice/piper1-gpl/blob/main/docs/LICENSING.md).

- Cadu: its own dataset is listed as CC0; fine-tuned from `nl_BE-rdh-medium`,
  trained from scratch on [r-dh/dutch-vl-tts](https://github.com/r-dh/dutch-vl-tts),
  CC0 1.0 Universal.
- Faber: its own dataset is listed as CC0; fine-tuned from `en_US-hifi_tts_92-medium`.
  Credit: **NVIDIA Corporation, Hi-Fi Multi-Speaker English TTS Dataset**,
  [OpenSLR 109](https://www.openslr.org/109/),
  [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/),
  Bakhturina, Lavrukhin, Ginsburg and Zhang, Interspeech 2021.
  The base uses Cori Samuel's reader-92 recordings. The dataset/model was adapted
  through Portuguese fine-tuning, and these files were synthesized from project
  dialogue text. The attribution does not imply endorsement.

Model hashes are recorded in `provenance/models.sha256` to identify the exact
versions used; models themselves remain outside the repository.

## Female voice provenance

Kokoro-82M v1.0: [hexgrad/Kokoro-82M](https://huggingface.co/hexgrad/Kokoro-82M),
Apache-2.0. Its official voice table identifies `pf_dora` as Brazilian Portuguese
female. The model card, voice table and Apache license are retained in
`provenance/kokoro-*`. Generation uses the MIT-licensed
[thewh1teagle/kokoro-onnx](https://github.com/thewh1teagle/kokoro-onnx) tool.
The ONNX model and voice pack are downloaded from its `model-files-v1.1` release;
hashes are retained in `provenance/kokoro-models.sha256`. Only synthesized WAV
files are distributed, not either synthesis engine or model weights.

## Regeneration

Use Node 22.18+ and an isolated Python environment:

```sh
python3 -m venv /tmp/bp-piper-venv
/tmp/bp-piper-venv/bin/pip install piper-tts==1.8.0 kokoro-onnx==0.4.7
/tmp/bp-piper-venv/bin/python -m piper.download_voices --data-dir /tmp/bp-piper-models pt_BR-cadu-medium pt_BR-faber-medium
mkdir -p /tmp/bp-kokoro-models
curl -fL https://github.com/thewh1teagle/kokoro-onnx/releases/download/model-files-v1.1/kokoro-v1.0.onnx -o /tmp/bp-kokoro-models/kokoro-v1.0.onnx
curl -fL https://github.com/thewh1teagle/kokoro-onnx/releases/download/model-files-v1.1/voices-v1.0.bin -o /tmp/bp-kokoro-models/voices-v1.0.bin
PIPER_PYTHON=/tmp/bp-piper-venv/bin/python KOKORO_MODELS=/tmp/bp-kokoro-models PIPER_MODELS=/tmp/bp-piper-models npm run dialogue:generate
```

Downloads require internet; synthesis and playback of bundled files need no paid
service. Keep voice cards and hashes current when deliberately changing models.
Changing fixed dialogue requires regeneration; unmatched text safely uses browser
speech until its new recording exists.

The generation script adapts kokoro-onnx 0.4.7's speed input to the official ONNX
graph's declared float32 input. Local per-clip hashes cache generated files; these
cache files are ignored by Git. Changing a model requires clearing that cache
and updating the retained model hashes/provenance before regeneration.
