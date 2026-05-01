type Variant = 'success' | 'warning' | 'danger' | 'neutral';

const variantClass: Record<Variant, string> = {
  success: 'badge badge-success',
  warning: 'badge badge-warning',
  danger: 'badge badge-danger',
  neutral: 'badge badge-neutral',
};

export function Badge({ label, variant = 'neutral' }: { label: string; variant?: Variant }) {
  return <span className={variantClass[variant]}>{label}</span>;
}
