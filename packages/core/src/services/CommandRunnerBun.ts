import { Effect } from "effect"
import { CommandError, makeCommandRunnerLayer } from "./CommandRunner.js"

const readStream = async (stream: ReadableStream | null | undefined) => {
	if (!stream) return ""
	return Bun.readableStreamToText(stream)
}

const runProcess = Effect.fn("CommandRunner.runProcess")((command: string, args: readonly string[], stdin: string | undefined) =>
	Effect.tryPromise({
		async try() {
			const proc = Bun.spawn({
				cmd: [command, ...args],
				stdin: stdin === undefined ? "ignore" : "pipe",
				stdout: "pipe",
				stderr: "pipe",
			})
			if (stdin !== undefined && proc.stdin) {
				proc.stdin.write(stdin)
				proc.stdin.end()
			}

			const [exitCode, stdout, stderr] = await Promise.all([proc.exited, readStream(proc.stdout), readStream(proc.stderr)])
			return { stdout, stderr, exitCode }
		},
		catch: (cause) => new CommandError({ command, args: [...args], detail: `Failed to run ${command}`, cause }),
	}),
)

export const BunCommandRunner = {
	layer: makeCommandRunnerLayer(runProcess),
}
