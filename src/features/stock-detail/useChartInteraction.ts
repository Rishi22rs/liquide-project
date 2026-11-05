import { useEffect, useRef, useState, type ComponentRef } from 'react';
import { PanResponder, View, type GestureResponderEvent } from 'react-native';
import {
  chartTimeBounds,
  followingChartWindow,
  panChartWindow,
  chartTouchFraction,
  nearestChartPoint,
  zoomChartWindow,
  type ChartTimeWindow,
} from '../../domain/chartInteraction';
import type { ChartPoint } from '../../domain/tickHistory';

type Touch = { pageX: number; pageY: number };
type PinchStart = {
  distance: number;
  focus: number;
  window: ChartTimeWindow;
  bounds: ChartTimeWindow;
};

function fingerDistance(touches: readonly Touch[]): number {
  if (touches.length < 2) return 0;
  return Math.hypot(
    touches[1]!.pageX - touches[0]!.pageX,
    touches[1]!.pageY - touches[0]!.pageY,
  );
}

/** Keeps gesture bookkeeping in refs and viewport/selection in state. Only this
 * small chart updates during scrubbing; quote stores and list rows are untouched. */
export function useChartInteraction(
  points: readonly ChartPoint[],
  onInteractionChange: (active: boolean) => void,
) {
  const frameRef = useRef<ComponentRef<typeof View>>(null);
  const [timeWindow, setTimeWindow] = useState<ChartTimeWindow>();
  const [selected, setSelected] = useState<ChartPoint>();
  const pointsRef = useRef(points);
  pointsRef.current = points;
  const fullBounds = chartTimeBounds(points);
  const displayedWindow =
    timeWindow ?? (fullBounds ? followingChartWindow(fullBounds) : undefined);
  const windowRef = useRef(displayedWindow);
  windowRef.current = displayedWindow;
  const drag = useRef<
    | { x: number; y: number; startedAt: number; mode?: 'pan' | 'inspect' | 'vertical' }
    | undefined
  >(undefined);
  const callbackRef = useRef(onInteractionChange);
  callbackRef.current = onInteractionChange;
  const origin = useRef({ x: 0, width: 0, ready: false });
  const pinch = useRef<PinchStart | undefined>(undefined);
  const gestureWindow = useRef<ChartTimeWindow | undefined>(undefined);
  const gestureBounds = useRef<ChartTimeWindow | undefined>(undefined);
  const active = useRef(false);

  function updateWindow(next: ChartTimeWindow) {
    windowRef.current = next;
    setTimeWindow(next);
  }

  function touchFraction(pageX: number) {
    return chartTouchFraction(pageX - origin.current.x, origin.current.width);
  }

  function handleTouches(touches: readonly Touch[]) {
    if (
      !origin.current.ready ||
      !gestureWindow.current ||
      !gestureBounds.current ||
      touches.length === 0
    )
      return;
    if (touches.length >= 2) {
      drag.current = undefined;
      const distance = fingerDistance(touches);
      const focus = touchFraction((touches[0]!.pageX + touches[1]!.pageX) / 2);
      if (!pinch.current) {
        pinch.current = {
          distance: Math.max(1, distance),
          focus,
          window: windowRef.current ?? gestureWindow.current,
          bounds: gestureBounds.current,
        };
      }
      const initial = pinch.current;
      updateWindow(
        zoomChartWindow(
          initial.bounds,
          initial.window,
          distance / initial.distance,
          initial.focus,
          focus,
        ),
      );
      setSelected(undefined);
    } else {
      const touch = touches[0]!;
      // A quick sideways swipe scrolls history; holding first keeps the existing
      // exact-value scrub gesture. Lock the mode until the finger is lifted.
      drag.current ??= { x: touch.pageX, y: touch.pageY, startedAt: Date.now() };
      const start = drag.current;
      const dx = touch.pageX - start.x;
      const dy = touch.pageY - start.y;
      if (!start.mode) {
        if (Date.now() - start.startedAt >= 350) start.mode = 'inspect';
        else if (Math.abs(dx) > 8 && Math.abs(dx) > Math.abs(dy)) start.mode = 'pan';
        else if (Math.abs(dy) > 8) start.mode = 'vertical';
      }
      if (start.mode === 'vertical') {
        setSelected(undefined);
        callbackRef.current(false);
        return;
      }
      if (start.mode === 'pan') {
        updateWindow(
          panChartWindow(
            gestureBounds.current,
            gestureWindow.current,
            dx,
            (origin.current.width * 300) / 320,
          ),
        );
        setSelected(undefined);
        return;
      }
      // After a pinch, one remaining finger inspects the newly zoomed window.
      pinch.current = undefined;
      const current = windowRef.current ?? gestureWindow.current;
      setSelected(
        nearestChartPoint(pointsRef.current, current, touchFraction(touches[0]!.pageX)),
      );
    }
  }

  function finishGesture() {
    drag.current = undefined;
    active.current = false;
    origin.current.ready = false;
    pinch.current = undefined;
    // Inspection is temporary: lifting the final finger hides the crosshair,
    // marker and price/time readout, while preserving the chosen zoom window.
    setSelected(undefined);
    callbackRef.current(false);
  }

  const responder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => pointsRef.current.length > 0,
      onStartShouldSetPanResponderCapture: () => pointsRef.current.length > 0,
      onMoveShouldSetPanResponderCapture: () => pointsRef.current.length > 0,
      onPanResponderGrant: (event) => {
        const bounds = chartTimeBounds(pointsRef.current);
        if (!bounds) return;
        drag.current = undefined;
        active.current = true;
        callbackRef.current(true);
        // Freeze only this gesture's bounds. Future swipes can reach new ticks.
        gestureBounds.current = bounds;
        gestureWindow.current = windowRef.current ?? followingChartWindow(bounds);
        updateWindow(gestureWindow.current);
        const touches = readTouches(event);
        frameRef.current?.measureInWindow((x, _y, width) => {
          if (!active.current) return;
          origin.current = { x, width, ready: true };
          handleTouches(touches);
        });
      },
      onPanResponderMove: (event) => handleTouches(readTouches(event)),
      onPanResponderStart: (event) => {
        if (active.current) handleTouches(readTouches(event));
      },
      onPanResponderEnd: (event) => {
        if (event.nativeEvent.touches.length === 0) finishGesture();
        else if (active.current) handleTouches(readTouches(event));
      },
      onPanResponderRelease: finishGesture,
      onPanResponderTerminate: finishGesture,
      onPanResponderTerminationRequest: () => drag.current?.mode === 'vertical',
    }),
  ).current;

  function reset() {
    windowRef.current = undefined;
    setTimeWindow(undefined);
    setSelected(undefined);
  }

  function stepSelection(direction: number) {
    const bounds = windowRef.current ?? chartTimeBounds(pointsRef.current);
    if (!bounds) return;
    const visible = pointsRef.current.filter(
      (point) => point.receivedAt >= bounds.start && point.receivedAt <= bounds.end,
    );
    if (visible.length === 0) return;
    const index = selected ? visible.indexOf(selected) : visible.length - 1;
    updateWindow(bounds);
    setSelected(visible[Math.max(0, Math.min(visible.length - 1, index + direction))]);
  }

  useEffect(
    () => () => {
      callbackRef.current(false);
    },
    [],
  );

  return {
    frameRef,
    referenceBounds: fullBounds,
    isExploring: timeWindow !== undefined,
    panHandlers: responder.panHandlers,
    timeWindow: displayedWindow,
    selected,
    reset,
    stepSelection,
  };
}

// Copy the coordinates immediately: native event objects must not be retained
// while the asynchronous view measurement completes.
function readTouches(event: GestureResponderEvent): Touch[] {
  const touches = event.nativeEvent.touches;
  return touches.length > 0
    ? touches.map((touch) => ({ pageX: touch.pageX, pageY: touch.pageY }))
    : [{ pageX: event.nativeEvent.pageX, pageY: event.nativeEvent.pageY }];
}
