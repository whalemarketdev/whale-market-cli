# Quick Start - Whale Market CLI

## Install (recommended)

```bash
npm install -g whale-market-cli
```

Then use the `whales` command:

```bash
whales --version
whales --help
whales setup
whales tokens list
```

## Local development / run from source

```bash
# Clone and enter the repo
git clone https://github.com/whalemarketdev/whale-market-cli.git
cd whale-market-cli

# Install dependencies and build
npm install
npm run build

# Use via npm link (makes `whales` available globally from this build)
npm link
whales --version
whales tokens list --limit 5
```

Or run without linking:

```bash
node dist/index.js --help
node dist/index.js tokens list --limit 5
```

## First-time setup

Run the setup wizard to configure your wallet and API:

```bash
whales setup
```

See [README.md](README.md) for full documentation.
