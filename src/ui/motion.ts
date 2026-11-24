// 设计系统规定：React 里需要弹簧的地方（分段滑块、抽屉、拖拽松手）统一用这一组参数，不另调。
export const spring = { type: "spring", stiffness: 420, damping: 36 } as const;
