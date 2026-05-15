import { downloadServerJar } from "./util/download";
import { generateTag, getRegistryTags } from "./util/tags";

const VERSION = "26.1";
const serverJar = await downloadServerJar();

const blockTags = await getRegistryTags(serverJar, "block");
const itemTags = await getRegistryTags(serverJar, "item");
const fluidTags = await getRegistryTags(serverJar, "fluid");
const entityTags = await getRegistryTags(serverJar, "entity_type");
await generateTag(blockTags, "blocks", "block");
await generateTag(itemTags, "items", "item");
await generateTag(fluidTags, "fluids", "fluid");
await generateTag(entityTags, "entities", "entity_type");