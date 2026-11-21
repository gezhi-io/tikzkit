import { createWorkbenchServer } from "../web/server.js";

// Exercise the same editor, import map and async renderer as the interactive
// page. Read back the SVG that the user actually sees, not a Node-side export.
export async function openWorkbenchAudit(browser, fixtureRoot, outputRoot) {
  const server = await createWorkbenchServer({ fixtureRoot, outputRoot });
  const page = await browser.newPage();
  const errors = [];
  page.on("pageerror", error => errors.push(error.message));
  const close = async () => {
    await page.close();
    if (server.listening) await new Promise(resolve => server.close(resolve));
  };
  try {
    await new Promise((resolve, reject) => server.once("error", reject).listen(0, "127.0.0.1", resolve));
    await page.goto(`http://127.0.0.1:${server.address().port}/#tikzkit-scratch`);
    await page.locator("#grid-toggle").uncheck();
  } catch (error) {
    await close();
    throw error;
  }
  return {
    close,
    async render(id, source) {
      await page.locator("#fixture-select").selectOption(id);
      await page.waitForFunction(({ id, source }) =>
        document.querySelector("#fixture-select").value === id &&
        document.querySelector(".CodeMirror")?.CodeMirror.getValue() === source &&
        document.querySelector("#render-status").textContent.includes("diagnostics") &&
        !document.querySelector("#render-button").disabled &&
        document.querySelector("#tikzkit-result:not(.is-stale) svg"), { id, source });
      const result = await page.evaluate(async () => {
        await document.fonts.ready;
        return {
          svg: new XMLSerializer().serializeToString(document.querySelector("#tikzkit-result svg")),
          diagnostics: [...document.querySelectorAll("#diagnostics .diagnostic")].map(el => el.textContent)
        };
      });
      if (errors.length) throw new Error(`Workbench page error for ${id}: ${errors.join("; ")}`);
      return result;
    }
  };
}
