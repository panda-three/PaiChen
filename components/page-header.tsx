export function PageHeader({ title, description, actions }: { title: string; description?: string; actions?: React.ReactNode }) {
  return <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
    <div><h1 className="page-title">{title}</h1>{description && <p className="muted mt-2 text-sm">{description}</p>}</div>
    {actions && <div className="actions">{actions}</div>}
  </div>;
}

export function FormError({ message }: { message?: string }) {
  return message ? <div className="mb-5 rounded border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{message}</div> : null;
}
