import '@testing-library/jest-dom/vitest';

window.ResizeObserver = class {
  observe(): void {}
  unobserve(): void {}
  disconnect(): void {}
};
