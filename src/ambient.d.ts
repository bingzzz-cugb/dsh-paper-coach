declare module '@deepseek-ai/dsh-tools' {
  export function defineTool<T = any>(options: T): T
}

declare module '@deepseek-ai/dsh-client-ui-primitives' {
  export const Button: any
  export const Modal: any
}
