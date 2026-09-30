/** A module tab - shared by the live subnav and the loading skeleton. */
export type ModuleTab = {
  href: string;
  label: string;
  /** Active only on this exact path (the module's first tab). */
  exact?: boolean;
};
