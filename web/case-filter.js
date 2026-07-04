export function parseCaseFilter(args, envValue) {
  const values = [];
  for (let index = 0; index < args.length; index += 1) {
    const arg = String(args[index] ?? "");
    if (arg === "--case" || arg === "--cases") {
      index += 1;
      while (index < args.length && !String(args[index]).startsWith("--")) {
        values.push(args[index]);
        index += 1;
      }
      index -= 1;
    } else if (arg.startsWith("--case=")) {
      values.push(arg.slice("--case=".length));
    } else if (arg.startsWith("--cases=")) {
      values.push(arg.slice("--cases=".length));
    }
  }
  if (envValue) values.push(envValue);
  return new Set(
    values
      .flatMap((value) => String(value).split(","))
      .map((value) => value.trim().toLowerCase())
      .filter(Boolean)
  );
}
