# Local Development & Testing

How to build, run, and install the CLI locally without publishing to npm.

---

## Prerequisites

- Node.js >= 18
- npm

---

## 1. Install dependencies

```bash
npm install
```

---

## 2. Run without building (dev mode)

Uses `ts-node` to execute TypeScript directly — no build step needed.

```bash
npm run dev -- <command>

# Examples:
npm run dev -- wallet list
npm run dev -- tokens list
npm run dev -- --help
```

> Arguments after `--` are passed to the CLI.

---

## 3. Build and run from dist

```bash
npm run build
node dist/index.js <command>

# Examples:
node dist/index.js wallet list
node dist/index.js tokens list
node dist/index.js --help
```

---

## 4. Install globally on your machine (`npm link`)

`npm link` installs the package globally and symlinks the `whales` binary to your PATH — exactly like `npm install -g`, but from local source.

```bash
# In the project root:
npm run build
npm link

# Now use it like the published CLI:
whales --help
whales wallet list
whales tokens list
```

To unlink when done:

```bash
npm unlink -g whale-market-cli
```

---

## 5. Install into another local project

If you have another project that depends on this CLI:

```bash
# From the other project's directory:
npm install /path/to/whale-market-cli

# Or use a relative path:
npm install ../whale-market-cli
```

---

## 6. Watch mode (auto-rebuild on save)

```bash
npx tsc --watch
```

Then in a second terminal:

```bash
node dist/index.js <command>
```

Or combine with `nodemon`:

```bash
npx nodemon --watch dist dist/index.js -- <command>
```

---

## 7. Run tests

```bash
npm test
```

---

## Quick reference

| Goal | Command |
|------|---------|
| Run without building | `npm run dev -- <command>` |
| Build | `npm run build` |
| Run built output | `node dist/index.js <command>` |
| Install globally (local) | `npm run build && npm link` |
| Remove global install | `npm unlink -g whale-market-cli` |
| Type-check only | `npx tsc --noEmit` |
| Watch & rebuild | `npx tsc --watch` |
