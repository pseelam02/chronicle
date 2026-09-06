import { VERSION, type Options } from "../shared/model.ts";
export const HELP = `Chronicle ${VERSION} — your code, through time\n\nUsage: chronicle [repository] [options]\n\n  --ref <ref>          Starting ref (default HEAD)\n  --port <port>        Local port (default automatically assigned)\n  --no-open            Do not open browser\n  --force              Rebuild analysis cache\n  --no-ai              Disable external AI completely\n  --model <model>      OpenAI model (or OPENAI_MODEL)\n  --checkpoints <n>    Historical checkpoint limit, 2–50 (default 12)\n  --demo               Bundled offline history\n  --help               Show help\n  --version            Show version\n`;
export function parseArgs(args: string[]): Options {
  const o: Options = {
    path: ".",
    ref: "HEAD",
    port: 0,
    open: true,
    force: false,
    ai: true,
    model: process.env.OPENAI_MODEL || "gpt-4.1-mini",
    demo: false,
    checkpoints: 12,
  };
  let path = false;
  for (let i = 0; i < args.length; i++) {
    const a = args[i];
    if (a === "--no-open") o.open = false;
    else if (a === "--force") o.force = true;
    else if (a === "--no-ai") o.ai = false;
    else if (a === "--demo") o.demo = true;
    else if (["--ref", "--port", "--model", "--checkpoints"].includes(a)) {
      const v = args[++i];
      if (!v || v.startsWith("-")) throw Error(`Missing value for ${a}`);
      if (a === "--ref") o.ref = v;
      else if (a === "--model") o.model = v;
      else if (a === "--port") o.port = Number(v);
      else o.checkpoints = Number(v);
    } else if (a.startsWith("-")) throw Error(`Unknown option: ${a}`);
    else if (path) throw Error("Only one repository may be opened");
    else {
      o.path = a;
      path = true;
    }
  }
  if (!Number.isInteger(o.port) || o.port < 0 || o.port > 65535)
    throw Error("Port must be 0–65535");
  if (
    !Number.isInteger(o.checkpoints) ||
    o.checkpoints < 2 ||
    o.checkpoints > 50
  )
    throw Error("Checkpoints must be 2–50");
  return o;
}
