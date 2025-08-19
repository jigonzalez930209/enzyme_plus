declare module '*.mdx' {
  import type { ComponentType } from 'react'
  // MDX compiles to a React component
  const MDXComponent: ComponentType<Record<string, unknown>>
  export default MDXComponent
}
