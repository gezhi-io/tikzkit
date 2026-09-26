import { parseOptions, tikzBoolean } from "../../engine/options.js";
import { applyPathMorphingDecoration } from "../libraries/decorations.pathmorphing.js";
import { applyBraceDecoration, applyTicksDecoration, applyBorderDecoration, applyWavesDecoration } from "../libraries/decorations.pathreplacing.js";
import { legacySnakeSpec, applyLegacySnakePath } from "../libraries/snakes.js";
import { applyKochSnowflakeDecoration } from "../libraries/decorations.fractals.js";

export function applyPathDecoration(commands, pathOptions, env) {
  const legacySnake = legacySnakeSpec(pathOptions, env);
  if (legacySnake) return applyLegacySnakePath(commands, legacySnake);
  if (!pathOptions.decorate) return commands;
  const decoration = parseOptions(String(pathOptions.decoration || ""));
  if (decoration.brace) return applyBraceDecoration(commands, decoration, env);
  if (decoration.border) return applyBorderDecoration(commands, decoration, env);
  if (decoration.ticks) return applyTicksDecoration(commands, decoration, env);
  if (decoration.waves || decoration["expanding waves"]) return applyWavesDecoration(commands, decoration, env);
  if (decoration["Koch snowflake"]) return applyKochSnowflakeDecoration(commands);
  return applyPathMorphingDecoration(commands, decoration, env);
}

export function supportedPathDecoration(options = {}) {
  const decoration = parseOptions(String(options.decoration || ""));
  return tikzBoolean(decoration.brace)
    || tikzBoolean(decoration.border)
    || tikzBoolean(decoration.ticks)
    || tikzBoolean(decoration.waves)
    || tikzBoolean(decoration["expanding waves"])
    || tikzBoolean(decoration["Koch snowflake"])
    || tikzBoolean(decoration.snake)
    || tikzBoolean(decoration.zigzag)
    || tikzBoolean(decoration["straight zigzag"])
    || tikzBoolean(decoration.coil)
    || tikzBoolean(decoration.saw)
    || tikzBoolean(decoration.bumps)
    || tikzBoolean(decoration.bent)
    || tikzBoolean(decoration["random steps"]);
}

export function decoratedSnakeOmitsArrowPaintBounds(pathOptions = {}) {
  if (!tikzBoolean(pathOptions.decorate)) return false;
  const decoration = parseOptions(String(pathOptions.decoration || ""));
  // PGF computes a snake's bounding box from its decorated path. Arrow tips
  // are installed afterwards, so their wing span does not enlarge the canvas.
  return tikzBoolean(decoration.snake);
}
