import { patientCases } from "../simulation/patientCases.js";
import type { ScenarioConfig } from "../simulation/types.js";
import { labels } from "./labels.js";

export interface MenuActions {
	start(config: ScenarioConfig): Promise<void>;
	restart(): Promise<void>;
	back(): void;
}

export class StartMenu {
	private _root: HTMLElement;
	private _canvas: HTMLCanvasElement;
	private _actions: MenuActions;
	private _busy = false;
	private _sessionActive = false;
	private _events = new AbortController();

	public constructor(root: HTMLElement, canvas: HTMLCanvasElement, actions: MenuActions) {
		this._root = root;
		this._canvas = canvas;
		this._actions = actions;
		root.innerHTML = `
			<section class="start-menu" aria-labelledby="menu-title">
				<header class="menu-heading">
					<div class="brand"><span class="brand-mark" aria-hidden="true">＋</span><span>${labels.brand}</span></div>
					<h1 id="menu-title">${labels.title}</h1>
					<p class="intro">${labels.intro}</p>
				</header>
				<div class="menu-panels">
					<section class="panel setup-panel" aria-labelledby="setup-title">
						<div class="section-heading"><span class="section-number" aria-hidden="true">01</span><h2 id="setup-title">${labels.setup}</h2></div>
						<p class="field-label">${labels.scenarioLabel}</p>
						<div class="scenario-card">
							<svg class="gauge-icon" viewBox="0 0 64 64" fill="none" aria-hidden="true"><circle cx="32" cy="28" r="22"/><path d="M18 33a15 15 0 1 1 28 0M32 13v5M19 20l4 4M45 20l-4 4M32 28l9-7M27 50v8h10v-8"/><circle cx="32" cy="28" r="3"/></svg>
							<div><h3>${labels.scenario}</h3><p>${labels.scenarioDescription}</p></div>
						</div>
						<label class="field-label" for="patient-select">${labels.patientLabel}</label>
						<select id="patient-select" aria-describedby="patient-hint"></select>
						<p id="patient-hint" class="field-hint">${labels.patientHint}</p>
					</section>
					<section class="panel instructions-panel" aria-labelledby="instructions-title">
						<div class="section-heading"><span class="section-number" aria-hidden="true">02</span><h2 id="instructions-title">${labels.beforeStart}</h2></div>
						<ol class="instructions">${labels.instructions.map(item => `<li><h3>${item.title}</h3><p>${item.text}</p></li>`).join("")}</ol>
						<button id="start-button" class="button primary" type="button"><span>${labels.start}</span><span aria-hidden="true">↗</span></button>
					</section>
				</div>
				<footer class="menu-footer"><span>${labels.footer}</span><span aria-hidden="true">PA / XR</span></footer>
			</section>
			<section class="session-bar" hidden aria-label="${labels.navigation}">
				<div class="session-summary"><span class="session-indicator" aria-hidden="true"></span><div><p class="session-eyebrow">${labels.session}</p><h2 id="session-title" tabindex="-1">${labels.scenario}</h2><p id="session-patient"></p></div></div>
				<nav aria-label="${labels.navigation}"><button id="restart-button" class="button secondary" type="button">${labels.restart}</button><button id="back-button" class="button secondary" type="button">${labels.back}</button></nav>
			</section>
			<p class="session-hint" hidden>${labels.sessionHint}</p>
			<div class="loading-overlay" hidden><span class="loading-mark" aria-hidden="true">＋</span><p id="loading-text"></p></div>
			<p id="menu-status" class="menu-status" role="status" aria-live="polite" aria-atomic="true"></p>
		`;
		const select = this._element<HTMLSelectElement>("#patient-select");
		for (const patient of patientCases) select.add(new Option(patient.config.patient.name, patient.id));
		const options = { signal: this._events.signal };
		this._element("#start-button").addEventListener("click", () => void this._start(false), options);
		this._element("#restart-button").addEventListener("click", () => void this._start(true), options);
		this._element("#back-button").addEventListener("click", () => {
			if (this._busy) return;
			this._actions.back();
			this._sessionActive = false;
			this._showSession(false);
			this._element("#menu-status").textContent = "";
			this._element("#start-button").focus();
		}, options);
		canvas.setAttribute("aria-label", labels.canvas);
		this._showSession(false);
	}

	private _element<T extends HTMLElement = HTMLElement>(selector: string): T {
		return this._root.querySelector<T>(selector)!;
	}

	private async _start(restart: boolean): Promise<void> {
		if (this._busy) return;
		this._busy = true;
		const status = this._element("#menu-status");
		status.textContent = restart ? labels.restarting : labels.starting;
		this._element("#loading-text").textContent = status.textContent;
		this._element(".loading-overlay").hidden = false;
		this._root.setAttribute("aria-busy", "true");
		this._toggleControls(true);
		try {
			const selected = patientCases.find(patient => patient.id === this._element<HTMLSelectElement>("#patient-select").value)!;
			if (restart && this._sessionActive) await this._actions.restart();
			else await this._actions.start(selected.config);
			this._sessionActive = true;
			this._element("#session-patient").textContent = selected.config.patient.name;
			this._showSession(true);
			status.textContent = "";
			this._element("#session-title").focus();
		} catch (error) {
			console.error("Falha ao iniciar a simulação:", error);
			this._sessionActive = false;
			this._showSession(false);
			status.textContent = labels.loadError;
			this._element("#start-button span").textContent = labels.retry;
		} finally {
			this._busy = false;
			this._element(".loading-overlay").hidden = true;
			this._root.removeAttribute("aria-busy");
			this._toggleControls(false);
			if (!this._sessionActive) this._element("#start-button").focus();
		}
	}

	private _toggleControls(disabled: boolean): void {
		this._root.querySelectorAll<HTMLButtonElement | HTMLSelectElement>("button, select").forEach(element => { element.disabled = disabled; });
	}

	private _showSession(active: boolean): void {
		this._element(".start-menu").hidden = active;
		this._element(".session-bar").hidden = !active;
		this._element(".session-hint").hidden = !active;
		this._canvas.hidden = !active;
		this._element("#start-button span").textContent = labels.start;
	}

	public dispose(): void {
		this._events.abort();
		this._root.replaceChildren();
	}
}
