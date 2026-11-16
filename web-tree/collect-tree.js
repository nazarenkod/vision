// Vision: collects the UI tree of the current web page for a screenshot (spec 050, ADR-0029).
// One script for every SDK, so the same page gives the same tree from Selenide and Playwright.
// It is a single function expression: SDKs call it as `(<this file>)(options)` in the page.
// The result is the page's HTML as the browser holds it, plus data-vision-* attributes: where
// each element is shown, what is hidden, the name a screen reader announces, and the content
// of open shadow roots and same-origin iframes, which a plain page source leaves out.
(function collectVisionTree(options) {
  var capture = options && options.capture === 'page' ? 'page' : 'viewport';
  var SKIP = { SCRIPT: 1, STYLE: 1, NOSCRIPT: 1, TEMPLATE: 1, LINK: 1, META: 1, HEAD: 1, BASE: 1 };
  var VOID = {
    AREA: 1, BASE: 1, BR: 1, COL: 1, EMBED: 1, HR: 1, IMG: 1, INPUT: 1,
    LINK: 1, META: 1, SOURCE: 1, TRACK: 1, WBR: 1,
  };
  // what fills them is drawing, not elements a test or a screen reader tells apart
  var OPAQUE = { svg: 1, math: 1, canvas: 1, video: 1, audio: 1, picture: 1, object: 1 };
  var LABELLED = { INPUT: 1, SELECT: 1, TEXTAREA: 1, METER: 1, PROGRESS: 1, OUTPUT: 1, BUTTON: 1 };
  var out = [];

  var escapeText = function (text) {
    return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  };
  var escapeAttr = function (text) {
    return escapeText(text).replace(/"/g, '&quot;');
  };
  var num = function (value) {
    return String(Math.round(value * 100) / 100);
  };
  var squash = function (text) {
    return (text || '').replace(/\s+/g, ' ').trim();
  };

  var textOf = function (element) {
    return squash(element.innerText !== undefined ? element.innerText : element.textContent);
  };

  // the names a browser gives from outside the element: aria-labelledby and <label>
  var outsideName = function (element) {
    var doc = element.ownerDocument;
    var ids = element.getAttribute('aria-labelledby');
    if (ids) {
      var parts = [];
      ids.split(/\s+/).forEach(function (id) {
        var target = id && doc.getElementById(id);
        if (target) parts.push(squash(target.getAttribute('aria-label')) || textOf(target));
      });
      var joined = squash(parts.join(' '));
      if (joined) return joined;
    }
    if (element.getAttribute('aria-label')) return '';
    if (LABELLED[element.tagName] && element.labels && element.labels.length) {
      var names = [];
      for (var i = 0; i < element.labels.length; i++) {
        var label = element.labels[i];
        var copy = label.cloneNode(true);
        // a control inside its own label does not name itself
        var inner = copy.querySelectorAll('input, select, textarea, button');
        for (var j = 0; j < inner.length; j++) inner[j].remove();
        names.push(squash(copy.textContent));
      }
      return squash(names.join(' '));
    }
    return '';
  };

  // a frame's own document, which goes right after the frame (see below)
  var frameDocument = function (element) {
    try {
      var inner = element.contentDocument;
      return inner && inner.documentElement ? inner : null;
    } catch (e) {
      // another origin: the frame stays one element
      return null;
    }
  };

  var serialize = function (node, dx, dy) {
    if (node.nodeType === 3) {
      var text = node.nodeValue;
      if (text && text.trim()) out.push(escapeText(text.replace(/\s+/g, ' ')));
      return;
    }
    if (node.nodeType !== 1) return;
    var element = node;
    var tag = element.tagName;
    if (SKIP[tag]) return;
    var name = element.localName;
    out.push('<' + name);
    for (var a = 0; a < element.attributes.length; a++) {
      var attr = element.attributes[a];
      // a page's own data-vision-* would read as ours; inline handlers only say "clickable"
      if (attr.name.indexOf('data-vision-') === 0) continue;
      var value = /^on/.test(attr.name) ? '' : attr.value;
      // an inline image or frame document would only make the tree heavier: what they show is
      // in the screenshot, and a frame's content follows as its children
      if (attr.name === 'srcdoc' || (attr.name === 'src' && /^data:/i.test(value))) value = '';
      out.push(' ' + attr.name + '="' + escapeAttr(value) + '"');
    }
    var view = element.ownerDocument.defaultView;
    var style = view.getComputedStyle(element);
    var hidden = style.display === 'none';
    if (hidden || style.visibility === 'hidden' || style.visibility === 'collapse') {
      out.push(' data-vision-hidden="1"');
    }
    if (!hidden) {
      var rect = element.getBoundingClientRect();
      out.push(
        ' data-vision-rect="' +
          [num(rect.left + dx), num(rect.top + dy), num(rect.width), num(rect.height)].join(',') +
          '"'
      );
    }
    var given = outsideName(element);
    if (given) out.push(' data-vision-name="' + escapeAttr(given) + '"');
    if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') {
      // what is typed lives in the property; the attribute keeps only the initial value
      if (element.type === 'checkbox' || element.type === 'radio') {
        out.push(' data-vision-checked="' + (element.checked ? '1' : '0') + '"');
      } else if (element.type !== 'password' && element.type !== 'hidden' && element.value) {
        var shown = tag === 'SELECT' && element.selectedOptions && element.selectedOptions[0]
          ? element.selectedOptions[0].textContent
          : element.value;
        out.push(' data-vision-value="' + escapeAttr(squash(shown)) + '"');
      }
    }
    out.push('>');
    if (VOID[tag]) return;
    if (!hidden && !OPAQUE[name]) {
      if (element.shadowRoot) {
        out.push('<template shadowrootmode="open">');
        for (var s = element.shadowRoot.firstChild; s; s = s.nextSibling) serialize(s, dx, dy);
        out.push('</template>');
      }
      if (tag === 'IFRAME' || tag === 'FRAME') {
        // nothing inside: HTML reads what is inside <iframe> as text
      } else if (tag !== 'SELECT' && tag !== 'TEXTAREA') {
        for (var child = element.firstChild; child; child = child.nextSibling) serialize(child, dx, dy);
      } else if (tag === 'SELECT') {
        for (var o = 0; o < element.options.length; o++) {
          out.push('<option>' + escapeText(squash(element.options[o].textContent)) + '</option>');
        }
      }
    } else if (name === 'svg' || name === 'math') {
      // its title is how an icon names itself
      var title = element.querySelector('title');
      if (title && squash(title.textContent)) out.push('<title>' + escapeText(squash(title.textContent)) + '</title>');
    }
    out.push('</' + name + '>');
    if (!hidden && (tag === 'IFRAME' || tag === 'FRAME')) {
      var inner = frameDocument(element);
      if (inner) {
        // a template right after the frame holds its document, in the top window's coordinates
        var box = element.getBoundingClientRect();
        out.push('<template data-vision-frame="1">');
        serialize(inner.documentElement, dx + box.left + element.clientLeft, dy + box.top + element.clientTop);
        out.push('</template>');
      }
    }
  };

  var root = document.documentElement;
  var scrollX = window.scrollX || window.pageXOffset || 0;
  var scrollY = window.scrollY || window.pageYOffset || 0;
  var head = [];
  head.push('data-vision-tree="1"');
  head.push('data-vision-capture="' + capture + '"');
  head.push('data-vision-viewport="' + window.innerWidth + ',' + window.innerHeight + '"');
  head.push('data-vision-page="' + Math.max(root.scrollWidth, window.innerWidth) + ',' + Math.max(root.scrollHeight, window.innerHeight) + '"');
  head.push('data-vision-scroll="' + num(scrollX) + ',' + num(scrollY) + '"');
  head.push('data-vision-dpr="' + num(window.devicePixelRatio || 1) + '"');
  serialize(root, 0, 0);
  // the markers go on the top <html>, before its own attributes
  var html = out.join('');
  html = html.replace(/^<html/, '<html ' + head.join(' '));
  return (document.doctype ? '<!DOCTYPE html>' : '') + html;
})
