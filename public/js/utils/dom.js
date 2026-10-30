export function $(selector) {
    return document.querySelector(selector);
}

export function createElement(tag, className, text = '') {
    const el = document.createElement(tag);
    if (className) el.className = className;
    if (text) el.innerText = text;
    return el;
}

export function clearElement(el) {
    if (el) el.innerHTML = '';
}
