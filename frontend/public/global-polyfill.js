// Polyfill for libraries (e.g. react-joyride) that expect the Node.js global object.
// A file, not a script in index.html: the content security policy runs no inline script (052).
window.global = window;
