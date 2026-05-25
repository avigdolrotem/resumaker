'use client';

import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { GripVertical } from 'lucide-react';

/**
 * Generic drag-to-reorder wrapper for the multi-card sections.
 *
 * Each section creates stable IDs of the form `<sectionKey>:<index>`
 * (e.g. `experience:0`). On drag end, we compute the new array via
 * `arrayMove` and hand it back to the section via `onReorder`.
 *
 * Keyboard a11y is provided by @dnd-kit's KeyboardSensor — focus the
 * grip handle, press Space to grab, arrow keys to move, Space to drop.
 */

export interface SortableListProps<T> {
  items: T[];
  /** Returns the React node to render for an item. Receives a drag handle slot. */
  children: (item: T, index: number, dragHandle: React.ReactNode) => React.ReactNode;
  /** Stable section key — e.g. "experience". Used to build per-item DnD IDs. */
  sectionKey: string;
  onReorder: (next: T[]) => void;
}

export function SortableList<T>({ items, children, sectionKey, onReorder }: SortableListProps<T>) {
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const ids = items.map((_, i) => `${sectionKey}:${i}`);

  function handleDragEnd(e: DragEndEvent) {
    if (!e.over || e.active.id === e.over.id) return;
    const oldIndex = ids.indexOf(String(e.active.id));
    const newIndex = ids.indexOf(String(e.over.id));
    if (oldIndex < 0 || newIndex < 0) return;
    onReorder(arrayMove(items, oldIndex, newIndex));
  }

  return (
    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
      <SortableContext items={ids} strategy={verticalListSortingStrategy}>
        {items.map((item, i) => (
          <SortableRow key={ids[i]} id={ids[i] as string}>
            {(handle) => children(item, i, handle)}
          </SortableRow>
        ))}
      </SortableContext>
    </DndContext>
  );
}

function SortableRow({
  id,
  children,
}: {
  id: string;
  children: (handle: React.ReactNode) => React.ReactNode;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id,
  });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex: isDragging ? 50 : undefined,
    opacity: isDragging ? 0.85 : 1,
  };
  const handle = (
    <button
      type="button"
      {...attributes}
      {...listeners}
      aria-label="Drag to reorder"
      className="text-muted-foreground hover:text-foreground cursor-grab touch-none p-1 active:cursor-grabbing"
    >
      <GripVertical className="h-3.5 w-3.5" />
    </button>
  );
  return (
    <div ref={setNodeRef} style={style}>
      {children(handle)}
    </div>
  );
}
