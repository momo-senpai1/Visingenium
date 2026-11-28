import * as runtime from 'react/jsx-dev-runtime';
import { wrapProps } from './wrap';

export type { JSX } from 'react/jsx-dev-runtime';
export const Fragment = runtime.Fragment;
export const jsxDEV: typeof runtime.jsxDEV = (type, props, key, isStatic, source, self) => runtime.jsxDEV(type, wrapProps(type, props), key, isStatic, source, self);
