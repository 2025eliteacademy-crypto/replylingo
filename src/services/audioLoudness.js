import lamejs from "./lamejsShim.cjs";

const { WavHeader, Mp3Encoder } = lamejs;

// How loud the FINAL output should average out to. -12 dBFS RMS is a solid
// "loud, clean voice message" level. Raw Chirp3-HD output measures around
// -19 dBFS, so this is already a real, clearly audible boost (~+7dB). Going
// much past -9 or so starts forcing the limiter below to work harder and
// harder, which is what caused the earlier harsh/distorted version.
const TARGET_RMS_DBFS = -12;

// Never apply more makeup gain than this, so near-silent/empty audio
// doesn't get amplified into audible noise.
const MAX_GAIN_LINEAR = 8; // ~+18 dB

// Ceiling the limiter holds peaks under (fraction of full scale). Left with
// a little headroom below 1.0 so the MP3 re-encode doesn't introduce
// inter-sample clipping.
const CEILING = 0.97;

function dbfsToLinear(dbfs) {
  return Math.pow(10, dbfs / 20);
}

/**
 * Feedforward peak limiter with an attack/release envelope — this is the
 * actual difference from the previous version. That version reshaped the
 * WAVEFORM itself (a per-sample tanh curve), which is audible harmonic
 * distortion on every loud syllable, not just "loud." A real limiter instead
 * tracks a single time-varying GAIN value and multiplies the whole signal by
 * it — the waveform's shape is untouched, so it stays clean; only the
 * overall level dips briefly on transients, then recovers.
 */
function limitEnvelope(samples, sampleRate, ceiling) {
  const attackMs = 3; // how fast it clamps down on a sudden peak
  const releaseMs = 80; // how fast it eases back off afterward
  const attackCoeff = Math.exp(-1 / (sampleRate * (attackMs / 1000)));
  const releaseCoeff = Math.exp(-1 / (sampleRate * (releaseMs / 1000)));

  const gainEnvelope = new Float32Array(samples.length);
  let envelope = 1.0;

  for (let i = 0; i < samples.length; i++) {
    const abs = Math.abs(samples[i]) || 1e-9;
    const requiredGain = Math.min(1, ceiling / abs);

    envelope =
      requiredGain < envelope
        ? attackCoeff * envelope + (1 - attackCoeff) * requiredGain
        : releaseCoeff * envelope + (1 - releaseCoeff) * requiredGain;

    gainEnvelope[i] = envelope;
  }

  return gainEnvelope;
}

/**
 * Takes Google Cloud TTS's LINEAR16 (WAV) output and returns a louder MP3
 * buffer: measures the clip's RMS, applies flat makeup gain toward
 * TARGET_RMS_DBFS, then runs it through the envelope limiter above so
 * whatever still pokes over the ceiling gets pulled down cleanly instead of
 * clipped or waveshaped. Plain volumeGainDb (Google's own gain parameter)
 * tops out at +16dB and still clips hard once peaks hit full scale — this
 * step is what actually gets it louder without the harshness.
 */
export function maximizeLoudnessToMp3(wavBuffer) {
  const dataView = new DataView(wavBuffer.buffer, wavBuffer.byteOffset, wavBuffer.byteLength);
  const header = WavHeader.readHeader(dataView);

  const samples = new Int16Array(
    wavBuffer.buffer,
    wavBuffer.byteOffset + header.dataOffset,
    header.dataLen / 2
  );

  // 1. Measure current loudness and compute flat makeup gain.
  let sumSquares = 0;
  for (let i = 0; i < samples.length; i++) {
    const f = samples[i] / 32768;
    sumSquares += f * f;
  }
  const currentRms = Math.sqrt(sumSquares / samples.length) || 1e-9;
  const targetRms = dbfsToLinear(TARGET_RMS_DBFS);
  const gain = Math.min(targetRms / currentRms, MAX_GAIN_LINEAR);

  // 2. Apply the gain, then compute the limiter's gain-reduction envelope
  // over the boosted signal.
  const boosted = new Float32Array(samples.length);
  for (let i = 0; i < samples.length; i++) {
    boosted[i] = (samples[i] / 32768) * gain;
  }
  const envelope = limitEnvelope(boosted, header.sampleRate, CEILING);

  // 3. Apply the envelope (pure gain multiply — waveform shape untouched).
  const processed = new Int16Array(samples.length);
  for (let i = 0; i < samples.length; i++) {
    const sample = boosted[i] * envelope[i];
    processed[i] = Math.max(-32768, Math.min(32767, Math.round(sample * 32768)));
  }

  // 4. Encode back to MP3 (mono — Chirp3-HD/Wavenet/Standard voices are all
  // single-channel).
  const encoder = new Mp3Encoder(header.channels || 1, header.sampleRate, 128);
  const chunkSize = 1152;
  const mp3Chunks = [];
  for (let i = 0; i < processed.length; i += chunkSize) {
    const chunk = processed.subarray(i, i + chunkSize);
    const mp3buf = encoder.encodeBuffer(chunk);
    if (mp3buf.length > 0) mp3Chunks.push(Buffer.from(mp3buf));
  }
  const finalBuf = encoder.flush();
  if (finalBuf.length > 0) mp3Chunks.push(Buffer.from(finalBuf));

  return Buffer.concat(mp3Chunks);
}
