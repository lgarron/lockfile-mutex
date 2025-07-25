.PHONY: build
build: build-js build-types

.PHONY: build-js
build-js: setup
	bun run ./script/build-js.ts

.PHONY: build-types
build-types: setup
	bun x tsc --project ./tsconfig.build.json

.PHONY: test
test: setup
	bun test
	bun run ./test/example1.ts
	bun run ./test/example2.ts
	bun run ./test/example3.ts

.PHONY: lint
lint: lint-biome lint-tsc

.PHONY: lint-biome
lint-biome: setup
	bun x @biomejs/biome check

.PHONY: lint-tsc
lint-tsc: setup
	bun x tsc --noEmit --project .

.PHONY: format
format: setup
	bun x @biomejs/biome check --write

.PHONY: setup
setup:
	bun install --frozen-lockfile

.PHONY: clean
clean:
	rm -rf ./.temp ./dist

.PHONY: reset
reset: clean
	rm -rf ./node_modules

.PHONY: publish
publish:
	npm publish

.PHONY: prepublishOnly
prepublishOnly: lint test clean build
