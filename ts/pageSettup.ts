//#region Constants
const CLIPBOARD_COPY_CLASSNAME = '.clipboard-copy';

const MAIL_TO_CLASSNAME = '.mail-to-open';
//#endregion

//#region Settup
export function pageSettup(page: HTMLElement) {
  (
    Array.from(page.querySelectorAll(CLIPBOARD_COPY_CLASSNAME)) as HTMLElement[]
  ).forEach((el: HTMLElement) => {
    el.addEventListener('click', () => {
      navigator.clipboard.writeText(el.innerText);
    });
  });
}
//#endregion
