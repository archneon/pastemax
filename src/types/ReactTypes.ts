// Define React event types
export type MouseEventType<T = Element> = React.MouseEvent<T>;
export type ChangeEventType<T = Element> = React.ChangeEvent<T>;

// Define React hook types
export type UseRefType<T> = React.RefObject<T>;
export type UseStateType<T> = [T, React.Dispatch<React.SetStateAction<T>>];
