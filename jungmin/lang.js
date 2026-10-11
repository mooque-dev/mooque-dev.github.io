// Pick the language before anything is drawn, so both never flash on screen.
try { document.documentElement.dataset.lang = localStorage.getItem("jm-lang") || (/^ko/i.test(navigator.language) ? "ko" : "en"); }
catch (e) { document.documentElement.dataset.lang = /^ko/i.test(navigator.language) ? "ko" : "en"; }
