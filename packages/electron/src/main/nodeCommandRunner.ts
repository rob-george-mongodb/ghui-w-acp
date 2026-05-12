import { spawn } from "node:child_process"
import { Effect } from "effect"
import { CommandError, makeCommandRunnerLayer } from "@ghui/core/node"

const collectStream = (stream: NodeJS.ReadableStream): Promise<string> =>
	new Promise((resolve, reject) => {
		const chunks: Buffer[] = []
		stream.on("data", (chunk: Buffer) => chunks.push(chunk))
		stream.on("end", () => resolve(Buffer.concat(chunks).toString("utf-8")))
		stream.on("error", reject)
	})

const runProcess = Effect.fn("CommandRunner.runProcess")((command: string, args: readonly string[], stdin: string | undefined) =>
	Effect.tryPromise({
		async try() {
			const proc = spawn(command, [...args], {
				stdio: [stdin !== undefined ? "pipe" : "ignore", "pipe", "pipe"],
				env: {
					...process.env,
					PATH: process.env.PATH ?? "/usr/local/bin:/opt/homebrew/bin:/usr/bin:/bin",
				},
			})
			if (stdin !== undefined && proc.stdin) {
				proc.stdin.write(stdin)
				proc.stdin.end()
			}
			const [stdout, stderr, exitCode] = await Promise.all([
				collectStream(proc.stdout!),
				collectStream(proc.stderr!),
				new Promise<number>((resolve, reject) => {
					proc.on("close", (code) => resolve(code ?? 1))
					proc.on("error", reject)
				}),
			])
			return { stdout, stderr, exitCode }
		},
		catch: (cause) => new CommandError({ command, args: [...args], detail: `Failed to run ${command}`, cause }),
	}),
)

export const NodeCommandRunner = {
	layer: makeCommandRunnerLayer(runProcess),
}
