# Section 25 - Transformations

本节记录 TikZ transformations 的完整工程语义。之前的 [06-transformations.md](./06-transformations.md) 是简版；本文件专门对齐 manual section 25，用于后续修复坐标错位、图形缩放、3D basis、node anchor、bbox 和 canvas transform 问题。

## Transformation Pipeline

TikZ 中一个坐标到最终屏幕位置，至少经过这些层：

```text
TikZ coordinate syntax
-> xy/xyz basis vectors
-> coordinate transformation matrix
-> backend/page placement
-> canvas transformation matrix
-> device transform
```

TikZ 用户主要接触前两层：

- `x/y/z` basis vector：决定 `(1,2,3)` 这种 factor coordinate 如何转成画布点。
- coordinate transformation matrix：`shift`、`scale`、`rotate`、`slant` 等常规变换。

PGF 也允许改 canvas transformation matrix，但手册明确警告：一旦改 canvas matrix，PGF 会很难继续准确追踪 node、anchor、shape 和 bounding box。

TikZKit 对应模型：

```text
env.basis        // x/y/z basis vectors
env.transform    // coordinate transformation matrix
env.canvasScale  // current simplified canvas scaling factor
```

## XY / XYZ Basis Vectors

TikZ 的 `(2,3)` 不是固定像素坐标，而是：

```text
2 * current x vector + 3 * current y vector
```

`(1,2,3)` 则是：

```text
1 * x vector + 2 * y vector + 3 * z vector
```

相关 key：

- `x=<dimension or coordinate>`
- `y=<dimension or coordinate>`
- `z=<dimension or coordinate>`

手册规则：

- `x=2cm` 表示 x vector 是 `(2cm,0)`。
- `y=2cm` 表示 y vector 是 `(0,2cm)`。
- `z=<dimension>` 表示 z vector 是 `(<dimension>,<dimension>)`。
- `x={(2cm,.5cm)}` 这种 coordinate form 可以让 x vector 指向任意方向。
- grid stepping 等 dimension 不受 x/y basis 缩放影响；basis 只影响坐标点。

TikZKit 当前状态：

- `src/interpreter.js:parsePictureBasis` / `composeBasis` 维护 `x/y/z` basis。
- `src/interpreter.js:parseBasisVector` 支持 dimension、coordinate tuple 和 polar basis。
- 已有 Section 13 坐标测试覆盖 canvas/xyz/mixed coordinate。
- 需要注意：当前 `parseBasisVector` 对 `z=<dimension>` 的 dimension form 看起来会回落到 `{x:0,y:0}`，与手册的 `(<dimension>,<dimension>)` 不一致；后续应补测试确认并修复。

## Coordinate Transformations

Coordinate transformation matrix 只影响坐标，不应直接缩放线宽、dash pattern、corner radius 或 shading angle。判断原则是：如果没有直接或间接 coordinate 参与，coordinate transform 通常不作用。

常见 key：

- `shift={(x,y)}`
- `xshift=<dimension>`
- `yshift=<dimension>`
- `scale=<factor>`
- `scale around={factor:coordinate}`
- `xscale=<factor>`
- `yscale=<factor>`
- `xslant=<factor>`
- `yslant=<factor>`
- `rotate=<degree>`
- `rotate around={degree:coordinate}`
- `rotate around x=<angle>`
- `rotate around y=<angle>`
- `rotate around z=<angle>`
- `cm={a,b,c,d,(coordinate)}`
- `reset cm`
- `shift only`

关键语义：

- transformation 是累积矩阵，不是直接覆盖。
- transformation 在 TeX group / scope 内局部生效。
- path 中间出现 `[xshift=...]` 这类 option 时，应立即影响后续坐标，而不是整条 path。
- 过大 scale、接近 0 的 scale 或奇异矩阵会让 PGF 难以反算 anchor/bbox，应产生 diagnostics 或降级。

TikZKit 当前状态：

- `src/interpreter.js:composeTransform` 维护 transform 合成。
- `src/interpreter.js:coordinateLocalTransform` 支持 `shift`、`xshift`、`yshift`、`scale`、`xscale`、`yscale`、`rotate`、`xslant`、`yslant`。
- `src/interpreter.js:parseShiftDimension` 已把裸 `xshift/yshift` 数字按 pt 解析，避免 `yshift=-120` 被误当成 cm。
- `src/interpreter.js:applyTransform` / `applyTransformVector` 负责点和向量变换。
- `src/parser.js:parsePgfTransformCm` 与 `src/interpreter.js:composePgfTransform` 支持低层 `\pgftransformcm{...}{...}{...}{...}{\pgfpoint{...}{...}}`。
- `\pgftransformreset` 已支持并把 transform 重置为 identity。
- `test/petarv-compat.test.js` 覆盖 `pgftransformcm` / `pgftransformreset`。
- `test/interpreter.test.js` 覆盖 `xscale/yscale` 不缩放普通 node shape、`xslant/yslant`、裸 shift 按 pt。

缺失或 partial：

- `scale around={...}` 尚未按 “平移到中心 -> scale -> 平移回来” 实现；当前 transform canvas parser 会读到 `scale around`，但 coordinate transform 中未见完整语义。
- `rotate around={...}` 尚未完整实现。
- `rotate around x/y/z` 对 xyz basis 的旋转尚未完整实现。
- TikZ key `cm={a,b,c,d,(coordinate)}` 尚未作为 option 完整处理；目前支持的是低层 `\pgftransformcm` statement。
- TikZ key `reset cm` 尚未作为 option 完整处理；目前支持的是低层 `\pgftransformreset` statement。
- `shift only` 尚未实现。
- path-stream 中间 `[transform options]` 对后续坐标的即时局部作用仍是待补重点。
- 奇异/病态矩阵没有系统 diagnostics。

## Canvas Transformations

Canvas transformation 是底层画布变换。它像把画布本身拉伸、旋转或移动：

- 线宽会跟着缩放。
- 文本和 node 可能也被拉伸。
- PGF 难以继续追踪 node position 和 picture size。
- 它作用于整条 path，不能像 coordinate transform 一样只影响 path 后半段。

TikZ key：

```tex
transform canvas={scale=2}
transform canvas={rotate=180}
```

TikZKit 当前状态：

- `src/interpreter.js:transformCanvasScale` 支持从 `transform canvas={scale=...}` 读取 scale。
- `env.canvasScale` 会影响部分 node geometry、text scale、line width、shadow 等。
- `test/petarv-compat.test.js` 覆盖 `transform canvas={scale=.5}` 对 scoped node geometry/text/line width 的影响。

缺失或 partial：

- `transform canvas={rotate=...}` 未完整支持。
- `transform canvas={xshift=...}` / `yshift` / slant / cm 等未完整支持。
- canvas transform 目前以 `canvasScale` 为主，不是完整 canvas matrix。
- 与手册严格语义不同：TikZKit 为了 Web bbox/viewBox 可用，仍会尽量追踪 scaled geometry；这有利于展示，但要在 native 对比中注意差异。

## Transform Shape

`transform shape` 不是 Section 25 的主线，但它是 Web 渲染中非常相关的 TikZ 行为：默认 coordinate transform 影响 node 的位置，不直接缩放 node shape/text；加 `transform shape` 后，node shape/text 才应随 transform 缩放/旋转。

TikZKit 当前状态：

- `src/interpreter.js:nodeOptionScale` / `transform shape` 相关逻辑已有部分实现。
- `test/petarv-compat.test.js` 覆盖 every-node `transform shape` 对 automata node geometry 和 labels 的影响。
- renderer 中 node rotation/text rotation 有单独处理。

缺口：

- rotate/scale/slant 对 node shape、text、anchor、outer sep 的组合语义仍需视觉校准。
- matrix 中 transform shape 与 TikZ 默认 “matrix typesetting 前重置 transform” 的关系仍需继续拆清楚。

## Implementation Plan

1. Transform option normalization
   - 把 `shift/xshift/yshift/scale/xscale/yscale/xslant/yslant/rotate/scale around/rotate around/cm/reset cm/shift only` 集中到 transform module。
   - 避免散落在 `interpreter.js` 中。

2. Full affine matrix support
   - `env.transform` 保持完整 2D affine matrix。
   - 增加 `translate/scale/rotate/slant/cm` helper。
   - 增加 inverse 和 singular diagnostics。

3. Basis vector correctness
   - 补 `z=<dimension>` -> `(dimension,dimension)`。
   - 补 `rotate around x/y/z` 对 xyz basis 的作用。
   - 与 tikz-3dplot 扩展共享 basis/projection 逻辑。

4. Path-stream transform support
   - parser 已能保留 path 中 option segment 时，应在 `buildPath` 内遇到 transform option 后更新后续坐标的 local transform。
   - 只影响后续 path coordinates，不回头改已经构造的 commands。

5. Canvas matrix support
   - 从 `canvasScale` 升级到 `canvasTransform` matrix。
   - renderer 输出 group transform 或提前 bake geometry，需要统一策略。
   - bbox/viewBox 应记录 canvas transform uncertainty。

6. Node transform shape calibration
   - 用 native/tikztosvg 对比 node position、box size、text size、anchor clipping。
   - 单独测试 `scale` vs `transform shape`、`rotate` vs `transform shape`、slanted node anchor。

## Visual QA Notes

Transformation 相关 case 不能只看图形大概位置：

- 线宽是否被 coordinate transform 意外缩放。
- node shape 是否默认保持原尺寸。
- `transform shape` 后 node/text 是否跟随缩放/旋转。
- `xshift/yshift` 裸数字是否按 pt。
- path 中间 transform 是否只影响后续坐标。
- rotated/scaled node anchor 是否仍能让箭头吸附边界。
- bbox/viewBox 是否包住 transformed geometry。
- canvas transform 是否影响 line width/text size。

## Case Notes

- Case 043: `xslant/yslant` 和裸 `yshift` 暴露斜切矩阵与 dimension 解析问题。
- PetarV transform cases: `\pgftransformcm` / `\pgftransformreset` 已有测试，说明低层 matrix statement 是真实 corpus 需求。
- Automata / TQFT cases: `transform shape` 决定 node shape、label 和 anchor 是否随 transform 缩放。
- 3D / tikz-3dplot cases: `x/y/z` basis 与 `rotate around x/y/z` 应作为同一套 basis-projection 问题处理。
