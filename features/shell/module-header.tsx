/**
 * Module page header (.page-header): title, optional description, line under
 * it (e.g. freshness) and actions on the right. The loading skeleton renders
 * the same component, so the header never jumps when the page arrives.
 */
export function ModuleHeader({
  title,
  description,
  below,
  actions,
  className = "",
}: {
  title: string;
  description?: string;
  below?: React.ReactNode;
  actions?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={`page-header ${className}`.trim()}>
      <div>
        <h1>{title}</h1>
        {description ? <p>{description}</p> : null}
        {below}
      </div>
      {actions}
    </div>
  );
}
