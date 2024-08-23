# cesium-drawTool

一个基于 Cesium、可用于进行多边形 polygon 的绘制、编辑、删除操作。

## Usage

1.使用 script 标签引入到 Html 文件中

` <script type="text/javascript" async src="/gptDraw.js"></script>`

2.实例化对象

`const drawTools = new DrawTools();`

3.使用

`drawTools.init(viewer);` // 开始绘制

`drawTools.destory();` // 结束绘制状态
