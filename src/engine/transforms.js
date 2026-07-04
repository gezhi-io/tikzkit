export function identityTransform() {
  return { a: 1, b: 0, c: 0, d: 1, e: 0, f: 0 };
}

export function applyTransform(point, transform = identityTransform()) {
  return {
    x: transform.a * point.x + transform.c * point.y + transform.e,
    y: transform.b * point.x + transform.d * point.y + transform.f
  };
}

export function composeTransforms(left = identityTransform(), right = identityTransform()) {
  return {
    a: left.a * right.a + left.c * right.b,
    b: left.b * right.a + left.d * right.b,
    c: left.a * right.c + left.c * right.d,
    d: left.b * right.c + left.d * right.d,
    e: left.a * right.e + left.c * right.f + left.e,
    f: left.b * right.e + left.d * right.f + left.f
  };
}
