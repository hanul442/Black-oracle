import 'react';

declare module 'react' {
  interface Attributes {
    key?: string | number | null;
  }
}

declare global {
  namespace JSX {
    interface IntrinsicAttributes {
      key?: string | number | null;
    }
  }
}

export {};
