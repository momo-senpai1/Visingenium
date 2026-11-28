import * as runtime from 'react/jsx-runtime';
import { wrapProps } from './wrap';

export type { JSX } from 'react/jsx-runtime';
export const Fragment = runtime.Fragment;
export const jsx: typeof runtime.jsx = (type, props, key) => runtime.jsx(type, wrapProps(type, props), key);
export const jsxs: typeof runtime.jsxs = (type, props, key) => runtime.jsxs(type, wrapProps(type, props), key);
