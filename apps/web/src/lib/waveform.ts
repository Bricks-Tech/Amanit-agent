const BARS = 180;

/** Peak heights from 0–1 for a recording waveform. */
export async function waveformPeaks(blob: Blob, bars = BARS): Promise<number[]> {
  const audioContext = new AudioContext();
  try {
    const decoded = await audioContext.decodeAudioData(await blob.arrayBuffer());
    const channel = decoded.getChannelData(0);
    const block = Math.max(1, Math.floor(channel.length / bars));
    const raw: number[] = [];
    for (let i = 0; i < bars; i += 1) {
      let max = 0;
      const start = i * block;
      const end = Math.min(channel.length, start + block);
      const step = Math.max(1, Math.floor((end - start) / 48));
      for (let j = start; j < end; j += step) {
        const value = Math.abs(channel[j] ?? 0);
        if (value > max) max = value;
      }
      raw.push(max);
    }
    const loudest = Math.max(...raw, 0.01);
    return raw.map((value) => value / loudest);
  } catch {
    return [];
  } finally {
    await audioContext.close();
  }
}
