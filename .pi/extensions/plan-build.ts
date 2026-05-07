const DEFAULT_SCOPE = "kerjakan request terbaru dari user";

type WorkflowPi = {
	registerCommand: (
		name: string,
		options: {
			description: string;
			handler: (args: string, ctx: WorkflowCommandContext) => Promise<void> | void;
		},
	) => void;
	sendUserMessage: (content: string, options?: { deliverAs?: "steer" | "followUp" }) => void;
	sendMessage: (
		message: { customType: string; content: string; display?: boolean },
		options?: { triggerTurn?: boolean },
	) => void;
};

type WorkflowCommandContext = {
	isIdle: () => boolean;
	getContextUsage: () =>
		| {
				tokens: number | null;
				contextWindow: number;
				percent: number | null;
		  }
		| undefined;
	ui: {
		notify: (message: string, level?: "info" | "warning" | "error") => void;
	};
};

function normalizeScope(args: string): string {
	return args.trim() || DEFAULT_SCOPE;
}

function sendWorkflowMessage(pi: WorkflowPi, ctx: WorkflowCommandContext, message: string) {
	if (ctx.isIdle()) {
		pi.sendUserMessage(message);
		return;
	}

	pi.sendUserMessage(message, { deliverAs: "followUp" });
	ctx.ui.notify("Agent sedang berjalan. Workflow message di-queue sebagai follow-up.", "info");
}

function planPrompt(scope: string): string {
	return `Gunakan mode PLAN untuk q2web Studio.

Scope:
${scope}

Instruksi wajib:
1. Baca AGENTS.md, ../AGENTS.MD, docs/agents/rules.md, dan audit terbaru yang relevan.
2. Jangan edit file source code.
3. Jangan menjalankan command yang mengubah file, dependency, git state, atau environment.
4. Gunakan skill writing-plans bila tersedia.
5. Untuk bug, gunakan systematic-debugging dan temukan root cause sebelum propose fix.
6. Untuk perubahan yang menyentuh API library, gunakan fetch-library-docs atau lib-researcher.
7. Output plan ringkas dengan scope, file yang perlu disentuh, langkah implementasi, test wajib, risiko, dan handoff QA.
8. Jika plan perlu disimpan, sarankan path docs/superpowers/plans/<tanggal>-<topik>.md, tetapi jangan tulis file sebelum diminta.

Mulai dengan membaca konteks project lalu buat plan.`;
}

function buildPrompt(scope: string): string {
	return `Gunakan mode BUILD untuk q2web Studio.

Scope:
${scope}

Instruksi wajib:
1. Baca AGENTS.md, ../AGENTS.MD, docs/agents/rules.md, dan audit terbaru yang relevan.
2. Implementasikan hanya scope yang diminta, satu concern per perubahan.
3. Jangan mulai fase fitur lain sebelum prereq fase saat ini terpenuhi.
4. Jangan matikan React StrictMode.
5. Jangan panggil L.map() tanpa center dan zoom.
6. Reset useRef yang gating effect di awal init effect saat menyentuh lifecycle map.
7. Jika menyentuh API library yang belum pasti, gunakan fetch-library-docs atau lib-researcher dulu.
8. Jika menyentuh map, parser, runtime, export, popup, label, layer, atau widget, jalankan test jalur editor preview dan ZIP runtime sesuai docs/agents/skills/.
9. Setelah implementasi, ringkas file yang berubah, hasil test, risiko, dan next step QA.

Kerjakan end to end bila feasible. Jika perlu investigasi, lakukan dulu sebelum edit.`;
}

function formatNumber(value: number): string {
	return new Intl.NumberFormat("en-US").format(Math.round(value));
}

function contextUsageMessage(ctx: WorkflowCommandContext): string {
	const usage = ctx.getContextUsage();
	if (!usage) {
		return `Context usage belum tersedia.

Kemungkinan penyebab:
1. Model atau context window belum diketahui oleh Pi.
2. Thread baru belum punya assistant response.
3. Baru selesai compact, Pi perlu satu response baru untuk menghitung ulang usage.`;
	}

	const tokens = usage.tokens === null ? "unknown" : formatNumber(usage.tokens);
	const window = formatNumber(usage.contextWindow);
	const percent = usage.percent === null ? "unknown" : `${usage.percent.toFixed(1)}%`;
	const compactHint =
		usage.percent !== null && usage.percent >= 75
			? "\n\nRekomendasi: jalankan /compact dengan instruksi fokus pada keputusan, file yang berubah, test, blocker, dan next step."
			: "";

	return `Context usage

- Tokens: ${tokens}
- Context window: ${window}
- Usage: ${percent}${compactHint}`;
}

export default function (pi: WorkflowPi) {
	pi.registerCommand("plan", {
		description: "q2web Studio plan mode, read-only planning prompt",
		handler: async (args, ctx) => {
			sendWorkflowMessage(pi, ctx, planPrompt(normalizeScope(args)));
		},
	});

	pi.registerCommand("build", {
		description: "q2web Studio build mode, scoped implementation prompt",
		handler: async (args, ctx) => {
			sendWorkflowMessage(pi, ctx, buildPrompt(normalizeScope(args)));
		},
	});

	pi.registerCommand("ctx", {
		description: "Show current context-window usage for this Pi session",
		handler: async (_args, ctx) => {
			pi.sendMessage(
				{
					customType: "q2web-context-usage",
					content: contextUsageMessage(ctx),
					display: true,
				},
				{ triggerTurn: false },
			);
		},
	});

	pi.registerCommand("context-usage", {
		description: "Alias for /ctx",
		handler: async (_args, ctx) => {
			pi.sendMessage(
				{
					customType: "q2web-context-usage",
					content: contextUsageMessage(ctx),
					display: true,
				},
				{ triggerTurn: false },
			);
		},
	});
}
