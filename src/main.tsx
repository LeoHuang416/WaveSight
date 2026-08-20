import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import { patchWebGLContext } from './utils/export';
import './styles/app.css';

// echarts-gl 3D 曲面导出 PNG 的前提：WebGL 上下文保留绘制缓冲
patchWebGLContext();

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
