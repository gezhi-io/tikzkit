import { nativePlotSuite } from "./helpers/native-plot-trace.js";

nativePlotSuite("smooth", new URL("./fixtures/native-smooth-plot-tests/", import.meta.url));
