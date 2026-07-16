declare module "*.mdx" {
  import type { ComponentType, ComponentProps } from "react";
  const component: ComponentType<ComponentProps<any>>;
  export default component;
}

declare module "*.md" {
  import type { ComponentType, ComponentProps } from "react";
  const component: ComponentType<ComponentProps<any>>;
  export default component;
}
