// Compare event paint independently of font rasterization and document cropping.
export async function captureChronologyPaint(page, { shaftColor = "rgb(0, 0, 0)" } = {}) {
  return page.evaluate(shaftColor => {
    const svg = document.querySelector("svg").getBoundingClientRect();
    const paths = [...document.querySelectorAll("svg path")].filter(p => !p.closest("defs, clipPath, mask"));
    const shafts = paths.filter(p => {
      const style = getComputedStyle(p), box = p.getBoundingClientRect();
      // A page-wide theme progress rule is not a chronology shaft.
      return style.stroke === shaftColor && box.height < .001 && box.width > 10;
    }).map(p => p.getBoundingClientRect()).sort((a, b) => b.width - a.width);
    if (!shafts.length) throw new Error("Expected a horizontal chronology shaft");
    const origin = { x: shafts[0].x - svg.x, y: shafts[0].y - svg.y };
    const events = paths.flatMap(p => {
      const style = getComputedStyle(p);
      let opacity = Number(style.fillOpacity);
      for (let el = p; el && el !== document; el = el.parentElement) opacity *= Number(getComputedStyle(el).opacity);
      if (style.fill === "none" || Math.abs(opacity - .5) > 1e-6) return [];
      const box = p.getBoundingClientRect();
      return [{ x: box.x - svg.x - origin.x, y: box.y - svg.y - origin.y,
        width: box.width, height: box.height, fill: style.fill, opacity,
        stroke: style.stroke }];
    });
    return { origin, events };
  }, shaftColor);
}

export function compareChronologyPaint(actual, reference, expectedEvents) {
  const matching = actual.events.length === expectedEvents && reference.events.length === expectedEvents;
  const boundsErrorPx = matching ? Math.max(0, ...actual.events.flatMap((event, i) =>
    ["x", "y", "width", "height"].map(key => Math.abs(event[key] - reference.events[i][key])))) : null;
  const paintMatches = matching && actual.events.every((event, i) => event.stroke === "none" &&
    event.stroke === reference.events[i].stroke && event.fill === reference.events[i].fill &&
    Math.abs(event.opacity - reference.events[i].opacity) < 1e-6);
  return { events: actual.events.length, referenceEvents: reference.events.length, boundsErrorPx, paintMatches,
    accepted: matching && paintMatches && boundsErrorPx < .09 };
}
