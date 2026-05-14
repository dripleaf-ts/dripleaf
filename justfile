server:
    docker compose up -d papermc

server-stop:
    docker compose down

server-logs:
    docker compose logs -f papermc

example name="DripleafBot":
    bun run examples/chat_bot.ts localhost 25565 {{name}}

ping:
    bun run examples/ping.ts

test:
    bun run test_local.ts

check:
    npx tsc --noEmit
