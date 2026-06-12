# 智能今日简报 PWA

## 使用
1. 上传本文件夹到 GitHub Pages 或 Cloudflare Pages。
2. 打开网页即可使用无后端版本。
3. 如果要提高抓取成功率，部署 `worker.js` 到 Cloudflare Worker。
4. 部署后，把 `index.html` 里的：

```js
const WORKER_BASE = "";
```

改成你的 Worker 地址，例如：

```js
const WORKER_BASE = "https://morning-brief.xxx.workers.dev";
```

## Cloudflare Worker 部署
1. 打开 Cloudflare Dashboard。
2. Workers & Pages → Create Worker。
3. 点 Edit code。
4. 删除原代码，粘贴 `worker.js` 里的全部内容。
5. Save and Deploy。
6. 复制 Worker 网址，填进前端的 `WORKER_BASE`。
