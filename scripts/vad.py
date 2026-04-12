"""Detect speech intervals in a 16 kHz mono s16le PCM file using Silero VAD.

Usage:
    python scripts/vad.py /tmp/episode.pcm

Prints JSON to stdout:
    {"duration": 3600.5, "speech": [{"start": 0.32, "end": 15.8}, ...]}
"""

import json
import struct
import sys

import torch

SAMPLE_RATE = 16000
BYTES_PER_SAMPLE = 2  # s16le


def main() -> None:
    if len(sys.argv) != 2:
        print(f'Usage: {sys.argv[0]} <pcm-path>', file=sys.stderr)
        sys.exit(1)

    pcm_path = sys.argv[1]

    with open(pcm_path, 'rb') as f:
        raw = f.read()

    num_samples = len(raw) // BYTES_PER_SAMPLE
    samples = struct.unpack(f'<{num_samples}h', raw[:num_samples * BYTES_PER_SAMPLE])
    audio = torch.tensor(samples, dtype=torch.float32) / 32768.0
    duration = num_samples / SAMPLE_RATE

    model, utils = torch.hub.load(
        repo_or_dir='snakers4/silero-vad',
        model='silero_vad',
        trust_repo=True,
    )
    get_speech_timestamps = utils[0]

    timestamps = get_speech_timestamps(audio, model, sampling_rate=SAMPLE_RATE)

    speech = [
        {
            'start': round(ts['start'] / SAMPLE_RATE, 3),
            'end': round(ts['end'] / SAMPLE_RATE, 3),
        }
        for ts in timestamps
    ]

    json.dump({'duration': round(duration, 3), 'speech': speech}, sys.stdout)


if __name__ == '__main__':
    main()
