# AGORA -- Agent Group Orchestration and Runtime Architecture

AGORA is a framework for orchestrating groups of AI agents. It provides a shared communication bus (email server), XML-based agent configuration, and a terminal dashboard for monitoring agent activity.

## Install

```bash
npm install agora-framework
```

Requires **Node.js >= 20**.

## Setup

```bash
# Scaffold a new .agora/ project directory
npx agora init

# Start the email server
npx agora start

# Open the TUI dashboard
npx agora mail
```

## Documentation

See [agora/README.md](agora/README.md) for full documentation including architecture, CLI reference, API endpoints, and agent configuration.

## Links

- [agora-framework on npm](https://www.npmjs.com/package/agora-framework)
- [GitHub Repository](https://github.com/Jtonna/AGORA--Agent-Group-Orchestration-and-Runtime-Architecture)

## License

MIT
