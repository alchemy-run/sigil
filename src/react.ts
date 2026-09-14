// Sigil ships its own React. Consumers reach React's runtime through this
// entry (and `jsxImportSource: "@alchemy.run/sigil"`) so the hooks a component
// calls and the dispatcher the reconciler installs share one module identity.
//
// `@types/react` is an `export =` module, so `export *` is rejected at the type
// level; the runtime surface is enumerated instead. Types stay type-only
// imports from `react` (erased at runtime, so no identity concern).
export {
  Activity,
  Children,
  Component,
  Fragment,
  Profiler,
  PureComponent,
  StrictMode,
  Suspense,
  ViewTransition,
  act,
  addTransitionType,
  cache,
  cacheSignal,
  captureOwnerStack,
  cloneElement,
  createContext,
  createElement,
  createRef,
  forwardRef,
  isValidElement,
  lazy,
  memo,
  startTransition,
  use,
  useActionState,
  useCallback,
  useContext,
  useDebugValue,
  useDeferredValue,
  useEffect,
  useEffectEvent,
  useId,
  useImperativeHandle,
  useInsertionEffect,
  useLayoutEffect,
  useMemo,
  useOptimistic,
  useReducer,
  useRef,
  useState,
  useSyncExternalStore,
  useTransition,
  version,
} from "react";
export { default } from "react";
