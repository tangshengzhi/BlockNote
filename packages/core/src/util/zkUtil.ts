export function getEditorWrapper(e: HTMLElement | null) {
  let el = e;
  while(el && !el.classList.contains('document-editor')) {
    el = el.parentElement;
  }
  return el || e;
}