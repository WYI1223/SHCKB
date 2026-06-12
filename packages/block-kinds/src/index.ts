export * from './types';
export * from './registry';
export { PublishedCanvas, pageBackgroundStyle, type PublishedDocShape } from './PublishedCanvas';
export { DefaultBlockFrame, DefaultCanvasSurface, DefaultPageTitle } from './frames';
// static.ts is deliberately NOT exported here — it pulls react-dom/server,
// which the web bundle must never see. Server imports '@skb/block-kinds/static'.
