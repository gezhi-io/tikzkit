# TikZKit 使用指南

TikZKit 是一个仍在测试中的纯 JavaScript TikZ 解释器。浏览器和 Node.js
渲染不会调用本机 LaTeX；本机 MacTeX 与 `tikztosvg` 只用于开发时对照。

## 1. 启动网页编辑器

```bash
npm install
npm run web
```

在浏览器打开 <http://127.0.0.1:5173/>。页面可以选择维护中的案例、编辑源码，
并显示 TikZKit 的 SVG 与诊断结果。

已有一个网页服务时，启动独立端口：

```bash
PORT=5174 npm run web
```

然后访问 <http://127.0.0.1:5174/>。网页修改后刷新即可；服务对静态文件与案例
目录使用 `no-store`，不需要手动清理浏览器缓存。

## 2. 转换一个文件

```bash
node bin/tikz2svg.js path/to/diagram.tex -o outputs/diagram.svg
```

省略 `-o` 时，会在输入文件旁写入同名 `.svg`。`outputs/` 是本地生成目录，已经
被 Git 忽略，适合放临时 SVG、PNG 和视觉对照，不应加入兼容性提交。

## 3. 在 JavaScript 中调用

```js
import { tikzToSvg } from "./src/index.js";

const source = String.raw`
\begin{tikzpicture}
  \draw[->] (0,0) -- (2,1) node[right] {$x$};
\end{tikzpicture}`;

const result = tikzToSvg(source);

if (result.diagnostics.length) {
  console.warn(result.diagnostics);
}
document.querySelector("#preview").innerHTML = result.svg;
```

常用接口：

- `parseTikz(source)`：源码到 AST。
- `interpretTikz(ast)`：AST 到绘图 IR。
- `renderSvg(ir)`：IR 到 SVG 字符串。
- `tikzToSvg(source)`：一次完成解析、解释和 SVG 输出。

当 PNG 或 SVG 比较工具不支持 `foreignObject` 时，传入
`{ mathRenderer: "svg-text" }`，让数学内容走兼容的 SVG 文本输出。

## 4. 验证一个真实案例

一次兼容性改动不能只看网页“有图”。先盘点语义，再生成三份参考：

```bash
# 列出案例使用的 package、library、命令、参数、数值和表达式。
npm run case:audit -- path/to/case.tex \
  --output outputs/case-audit.md \
  --init-review outputs/case-review.json

# 生成 TikZKit、tikztosvg、MacTeX 的 SVG/PNG，以及带 1cm 网格的版本。
npm run examples:render -- --fixtures test/fixtures/examples \
  --only <fixture-id> \
  --output outputs/qa-my-change \
  --native-reference \
  --comparison-grid-mode svg \
  --strict-tikztosvg

# 生成差异图与同页对照。
npm run examples:diff -- --output outputs/qa-my-change \
  --register --alignment-radius 3
```

打开 `outputs/qa-my-change/index.html`，逐项检查：

1. 图元是否缺失，包括节点、箭头、填充、图片和图例。
2. 坐标原点、尺度、裁剪与边界框是否一致；网格只辅助判断，不能代替几何检查。
3. 字体、公式、标签锚点、线宽、颜色、透明度和绘制层次是否一致。
4. TikZKit、`tikztosvg` 与 MacTeX 是否在同一处偏差；最终以 MacTeX 为准。

差分数值仅用于发现候选问题。接收修改前仍须实际看 JS、`tikztosvg`、MacTeX 与
diff 面板，写下可见的修复前后变化和遗留边界。

## 5. 日常检查与提交

```bash
# 维护案例的语义检查；当前预期为 274/274 rendered, 0 diagnostics。
npm run gallery:audit

# 只运行正在修改的功能测试，例如 multipart。
node --test test/shapes-multipart-vertical.test.js

# package/library 行为改动后，重建支持登记表。
npm run extension-registry

# 提交前检查空白与冲突标记。
git diff --check
```

完整 `npm test` 适合观察实验性基线，但不是当前发布门槛；其中仍有已知的历史失败。
提交一个功能时，应只包含共享实现、最小回归测试、对应 fixture、registry 更新和
`docs/qa/` 的视觉验收记录。不要加入 `outputs/`、`output/` 或浏览器临时截图。

## 6. 常见问题

**网页打不开或端口被占用**：使用 `PORT=5174 npm run web` 启动另一份服务，确认
访问的端口与终端输出一致。

**SVG 出来了但与 LaTeX 不一样**：先看 `result.diagnostics`，然后用第 4 节的命令
做三方对照。无诊断只表示已处理，不表示视觉兼容。

**本机没有 `tikztosvg`**：网页与 CLI 仍可使用；视觉验收会少一份独立 SVG 参照。
不要在浏览器流程中联网安装它，先记录缺失原因并使用本机 MacTeX 作为原生基准。

**需要了解某个 library 是否已实现**：查看 `docs/extension-registry.md`，再到
`src/tikz/libraries/` 找对应名称文件。条目的 `partial` 状态意味着只有登记的功能
族经过真实案例验证，不代表整个 TikZ library 已完成。
