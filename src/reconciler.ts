import { createContext } from "react";
import createReconciler, { type ReactContext } from "react-reconciler";
import { DefaultEventPriority, NoEventPriority } from "react-reconciler/constants.js";
import * as Scheduler from "scheduler";

import {
  createTextNode,
  appendChildNode,
  insertBeforeNode,
  removeChildNode,
  detachYogaSubtree,
  emitLayoutListeners,
  setStyle,
  setTextNodeValue,
  createNode,
  setAttribute,
  type DOMNodeAttribute,
  type TextNode,
  type ElementNames,
  type DOMElement,
} from "#/dom.ts";
import { isSigilDev } from "#/env.ts";
import type { SemanticTextStyle } from "#/semantic-text-style.ts";
import { styles as applyStyles, type Styles } from "#/styles.ts";
import { type AnsiTransformer } from "#/transform-adapter.ts";
import { Yoga } from "#/yoga/index.ts";

import pkg from "../package.json" with { type: "json" };

// We need to conditionally perform devtools connection to avoid
// accidentally breaking other third-party code.
// See https://github.com/vadimdemedes/ink/issues/384
// See https://github.com/vadimdemedes/ink/issues/648
if (isSigilDev) {
  // Intentionally no warning when the package is missing.
  // SIGIL_DEV may be set for other reasons; devtools is opt-in via installing the package.
  await import("#/devtools.ts").catch(() => {});
}

type AnyObject = Record<string, unknown>;

const diff = (before: AnyObject, after: AnyObject): AnyObject | undefined => {
  if (before === after) {
    return;
  }

  if (!before) {
    return after;
  }

  const changed: AnyObject = {};
  let isChanged = false;

  for (const key of Object.keys(before)) {
    const isDeleted = after ? !Object.hasOwn(after, key) : true;

    if (isDeleted) {
      changed[key] = undefined;
      isChanged = true;
    }
  }

  if (after) {
    for (const key of Object.keys(after)) {
      if (after[key] !== before[key]) {
        changed[key] = after[key];
        isChanged = true;
      }
    }
  }

  return isChanged ? changed : undefined;
};

const findRootNode = (node: DOMElement): DOMElement | undefined => {
  let current: DOMElement | undefined = node;

  while (current) {
    if (current.nodeName === "ink-root") {
      return current;
    }

    current = current.parentNode;
  }

  return;
};

/**
 * Clear the root's cached `staticNode` when the node it points at is being
 * removed as part of a larger subtree.
 *
 * The previous identity check (`staticNode === removeNode`) only caught direct
 * removal of the `<Static>` element. When an *ancestor* of `<Static>` is
 * removed, the stale `staticNode` reference survives and the next render would
 * replay stale static output (and, before `detachYogaSubtree`, trap on detached
 * WASM memory — see QwenLM/qwen-code#6820).
 *
 * The owning root is derived from the host parent passed to the removal hook,
 * not a module-level global, so instances with separate stdout streams don't
 * clobber each other's pointers.
 */
const clearStaticNodeIfContained = (
  rootNode: DOMElement | undefined,
  removeNode: DOMElement | TextNode,
): void => {
  if (!rootNode?.staticNode) {
    return;
  }

  // Walk up from staticNode to see if removeNode is an ancestor.
  let current: DOMElement | undefined = rootNode.staticNode;

  while (current) {
    if (current === removeNode) {
      // Only clear staticNode, not previousStaticNode. The inequality
      // (undefined !== previousStaticNode) triggers onStaticChange in
      // resetAfterCommit, which resets fullStaticOutput.
      rootNode.staticNode = undefined;
      return;
    }

    current = current.parentNode;
  }
};

type Props = Record<string, unknown>;

type HostContext = {
  isInsideText: boolean;
};

let currentUpdatePriority = NoEventPriority;

export const reconciler = createReconciler<
  ElementNames,
  Props,
  DOMElement,
  DOMElement,
  TextNode,
  DOMElement,
  unknown,
  unknown,
  unknown,
  HostContext,
  unknown,
  unknown,
  unknown,
  unknown
>({
  getRootHostContext: () => ({
    isInsideText: false,
  }),
  prepareForCommit: () => null,
  preparePortalMount: () => null,
  clearContainer: () => false,
  resetAfterCommit(rootNode) {
    if (typeof rootNode.onComputeLayout === "function") {
      rootNode.onComputeLayout();
    }

    emitLayoutListeners(rootNode);

    /*
		Fire `onStaticChange` BEFORE `onImmediateRender` so ink resets accumulated static output before the new instance emits. Without this, items from a replaced/removed <Static> stay in `fullStaticOutput` and get replayed on rewrites.
		*/
    if (rootNode.staticNode !== rootNode.previousStaticNode) {
      rootNode.previousStaticNode = rootNode.staticNode;
      if (typeof rootNode.onStaticChange === "function") {
        rootNode.onStaticChange();
      }
    }

    // Since renders are throttled at the instance level and <Static> component children
    // are rendered only once and then get deleted, we need an escape hatch to
    // trigger an immediate render to ensure <Static> children are written to output before they get erased
    if (rootNode.isStaticDirty) {
      rootNode.isStaticDirty = false;
      if (typeof rootNode.onImmediateRender === "function") {
        rootNode.onImmediateRender();
      }

      return;
    }

    if (typeof rootNode.onRender === "function") {
      rootNode.onRender();
    }
  },
  getChildHostContext(parentHostContext, type) {
    const previousIsInsideText = parentHostContext.isInsideText;
    const isInsideText = type === "ink-text" || type === "ink-virtual-text";

    if (previousIsInsideText === isInsideText) {
      return parentHostContext;
    }

    return { isInsideText };
  },
  shouldSetTextContent: () => false,
  createInstance(originalType, newProps, rootNode, hostContext) {
    if (hostContext.isInsideText && originalType === "ink-box") {
      throw new Error(`<Box> can't be nested inside <Text> component`);
    }

    const type =
      originalType === "ink-text" && hostContext.isInsideText ? "ink-virtual-text" : originalType;

    const node = createNode(type);

    for (const [key, value] of Object.entries(newProps)) {
      if (key === "children") {
        continue;
      }

      if (key === "style") {
        // oxlint-disable-next-line typescript/no-unsafe-type-assertion
        setStyle(node, value as Styles);

        if (node.yogaNode) {
          // oxlint-disable-next-line typescript/no-unsafe-type-assertion
          applyStyles(node.yogaNode, value as Styles);
        }

        continue;
      }

      if (key === "internal_transform") {
        // oxlint-disable-next-line typescript/no-unsafe-type-assertion
        node.internal_transform = value as AnsiTransformer;
        continue;
      }

      if (key === "internal_ansi") {
        node.internal_ansi = value === true;
        continue;
      }

      if (key === "internal_textStyle") {
        node.internal_textStyle = value as SemanticTextStyle;
        continue;
      }

      if (key === "internal_static") {
        node.internal_static = true;
        rootNode.isStaticDirty = true;

        // Save reference to <Static> node to skip traversal of entire
        // node tree to find it
        rootNode.staticNode = node;
        continue;
      }

      setAttribute(node, key, value as DOMNodeAttribute);
    }

    return node;
  },
  createTextInstance(text, _root, hostContext) {
    if (!hostContext.isInsideText) {
      throw new Error(`Text string "${text}" must be rendered inside <Text> component`);
    }

    return createTextNode(text);
  },
  resetTextContent() {},
  hideTextInstance(node) {
    setTextNodeValue(node, "");
  },
  unhideTextInstance(node, text) {
    setTextNodeValue(node, text);
  },
  getPublicInstance: (instance) => instance,
  hideInstance(node) {
    node.yogaNode?.setDisplay(Yoga.DISPLAY_NONE);
  },
  unhideInstance(node) {
    node.yogaNode?.setDisplay(Yoga.DISPLAY_FLEX);
  },
  appendInitialChild: appendChildNode,
  appendChild: appendChildNode,
  insertBefore: insertBeforeNode,
  finalizeInitialChildren() {
    return false;
  },
  isPrimaryRenderer: true,
  supportsMutation: true,
  supportsPersistence: false,
  supportsHydration: false,
  // Scheduler integration for concurrent mode
  supportsMicrotasks: true,
  scheduleMicrotask: queueMicrotask,
  // @ts-expect-error @types/react-reconciler is outdated and doesn't include scheduleCallback
  scheduleCallback: Scheduler.unstable_scheduleCallback,
  cancelCallback: Scheduler.unstable_cancelCallback,
  shouldYield: Scheduler.unstable_shouldYield,
  now: Scheduler.unstable_now,
  scheduleTimeout: setTimeout,
  cancelTimeout: clearTimeout,
  noTimeout: -1,
  beforeActiveInstanceBlur() {},
  afterActiveInstanceBlur() {},
  detachDeletedInstance() {},
  getInstanceFromNode: () => null,
  prepareScopeUpdate() {},
  getInstanceFromScope: () => null,
  appendChildToContainer: appendChildNode,
  insertInContainerBefore: insertBeforeNode,
  removeChildFromContainer(node, removeNode) {
    // `node` is the container, i.e. the root itself. Clear before
    // removeChildNode breaks the parent chain.
    clearStaticNodeIfContained(findRootNode(node), removeNode);

    removeChildNode(node, removeNode);
    detachYogaSubtree(removeNode);
  },
  commitUpdate(node, _type, oldProps, newProps) {
    if (node.internal_static) {
      const rootNode = findRootNode(node);

      if (rootNode) {
        rootNode.isStaticDirty = true;
      }
    }

    const props = diff(oldProps, newProps);

    // oxlint-disable-next-line typescript/no-unsafe-type-assertion
    const style = diff(oldProps["style"] as Styles, newProps["style"] as Styles);

    if (!props && !style) {
      return;
    }

    if (props) {
      for (const [key, value] of Object.entries(props)) {
        if (key === "style") {
          // oxlint-disable-next-line typescript/no-unsafe-type-assertion
          setStyle(node, value as Styles);
          continue;
        }

        if (key === "internal_transform") {
          // oxlint-disable-next-line typescript/no-unsafe-type-assertion
          node.internal_transform = value as AnsiTransformer;
          continue;
        }

        if (key === "internal_ansi") {
          node.internal_ansi = value === true;
          continue;
        }

        if (key === "internal_textStyle") {
          node.internal_textStyle = value as SemanticTextStyle | undefined;
          continue;
        }

        if (key === "internal_static") {
          node.internal_static = true;
          continue;
        }

        // oxlint-disable-next-line typescript/no-unsafe-type-assertion
        setAttribute(node, key, value as DOMNodeAttribute);
      }
    }

    if (style && node.yogaNode) {
      // oxlint-disable-next-line typescript/no-unsafe-type-assertion
      applyStyles(node.yogaNode, style, (newProps["style"] as Styles | undefined) ?? {});
    }
  },
  commitTextUpdate(node, _oldText, newText) {
    setTextNodeValue(node, newText);
  },
  removeChild(node, removeNode) {
    // `node` is the host parent; its chain up to the root is still intact
    // here, so derive the owning root from it rather than a global.
    clearStaticNodeIfContained(findRootNode(node), removeNode);

    removeChildNode(node, removeNode);
    detachYogaSubtree(removeNode);
  },
  setCurrentUpdatePriority(newPriority: number) {
    currentUpdatePriority = newPriority;
  },
  getCurrentUpdatePriority: () => currentUpdatePriority,
  resolveUpdatePriority() {
    if (currentUpdatePriority !== NoEventPriority) {
      return currentUpdatePriority;
    }

    return DefaultEventPriority;
  },
  maySuspendCommit() {
    // Return true to enable Suspense resource preloading
    return true;
  },
  NotPendingTransition: undefined,
  // oxlint-disable-next-line typescript/no-unsafe-type-assertion
  HostTransitionContext: createContext(null) as unknown as ReactContext<unknown>,
  resetFormInstance() {},
  requestPostPaintCallback() {},
  shouldAttemptEagerTransition() {
    return false;
  },
  trackSchedulerEvent() {},
  resolveEventType() {
    return null;
  },
  resolveEventTimeStamp() {
    return -1.1;
  },
  preloadInstance() {
    return true;
  },
  startSuspendingCommit() {},
  suspendInstance() {},
  waitForCommitToBeReady() {
    return null;
  },
  rendererPackageName: pkg.name,
  rendererVersion: pkg.version,
});
