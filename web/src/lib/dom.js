// Tiny DOM helpers. All text goes through textContent - never innerHTML with
// untrusted relay content (CLAUDE.md §7, XSS is the primary client threat).

/**
 * Create an element. `props` maps to attributes/properties; `text` sets
 * textContent; `children` are appended. Event handlers via on* props.
 *   el('a', { href: '#/x', class: 'link' }, 'label')
 *   el('div', { class: 'row' }, [childA, childB])
 */
export function el(tag, props = {}, content = null) {
  const node = document.createElement(tag);
  for (const [k, v] of Object.entries(props)) {
    if (v == null) continue;
    if (k === 'class') node.className = v;
    else if (k === 'text') node.textContent = v;
    else if (k.startsWith('on') && typeof v === 'function') {
      node.addEventListener(k.slice(2).toLowerCase(), v);
    } else node.setAttribute(k, v);
  }
  if (typeof content === 'string') node.textContent = content;
  else if (Array.isArray(content)) content.forEach((c) => c && node.append(c));
  else if (content instanceof Node) node.append(content);
  return node;
}

/** Replace all children of `parent` with `nodes`. */
export function mount(parent, nodes) {
  parent.replaceChildren(...[].concat(nodes).filter(Boolean));
}
