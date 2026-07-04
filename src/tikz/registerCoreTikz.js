import { tikzCommandCatalog } from "../commands/index.js";
import { tikzLibraryCatalog } from "../libraries/index.js";

export function createTikzRegistry() {
  const commands = new Map();
  const libraries = new Map();

  return {
    commands,
    libraries,
    registerCommand(command) {
      if (command?.name) commands.set(command.name, command);
      return this;
    },
    registerLibrary(library) {
      if (library?.name) libraries.set(library.name, library);
      return this;
    },
    getCommand(name) {
      return commands.get(name);
    },
    getLibrary(name) {
      return libraries.get(name);
    }
  };
}

export function registerCoreTikz(registry = createTikzRegistry()) {
  for (const command of Object.values(tikzCommandCatalog)) {
    registry.registerCommand(command);
  }
  for (const library of Object.values(tikzLibraryCatalog)) {
    registry.registerLibrary(library);
  }
  return registry;
}
