declare module 'react-beautiful-dnd' {
  import * as React from 'react';

  export type DropResult = any;

  export type DroppableProvided = {
    innerRef: (element: HTMLElement | null) => void;
    droppableProps: React.HTMLAttributes<HTMLElement>;
    placeholder: React.ReactNode;
  };

  export type DraggableProvided = {
    draggableProps: React.HTMLAttributes<HTMLElement>;
    dragHandleProps: React.HTMLAttributes<HTMLElement> | null;
    innerRef: (element: HTMLElement | null) => void;
  };

  export class DragDropContext extends React.Component<{
    onDragEnd: (result: DropResult) => void;
    children: React.ReactNode;
  }> {}

  export class Droppable extends React.Component<{
    droppableId: string;
    children: (provided: DroppableProvided, snapshot: any) => React.ReactNode;
  }> {}

  export class Draggable extends React.Component<{
    draggableId: string;
    index: number;
    children: (provided: DraggableProvided, snapshot: any) => React.ReactNode;
  }> {}
}
