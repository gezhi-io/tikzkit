const PGF_RANDOM_MODULUS = 2147483647;
const PGF_RANDOM_MULTIPLIER = 69621;
const PGF_RANDOM_QUOTIENT = 30845;
const PGF_RANDOM_REMAINDER = 23902;

export function nextPgfRandomState(seed) {
  const state = normalizedPgfRandomSeed(seed);
  const quotient = Math.trunc(state / PGF_RANDOM_QUOTIENT);
  const remainder = state - quotient * PGF_RANDOM_QUOTIENT;
  let next = PGF_RANDOM_MULTIPLIER * remainder - PGF_RANDOM_REMAINDER * quotient;
  if (next < 0) next += PGF_RANDOM_MODULUS;
  return next;
}

export function pgfRandomRndStep(seed) {
  const state = nextPgfRandomState(seed);
  return { state, value: (state % 100001) / 100000 };
}

export function pgfRandomRandStep(seed) {
  const state = nextPgfRandomState(seed);
  return { state, value: ((state % 200001) - 100000) / 100000 };
}

export function createPgfRandom(seed = 1) {
  let state = normalizedPgfRandomSeed(seed);
  const api = () => api.rand();

  api.setSeed = (value) => {
    state = normalizedPgfRandomSeed(value);
    return state;
  };
  api.getSeed = () => state;
  api.nextInteger = () => {
    state = nextPgfRandomState(state);
    return state;
  };
  api.rnd = () => (api.nextInteger() % 100001) / 100000;
  api.rand = () => ((api.nextInteger() % 200001) - 100000) / 100000;
  api.integer = (max, min = 1) => {
    const lower = Math.trunc(Number(min));
    const upper = Math.trunc(Number(max));
    const from = Number.isFinite(lower) ? lower : 1;
    const to = Number.isFinite(upper) ? upper : from;
    const start = Math.min(from, to);
    const width = Math.max(1, Math.abs(to - from) + 1);
    return start + (api.nextInteger() % width);
  };

  return api;
}

function normalizedPgfRandomSeed(value) {
  const number = Number(value);
  return Math.trunc(Number.isFinite(number) ? number : 1);
}
