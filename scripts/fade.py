"""Detect music fades in a 16 kHz mono s16le PCM file using Essentia.

Usage:
    python scripts/fade.py /tmp/episode.pcm \\
        --frame-size 2048 --hop-size 1024 \\
        --cutoff-high 0.85 --cutoff-low 0.20 --min-length 1.5

Prints JSON to stdout:
  [
    { "start": 0.0, "end": 4.2, "type": "in" },
    { "start": 3595.1, "end": 3600.3, "type": "out" }
  ]
"""

import argparse
import json
import struct
import sys

import numpy as np
from essentia.standard import FadeDetection, FrameGenerator, RMS

SAMPLE_RATE = 16000
BYTES_PER_SAMPLE = 2  # s16le


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument('pcm_path')
    parser.add_argument('--frame-size', type=int, required=True)
    parser.add_argument('--hop-size', type=int, required=True)
    parser.add_argument('--cutoff-high', type=float, required=True)
    parser.add_argument('--cutoff-low', type=float, required=True)
    parser.add_argument('--min-length', type=float, required=True)
    args = parser.parse_args()

    with open(args.pcm_path, 'rb') as f:
        raw = f.read()

    num_samples = len(raw) // BYTES_PER_SAMPLE
    samples = struct.unpack(f'<{num_samples}h', raw[:num_samples * BYTES_PER_SAMPLE])
    audio = np.asarray(samples, dtype=np.float32) / 32768.0

    frame_rate = SAMPLE_RATE / args.hop_size
    rms = RMS()
    rms_values = np.asarray(
        [
            rms(frame)
            for frame in FrameGenerator(
                audio,
                frameSize=args.frame_size,
                hopSize=args.hop_size,
                startFromZero=True,
            )
        ],
        dtype=np.float32,
    )

    fades = []
    if rms_values.size > 0:
        fade_in, fade_out = FadeDetection(
            cutoffHigh=args.cutoff_high,
            cutoffLow=args.cutoff_low,
            frameRate=frame_rate,
            minLength=args.min_length,
        )(rms_values)

        for start, end in fade_in:
            fades.append({'start': round(float(start), 3),
                          'end': round(float(end), 3),
                          'type': 'in'})
        for start, end in fade_out:
            fades.append({'start': round(float(start), 3),
                          'end': round(float(end), 3),
                          'type': 'out'})
        fades.sort(key=lambda f: f['start'])

    json.dump(fades, sys.stdout)


if __name__ == '__main__':
    main()
