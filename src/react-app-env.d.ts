/// <reference types="react" />
/// <reference types="react-dom" />

// Add missing TypeScript definitions
declare namespace React {
  interface MouseEvent extends globalThis.MouseEvent {}
  interface ChangeEvent extends Event {}
}
