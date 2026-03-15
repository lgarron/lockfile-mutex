.PHONY: build
build: build-js build-types

.PHONY: check
check: lint test build check-package.json

.PHONY: build-js
build-js: setup
	bun run ./script/build-js.ts

.PHONY: build-types
build-types: setup
	bun x tsc --project ./tsconfig.build.json

.PHONY: test
test: setup
	bun test
	cd ./.temp && bun run ../test/example1.ts
	cd ./.temp && bun run ../test/example2.ts
	cd ./.temp && bun run ../test/example3.ts

.PHONY: lint
lint: lint-biome lint-tsc lint-readme

.PHONY: lint-biome
lint-biome: setup
	bun x @biomejs/biome check

.PHONY: lint-tsc
lint-tsc: setup
	bun x tsc --noEmit --project .

.PHONY: lint-readme
lint-readme:
	bun x readme-cli-help check

.PHONY: format
format: setup
	bun x @biomejs/biome check --write
	bun x readme-cli-help update

.PHONY: check-package.json
check-package.json:
	bun x --package @cubing/dev-config package.json check

.PHONY: setup
setup:
	bun install --frozen-lockfile

RM_RF = bun -e 'process.argv.slice(1).map(p => process.getBuiltinModule("node:fs").rmSync(p, {recursive: true, force: true, maxRetries: 5}))' --

.PHONY: clean
clean:
	${RM_RF} ./.temp/ ./dist/

.PHONY: reset
reset: clean
	${RM_RF} ./node_modules/

.PHONY: publish
publish:
	npm publish

.PHONY: prepublishOnly
prepublishOnly: clean check build
