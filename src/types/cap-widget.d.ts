import type { DetailedHTMLProps, HTMLAttributes } from "react";

type CapWidgetProps = DetailedHTMLProps<
  HTMLAttributes<HTMLElement>,
  HTMLElement
> & {
  "data-cap-api-endpoint"?: string;
  "data-cap-i18n-initial-state"?: string;
  "data-cap-i18n-verifying-label"?: string;
  "data-cap-i18n-solved-label"?: string;
  "data-cap-i18n-error-label"?: string;
  "data-cap-i18n-verify-aria-label"?: string;
  "data-cap-i18n-verifying-aria-label"?: string;
  "data-cap-i18n-verified-aria-label"?: string;
  "data-cap-i18n-error-aria-label"?: string;
  "data-cap-i18n-required-label"?: string;
};

declare module "react" {
  namespace JSX {
    interface IntrinsicElements {
      "cap-widget": CapWidgetProps;
    }
  }
}

export {};
