import { describe, expect, test } from "bun:test"
import { filterThemeDefinitions, pairedThemeId, themeToneForThemeId } from "../src/ui/colors.js"

describe("filterThemeDefinitions", () => {
	test("keeps dark and light themes in separate lists", () => {
		expect(filterThemeDefinitions("", "dark").map((theme) => theme.id)).toContain("ghui")
		expect(filterThemeDefinitions("", "dark").map((theme) => theme.id)).not.toContain("catppuccin-latte")
		expect(filterThemeDefinitions("", "light").map((theme) => theme.id)).toEqual(["catppuccin-latte", "rose-pine-dawn", "gruvbox-light", "one-light", "solarized-light"])
	})

	test("filters only within the selected tone", () => {
		expect(filterThemeDefinitions("catppuccin", "dark").map((theme) => theme.id)).toEqual(["catppuccin"])
		expect(filterThemeDefinitions("catppuccin", "light").map((theme) => theme.id)).toEqual(["catppuccin-latte"])
	})
})

describe("themeToneForThemeId", () => {
	test("identifies light theme variants", () => {
		expect(themeToneForThemeId("solarized-light")).toBe("light")
		expect(themeToneForThemeId("solarized-dark")).toBe("dark")
	})
})

describe("pairedThemeId", () => {
	test("returns the matching light or dark variant when one exists", () => {
		expect(pairedThemeId("catppuccin", "light")).toBe("catppuccin-latte")
		expect(pairedThemeId("catppuccin-latte", "dark")).toBe("catppuccin")
		expect(pairedThemeId("ghui", "light")).toBeNull()
	})
})
