// Minimal DOM element builder — keeps screen code declarative without a framework.

export interface HAttrs {
  className?: string;
  text?: string;
  html?: string;
  disabled?: boolean;
  onClick?: (ev: Event) => void;
  attrs?: Record<string, string>;
}

export function h<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  attrs: HAttrs = {},
  children: (HTMLElement | string)[] = [],
): HTMLElementTagNameMap[K] {
  const el = document.createElement(tag);
  if (attrs.className) el.className = attrs.className;
  if (attrs.text !== undefined) el.textContent = attrs.text;
  if (attrs.html !== undefined) el.innerHTML = attrs.html;
  if (attrs.disabled && 'disabled' in el) (el as unknown as { disabled: boolean }).disabled = true;
  if (attrs.onClick) el.addEventListener('click', attrs.onClick);
  if (attrs.attrs) {
    for (const [k, v] of Object.entries(attrs.attrs)) el.setAttribute(k, v);
  }
  for (const child of children) {
    el.append(typeof child === 'string' ? document.createTextNode(child) : child);
  }
  return el;
}
