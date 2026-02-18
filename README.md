# MineBot AI

An AI assistant that lives inside Minecraft. Chat with it using `!ai` in-game to ask questions, run commands, build structures, and render pixel art — all powered by a Botpress AI agent.

```
Player types: !ai build a castle with towers
MineBot:      [Step 1/3: Building the foundation...]
              [Step 2/3: Adding walls and towers...]
              [Step 3/3: Finishing the roof...]
              [Done! Built a castle with 4 towers.]
```

## Architecture

```
┌─────────────────┐       HTTP        ┌──────────────────┐    Botpress Chat API    ┌──────────────────┐
│  Fabric Mod      │  ──────────────►  │  Bridge Server    │  ────────────────────►  │  ADK Agent        │
│  (Minecraft)     │  ◄──────────────  │  (Express/TS)     │  ◄────────────────────  │  (Botpress Cloud) │
│                  │    JSON response  │                   │     AI classification  │                   │
│  - Chat intercept│                   │  - Rate limiting   │                        │  - Intent classify │
│  - Command exec  │                   │  - Pixel art proc  │                        │  - Player memory   │
│  - Builder engine│                   │  - Session mgmt    │                        │  - Minecraft KB    │
└─────────────────┘                   └──────────────────┘                         └──────────────────┘
```

1. The **Fabric mod** intercepts `!ai` messages in chat and sends them to the bridge server over HTTP
2. The **Bridge server** forwards the message to Botpress Cloud via direct Chat API REST calls (`fetch`) and waits for a reply
3. The **ADK agent** classifies intent (chat, command, build, worldedit, pixelart) and returns structured JSON
4. The bridge sends the response back to the mod, which executes the appropriate action in-game

## Features

- **Chat** — Ask Minecraft questions, get helpful answers in-game
- **Commands** — "make it night", "give me diamonds", "kill all zombies"
- **Building** — "build a stone house", "build a 10x10 platform"
- **WorldEdit** — Complex multi-command builds with progress indicators and undo support
- **Pixel Art** — Render images as Minecraft pixel art from a URL
- **Player Memory** — Remembers preferences and build history per player

## Prerequisites

| Tool | Version | Install |
|---|---|---|
| Java (JDK) | 21+ | [Adoptium](https://adoptium.net/) |
| Node.js | 18+ | [nodejs.org](https://nodejs.org/) |
| Bun | latest | [bun.sh](https://bun.sh/) |
| Botpress ADK CLI | latest | `npm install -g @botpress/adk` |
| Botpress account | — | [botpress.com](https://botpress.com/) |
| Minecraft | 1.21.11 | [minecraft.net](https://www.minecraft.net/) |

## Setup

### 1. Clone the repo

```bash
git clone https://github.com/carsonSgit/minecraft-botpress.git
cd minecraft-botpress
```

### 2. Bridge Server

```bash
cd bridge-server
npm install
cp .env.example .env
```

Edit `.env` and set your Botpress webhook ID:

```
BOTPRESS_WEBHOOK_ID=<your-webhook-id>
PORT=3000
```

To find your webhook ID: in the [Botpress Dashboard](https://app.botpress.cloud/), open your bot, go to **Integrations > Chat**, and copy the webhook ID from the API URL (`https://chat.botpress.cloud/<this-part>`).

Start the server:

```bash
npm run dev
```

### 3. ADK Agent

```bash
cd minebot-agent
bun install
```

Log in to Botpress and start the dev server:

```bash
adk login
adk dev
```

The agent console will be available at `http://localhost:3001`. Make sure the agent is running before testing in-game.

### 4. Fabric Mod (Minecraft)

From the project root:

```bash
./gradlew build
```

The built mod JAR will be in `build/libs/`. Copy it to your Minecraft `mods/` folder, or run the dev client directly:

```bash
./gradlew runClient
```

This launches Minecraft with the mod loaded. Join any world (singleplayer or server) and type `!ai hello` in chat.

## Usage

| Command | What it does |
|---|---|
| `!ai <message>` | Send a message to the AI |
| `!ai help` | Show available commands |
| `!ai reset` | Clear conversation history |
| `!ai make it night` | Runs `/time set night` |
| `!ai give me 64 diamonds` | Runs `/give @s diamond 64` |
| `!ai build a stone house` | Builds a house near you |
| `!ai build a castle` | Multi-step WorldEdit build with progress |
| `!ai undo` | Undoes the last build |
| `!ai render pixel art of <url>` | Renders an image as blocks |

## Project Structure

```
├── src/client/java/com/botpress/   # Fabric mod (Java)
│   ├── chat/ChatInterceptor.java   #   !ai message interception
│   ├── network/HttpBridge.java     #   HTTP client to bridge server
│   ├── command/CommandExecutor.java #   Whitelisted command execution
│   └── build/BuilderEngine.java    #   Simple structure builder
├── bridge-server/                  # Bridge server (TypeScript)
│   └── src/
│       ├── index.ts                #   Express routes
│       ├── botpress-service.ts     #   Botpress Chat API REST client (fetch)
│       ├── pixel-art.ts            #   Image-to-setblock converter
│       ├── rate-limiter.ts         #   Per-player rate limiting
│       ├── validator.ts            #   Response parsing/validation
│       └── whitelist.ts            #   Command whitelist
└── minebot-agent/                  # Botpress ADK agent
    └── src/
        ├── conversations/index.ts  #   Intent classification handler
        ├── tables/                 #   Player prefs & build history
        └── knowledge/              #   Minecraft knowledge base
```

## Tech Stack

- **Minecraft Mod**: Java 21, Fabric API 0.141.3, Minecraft 1.21.11
- **Bridge Server**: Node.js, Express, TypeScript, Sharp (pixel art)
- **AI Agent**: Botpress ADK, `@botpress/runtime`

## License

MIT
