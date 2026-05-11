import { mkdir } from "node:fs/promises"
import { dirname } from "node:path"
import { SqliteClient, SqliteMigrator } from "@effect/sql-sqlite-bun"
import { Effect, Layer } from "effect"
import * as Migrator from "effect/unstable/sql/Migrator"
import type { SqlError } from "effect/unstable/sql/SqlError"
import { CacheError, CacheService, applyPragmas, cacheMigrations } from "./CacheService.js"

export class BunCacheService {
	static readonly layerSqliteFile = (filename: string): Layer.Layer<CacheService, SqlError | Migrator.MigrationError | CacheError> => {
		const sqlLayer = SqliteClient.layer({ filename })
		const setupLayer = Layer.effectDiscard(
			Effect.gen(function* () {
				yield* applyPragmas
				yield* SqliteMigrator.run({ loader: Migrator.fromRecord(cacheMigrations), table: "ghui_cache_migrations" })
			}),
		)
		const liveLayer = Layer.mergeAll(setupLayer, CacheService.layerSqlite).pipe(Layer.provide(sqlLayer))
		return Layer.unwrap(
			Effect.tryPromise({
				try: () => mkdir(dirname(filename), { recursive: true }),
				catch: (cause) => new CacheError({ operation: "createCacheDirectory", cause }),
			}).pipe(Effect.as(liveLayer)),
		)
	}

	static readonly layerFromPath = (filename: string | null): Layer.Layer<CacheService> =>
		filename === null ? CacheService.disabledLayer : BunCacheService.layerSqliteFile(filename).pipe(Layer.catchCause(() => CacheService.disabledLayer))
}
