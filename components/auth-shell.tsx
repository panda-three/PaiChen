import { Store } from "lucide-react";

export function AuthShell({ eyebrow, title, description, children, footer }: {
  eyebrow: string;
  title: string;
  description: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
}) {
  return <main className="auth-page">
    <section className="auth-shell">
      <div className="auth-visual" role="img" aria-label="现代意式客厅空间">
        <div className="auth-brand"><span><Store size={18} aria-hidden="true" /></span><strong>YUNCHENG</strong></div>
        <div className="auth-visual-copy"><p>PRIVATE RETAIL SUITE</p><strong>空间、产品与客户关系，归于一处。</strong></div>
      </div>
      <div className="auth-content">
        <div className="auth-form-wrap">
          <p className="auth-eyebrow">{eyebrow}</p>
          <h1>{title}</h1>
          <p className="auth-description">{description}</p>
          {children}
          {footer && <footer className="auth-footer">{footer}</footer>}
        </div>
      </div>
    </section>
  </main>;
}
