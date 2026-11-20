'use client';

import { useActionState, type ReactNode } from 'react';

export type FormState = { ok: boolean; message: string } | null;
export type FormAction = (prev: FormState, formData: FormData) => Promise<FormState>;

export function ActionForm({
  action, label, children, className, primary = false,
}: {
  action: FormAction;
  label: string;
  children?: ReactNode;
  className?: string;
  primary?: boolean;
}) {
  const [state, formAction, pending] = useActionState(action, null);
  return (
    <form action={formAction} className={className ?? 'flex flex-col gap-3'}>
      {children}
      <div className="flex items-center gap-3">
        <button type="submit" disabled={pending} className={primary ? 'btn-primary' : 'btn'}>
          {pending ? '…' : label}
        </button>
        {state && <span className={`text-xs ${state.ok ? 'text-green-600' : 'text-red-600'}`}>{state.message}</span>}
      </div>
    </form>
  );
}
