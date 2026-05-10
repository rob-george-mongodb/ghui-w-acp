export type ThemeId =
	| "system"
	| "ghui"
	| "tokyo-night"
	| "catppuccin"
	| "catppuccin-latte"
	| "rose-pine"
	| "rose-pine-dawn"
	| "gruvbox"
	| "gruvbox-light"
	| "nord"
	| "dracula"
	| "kanagawa"
	| "one-dark"
	| "one-light"
	| "monokai"
	| "solarized-dark"
	| "solarized-light"
	| "everforest"
	| "vesper"
	| "vague"
	| "ayu"
	| "ayu-mirage"
	| "ayu-light"
	| "github-dark-dimmed"
	| "palenight"
	| "opencode"
	| "cursor"

export type ThemeTone = "dark" | "light"

export interface ThemeMetadata {
	readonly id: ThemeId
	readonly name: string
	readonly description: string
	readonly tone: ThemeTone
}

export const themeMetadataCatalog: readonly ThemeMetadata[] = [
	{ id: "system", name: "System", description: "Use the terminal foreground, background, and ANSI palette", tone: "dark" },
	{ id: "ghui", name: "GHUI", description: "Warm parchment accents on a deep slate background", tone: "dark" },
	{ id: "tokyo-night", name: "Tokyo Night", description: "Cool indigo surfaces with neon editor accents", tone: "dark" },
	{ id: "catppuccin", name: "Catppuccin", description: "Mocha lavender, peach, and soft pastel contrast", tone: "dark" },
	{ id: "catppuccin-latte", name: "Catppuccin Latte", description: "Light frothy cream with pastel lavender and peach", tone: "light" },
	{ id: "rose-pine", name: "Rose Pine", description: "Muted rose, pine, and gold on dusky violet", tone: "dark" },
	{ id: "rose-pine-dawn", name: "Rose Pine Dawn", description: "Soft morning light with rose and sage accents", tone: "light" },
	{ id: "gruvbox", name: "Gruvbox", description: "Retro warm earth tones with punchy semantic accents", tone: "dark" },
	{ id: "gruvbox-light", name: "Gruvbox Light", description: "Warm parchment background with earthy retro colors", tone: "light" },
	{ id: "nord", name: "Nord", description: "Arctic blue-gray surfaces with frosty accents", tone: "dark" },
	{ id: "dracula", name: "Dracula", description: "High-contrast purple, pink, cyan, and green", tone: "dark" },
	{ id: "kanagawa", name: "Kanagawa", description: "Ink-wash indigo, wave blues, and autumn accents", tone: "dark" },
	{ id: "one-dark", name: "One Dark", description: "Atom-style charcoal with clean blue and green accents", tone: "dark" },
	{ id: "one-light", name: "One Light", description: "Clean light surfaces with balanced blue and green accents", tone: "light" },
	{ id: "monokai", name: "Monokai", description: "Classic dark olive with electric syntax colors", tone: "dark" },
	{ id: "solarized-dark", name: "Solarized Dark", description: "Low-contrast blue-green base with calibrated accents", tone: "dark" },
	{ id: "solarized-light", name: "Solarized Light", description: "Warm beige base with the same calibrated accent colors", tone: "light" },
	{ id: "everforest", name: "Everforest", description: "Soft green-gray forest tones with warm highlights", tone: "dark" },
	{ id: "vesper", name: "Vesper", description: "Minimal black surfaces with peach and aqua accents", tone: "dark" },
	{ id: "vague", name: "Vague", description: "Muted low-contrast charcoal with soft editor accents", tone: "dark" },
	{ id: "ayu", name: "Ayu", description: "Modern bright dark theme with blue and orange accents", tone: "dark" },
	{ id: "ayu-mirage", name: "Ayu Mirage", description: "Medium-contrast blue-gray with vibrant syntax colors", tone: "dark" },
	{ id: "ayu-light", name: "Ayu Light", description: "Clean light theme with crisp blue and orange accents", tone: "light" },
	{ id: "github-dark-dimmed", name: "GitHub Dark Dimmed", description: "GitHub-inspired muted dark blue-gray with soft accents", tone: "dark" },
	{ id: "palenight", name: "Palenight", description: "Material-inspired purple-blue with soft lavender tones", tone: "dark" },
	{ id: "opencode", name: "OpenCode", description: "Charcoal panels with peach, violet, and blue highlights", tone: "dark" },
	{ id: "cursor", name: "Cursor", description: "Deep charcoal base with Anysphere's signature bright blue accents", tone: "dark" },
] as const

const pairedThemeIds: Partial<Record<ThemeId, ThemeId>> = {
	catppuccin: "catppuccin-latte",
	"catppuccin-latte": "catppuccin",
	"rose-pine": "rose-pine-dawn",
	"rose-pine-dawn": "rose-pine",
	gruvbox: "gruvbox-light",
	"gruvbox-light": "gruvbox",
	"one-dark": "one-light",
	"one-light": "one-dark",
	"solarized-dark": "solarized-light",
	"solarized-light": "solarized-dark",
	ayu: "ayu-light",
	"ayu-mirage": "ayu-light",
	"ayu-light": "ayu",
}

export const isThemeId = (value: unknown): value is ThemeId => typeof value === "string" && themeMetadataCatalog.some((theme) => theme.id === value)

export const getThemeMetadata = (id: ThemeId): ThemeMetadata => themeMetadataCatalog.find((theme) => theme.id === id) ?? themeMetadataCatalog[0]!

export const themeToneForThemeId = (id: ThemeId): ThemeTone => getThemeMetadata(id).tone

export const oppositeThemeTone = (tone: ThemeTone): ThemeTone => (tone === "dark" ? "light" : "dark")

export const pairedThemeId = (id: ThemeId, tone: ThemeTone): ThemeId | null => {
	const pairedId = pairedThemeIds[id]
	return pairedId && themeToneForThemeId(pairedId) === tone ? pairedId : null
}

export const filterThemeMetadata = (query: string, tone: ThemeTone = "dark"): readonly ThemeMetadata[] => {
	const normalized = query.trim().toLowerCase()
	const matchingTone = themeMetadataCatalog.filter((theme) => theme.tone === tone)
	if (normalized.length === 0) return matchingTone
	return matchingTone.filter((theme) => theme.id.includes(normalized) || theme.name.toLowerCase().includes(normalized) || theme.description.toLowerCase().includes(normalized))
}
