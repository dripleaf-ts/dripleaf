# @dripleaf/chat

Replacement for **prismarine-chat**. Includes `MessageBuilder` for composing chat components.

```ts
import { MessageBuilder, serialize } from "@dripleaf/chat"

const msg = new MessageBuilder().text("Hello ").trans("chat.type.hello", ["world"]).build()
```

TODO structure:

```ts
const builder = new MessageBuilder();
builder.
```