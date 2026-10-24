export function Spinner() {
  return (
    <span
      className="inline-block size-4 animate-spin rounded-full border-2 border-current border-t-transparent"
      aria-hidden="true"
    />
  );
}

const BUTTON_VARIANTS = {
  primary: "bg-avax text-white hover:brightness-90",
  dark: "bg-ink text-paper hover:bg-ink-soft",
  secondary: "border border-ink/25 bg-card text-ink hover:bg-white",
  onDark: "border border-paper/35 text-paper hover:bg-paper/10",
  ghost: "text-ink hover:bg-ink/10",
};

export function Button({ variant = "primary", busy = false, className = "", children, ...props }) {
  return (
    <button
      type="button"
      {...props}
      disabled={props.disabled || busy}
      className={`inline-flex items-center justify-center gap-2 rounded-lg px-4 py-2.5 text-sm font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${BUTTON_VARIANTS[variant]} ${className}`}
    >
      {busy && <Spinner />}
      {children}
    </button>
  );
}

const CHIP_TONES = {
  ok: "bg-ok text-white",
  warn: "bg-[#f2c14e] text-ink",
  bad: "bg-avax text-white",
  neutral: "bg-line text-ink",
};

export function Chip({ tone = "neutral", children }) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${CHIP_TONES[tone]}`}
    >
      {children}
    </span>
  );
}

export const inputClass =
  "w-full rounded-lg border border-line bg-white px-3 py-2.5 text-sm text-ink placeholder:text-muted/70 focus:border-ink";

export function Field({ label, hint, children }) {
  return (
    <label className="grid gap-1.5 text-sm">
      <span className="font-medium">{label}</span>
      {children}
      {hint && <span className="text-xs text-muted">{hint}</span>}
    </label>
  );
}

export function Panel({ className = "", children }) {
  return (
    <section className={`rounded-2xl border border-line bg-card p-5 sm:p-6 ${className}`}>
      {children}
    </section>
  );
}

export function EmptyState({ title, children, action }) {
  return (
    <div className="rounded-2xl border border-dashed border-line px-6 py-12 text-center">
      <h3 className="font-display text-xl font-bold">{title}</h3>
      <p className="mx-auto mt-2 max-w-md text-sm text-muted">{children}</p>
      {action && <div className="mt-5 flex justify-center">{action}</div>}
    </div>
  );
}
