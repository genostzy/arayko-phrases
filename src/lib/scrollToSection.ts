export function scrollToSection(e: React.MouseEvent<HTMLAnchorElement>, id: string) {
  const el = document.getElementById(id);
  if (!el) return;
  e.preventDefault();
  el.scrollIntoView({ behavior: "smooth", block: "start" });
  history.replaceState(null, "", `#${id}`);
}

export function scrollToTop(e: React.MouseEvent<HTMLAnchorElement>) {
  e.preventDefault();
  window.scrollTo({ top: 0, behavior: "smooth" });
  history.replaceState(null, "", window.location.pathname);
}
