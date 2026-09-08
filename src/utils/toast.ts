export type ToastType = 'success' | 'error';

export function notifyToast(type: ToastType, title: string, message?: string) {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent('ifc-toast', { detail: { type, title, message } }));
}
