import manifest from "../../assets/Audio/dialogue/manifest.json";

const files = import.meta.glob("../../assets/Audio/dialogue/*.wav", {
	eager: true, query: "?url", import: "default",
}) as Record<string, string>;

/** Bundled recordings only: uses the same Web Audio platform as clinical sounds. */
export class DialogueAudio {
	private _stop: (() => void) | null = null;
	private _disposed = false;
	private _context: AudioContext | null = null;
	private _clips = new Map(manifest.clips.map(clip => [`${clip.profile}:${clip.text}`,
		files[`../../assets/Audio/dialogue/${clip.id}.wav`]]));

	public constructor(
		private _createContext: () => AudioContext = () => new AudioContext(),
		private _fetch: typeof fetch = (...args) => fetch(...args),
	) {}

	public getClip(text: string, profile: "female" | "male" = "male"): string | string[] | undefined {
		const direct = this._clips.get(`${profile}:${text}`) ?? this._clips.get(`shared:${text}`);
		if (direct) return direct;
		const results = /^Profissional: Sua pressão medida foi (\d+) por (\d+) milímetros de mercúrio\.( Os sons persistiram até zero; o abafamento foi registrado\.)?$/.exec(text);
		if (!results) return undefined;
		const ids = ["results-prefix", `number-${Number(results[1])}`, "results-por", `number-${Number(results[2])}`, "results-unit"];
		if (results[3]) ids.push("results-persistent");
		const urls = ids.map(id => this._clips.get(`shared:@${id}`));
		return urls.every(Boolean) ? urls as string[] : undefined;
	}

	public play(url: string | string[]): Promise<boolean> {
		this._stop?.();
		if (this._disposed) return Promise.resolve(false);
		return new Promise(resolve => {
			let done = false;
			let source: AudioBufferSourceNode | null = null;
			let timer: ReturnType<typeof setTimeout>;
			const request = new AbortController();
			const finish = (played: boolean) => {
				if (done) return;
				done = true;
				clearTimeout(timer);
				request.abort();
				if (source) {
					source.onended = null;
					try { source.stop(); } catch { /* Not started yet. */ }
					source.disconnect();
				}
				if (this._stop === stop) this._stop = null;
				resolve(played);
			};
			const stop = () => finish(false);
			this._stop = stop;
			timer = setTimeout(stop, 20000);
			void (async () => {
				try {
					const context = this._context ??= this._createContext();
					const buffers = await Promise.all((Array.isArray(url) ? url : [url]).map(async path => {
						const response = await this._fetch(path, { signal: request.signal });
						if (!response.ok) throw new Error(`Dialogue audio HTTP ${response.status}`);
						return context.decodeAudioData(await response.arrayBuffer());
					}));
					let buffer = buffers[0];
					if (buffers.length > 1) {
						const gap = Math.round(context.sampleRate * 0.035);
						buffer = context.createBuffer(1, buffers.reduce((total, part) => total + part.length, 0) + gap * (buffers.length - 1), context.sampleRate);
						const channel = buffer.getChannelData(0);
						let offset = 0;
						for (const part of buffers) {
							channel.set(part.getChannelData(0), offset);
							offset += part.length + gap;
						}
					}
					if (done) return;
					await context.resume();
					if (done) return;
					if (context.state !== "running") throw new Error("Dialogue audio is blocked");
					source = context.createBufferSource();
					source.buffer = buffer;
					source.connect(context.destination);
					source.onended = () => finish(true);
					clearTimeout(timer);
					timer = setTimeout(stop, Math.max(15000, (buffer.duration + 10) * 1000));
					source.start();
				} catch { stop(); }
			})();
		});
	}

	public dispose(): void {
		this._disposed = true;
		this._stop?.();
		void this._context?.close().catch(() => {});
		this._context = null;
	}
}
