export function createSceneGraph(initial = {}) {
  return {
    type: "drawing",
    items: [],
    coordinates: {},
    ...initial
  };
}

export function appendSceneItem(scene, item) {
  scene.items.push(item);
  return scene;
}

export function sceneItems(scene) {
  return scene.items || [];
}
