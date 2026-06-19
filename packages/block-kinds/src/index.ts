export * from './types';
export * from './links';
export * from './registry';
export { PublishedCanvas, pageBackgroundStyle, type PublishedDocShape } from './PublishedCanvas';
export { DefaultCanvasSurface, DefaultPageTitle } from './frames';
export { BlockFrameCore, type BlockFrameCoreProps } from './BlockFrameCore';
// static.ts is deliberately NOT exported here — it pulls react-dom/server,
// which the web bundle must never see. Server imports '@skb/block-kinds/static'.
