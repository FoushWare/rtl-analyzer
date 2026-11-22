const $ = (selector) => document.querySelector(selector);
const locale = $('#locale');
const direction = $('#page-direction');
const copy = {
  en: { eyebrow: 'ACCOUNT CENTER', title: 'Good morning, Alex', welcome: 'Here is what is happening across your account today.', direction: 'Your language setting updates the interface without leaving this page.', manage: 'Manage account' },
  ar: { eyebrow: 'مركز الحساب', title: 'صباح الخير يا أليكس', welcome: 'إليك آخر المستجدات في حسابك اليوم.', direction: 'يتم تحديث لغة الواجهة دون مغادرة هذه الصفحة.', manage: 'إدارة الحساب' },
};
const routeDirection = new URLSearchParams(window.location.search).get('direction');
if (routeDirection === 'ltr' || routeDirection === 'rtl') direction.value = routeDirection;
function applyState() {
  const lang = locale.value;
  document.documentElement.lang = lang;
  document.documentElement.dir = direction.value;
  $('#eyebrow').textContent = copy[lang].eyebrow;
  $('#welcome-title').textContent = copy[lang].title;
  $('#welcome-copy').textContent = copy[lang].welcome;
  $('#direction-copy').textContent = copy[lang].direction;
  $('#manage-button').textContent = copy[lang].manage;
}
[locale, direction].forEach((control) => control.addEventListener('change', applyState));
$('#reset').addEventListener('click', () => { locale.value = 'en'; direction.value = 'ltr'; applyState(); });
applyState();

const scrim = $('.drawer-scrim');
const page = [$('.topbar'), $('#overview'), $('footer')];
let openedDrawer;
let returnFocus;
function closeDrawer() {
  if (!openedDrawer) return;
  openedDrawer.classList.remove('is-open');
  openedDrawer.inert = true;
  openedDrawer = undefined;
  scrim.hidden = true;
  page.forEach(element => { element.inert = false; });
  returnFocus?.focus();
}
function openDrawer(drawer, opener) {
  closeDrawer();
  openedDrawer = drawer;
  returnFocus = opener;
  scrim.hidden = false;
  page.forEach(element => { element.inert = true; });
  drawer.inert = false;
  drawer.classList.add('is-open');
  drawer.querySelector('button').focus();
}
document.querySelectorAll('[data-open-drawer]').forEach(button => {
  button.addEventListener('click', () => openDrawer(document.getElementById(button.dataset.openDrawer), button));
});
document.querySelectorAll('[data-close-drawer]').forEach(control => control.addEventListener('click', closeDrawer));
scrim.addEventListener('click', closeDrawer);
document.addEventListener('keydown', event => {
  if (!openedDrawer) return;
  if (event.key === 'Escape') closeDrawer();
  if (event.key !== 'Tab') return;
  const controls = [...openedDrawer.querySelectorAll('button, a[href]')];
  const boundary = event.shiftKey ? controls[0] : controls.at(-1);
  if (document.activeElement === boundary) {
    event.preventDefault();
    (event.shiftKey ? controls.at(-1) : controls[0]).focus();
  }
});
const previewDrawer = new URLSearchParams(window.location.search).get('drawer');
const drawerTrigger = [...document.querySelectorAll('[data-open-drawer]')].find(button => button.dataset.openDrawer === previewDrawer);
if (drawerTrigger) openDrawer(document.getElementById(previewDrawer), drawerTrigger);
