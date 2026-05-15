import { sleep } from "bun";
import { CODEGEN_CACHE_DIR } from "./cache";

const BURGER_OUTPUT = `${CODEGEN_CACHE_DIR}/burger-output.json`;

export async function getBurgerData(jar: string) {
  const outputFile = Bun.file(BURGER_OUTPUT);

  if (!await outputFile.exists()) {
    console.log(`Generating burger data for ${jar}...`);
    const proc = Bun.spawn({
      cmd: ["uv", "run", "munch.py", "../../" + jar, "--output", `../../${BURGER_OUTPUT}`],
      cwd: "codegen/azalea-burger",
    });

    await proc.exited;
    if (proc.exitCode != 0) {
      throw new Error(`Code generation failed with exit code ${proc.exitCode}`);
    }
    if (!outputFile.exists()) throw new Error("Output file does not exist (it should've generated?), please try again.");
  } else {
    console.log(`Burger data already generated for ${jar}, skipping...`);
  }

  await sleep(100);
  const output = await outputFile.json() as any[];
  if (!Array.isArray(output) || output.length == 0) throw new Error("Output file is not in the expected format (array) or is empty, please try again.");
  return output[0];
}