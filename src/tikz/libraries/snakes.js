export const tikzLibrary = {
  "name": "snakes",
  "status": "partial",
  "implementedBy": "src/engine/evaluate.js:legacySnakeSpec/applyLegacySnakePath/appendLegacySnakeLine",
  "localSourceReviewed": true,
  "features": [
    "legacy snake and snake=zigzag path options",
    "legacy line/gap before, after, and around snake controls",
    "legacy mirror snake and raise snake transforms"
  ],
  "implements": [
    "legacy snakes compatibility subset"
  ],
  "notes": "MacTeX's deprecated snakes library forwards to decorations, but its legacy `snake` option still morphs every individual `--` command. TikZKit maps the default to zigzag and supports snake=snake, segment amplitude/length, mirror/raise, and line/gap before/after/around controls. Custom pgfdeclaresnake states and old triangle object shapes remain deferred."
};
