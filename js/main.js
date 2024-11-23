document.addEventListener("DOMContentLoaded", () => {
    let hasEdited = false;
    let editor = null;

    const localStorageNamespace = 'org.magmarecerca.dev/mail_creator';
    const localStorageKey = 'last_state';
    const confirmationMessage = 'Are you sure you want to reset? Your changes will be lost.';

    function stringIsNullOrEmpty(string) {
        if (typeof string === "string" && string.length === 0)
            return true;
        if (string === null)
            return true;

        return false;
    }

    const templateFile = 'template.md';
    let defaultInput = '';
    fetch(templateFile)
        .then(response => {
            if (!response.ok) {
                throw new Error(`Could not fetch ${templateFile}: ${response.statusText}`);
            }
            return response.text();
        })
        .then(markdown => {
            defaultInput = markdown;
            if (stringIsNullOrEmpty(editor.getValue())) {
                presetValue(defaultInput);
            }
        });

    let setupEditor = () => {
        let editor = ace.edit('editor');
        editor.getSession().setUseWrapMode(true);
        editor.setOptions({
            maxLines: Infinity,
            indentedSoftWrap: false,
            fontSize: 14,
            autoScrollEditorIntoView: true,
            fontFamily: 'JetBrains Mono',
            showGutter: false,
            highlightGutterLine: false,
            cursorStyle: 'slim',
            highlightActiveLine: false,
            highlightSelectedWord: false,
            showRulers: false,
            showPrintMargin: false,
            selectionStyle: 'text',
            behavioursEnabled: false,
            enableBasicAutocompletion: false,
            showFoldWidgets: false,
        });

        const MarkdownMode = ace.require("ace/mode/markdown").Mode;
        editor.session.setMode(new MarkdownMode());

        editor.on('change', () => {
            let changed = editor.getValue() !== defaultInput;
            if (changed) {
                hasEdited = true;
            }
            let value = editor.getValue();
            saveLastContent(value);
            editContent(value);
        });

        return editor;
    };

    const renderer = new marked.Renderer();
    let setupMarked = () => {
        renderer.link = function (href, title, text) {
            return `<a target="_blank" href="${href}">${text}` + '</a>';
        }
        marked.use({renderer});
    };

    // Render Markdown text as html
    let convert = (markdown) => {
        let options = {
            headerIds: false,
            mangle: false
        };
        return marked.parse(markdown, options);
    };

    // Reset input text
    let reset = () => {
        let changed = editor.getValue() !== defaultInput;
        if (hasEdited || changed) {
            const confirmed = window.confirm(confirmationMessage);
            if (!confirmed) {
                return;
            }
        }
        loadDefaultTemplate();
        presetValue(defaultInput);
        document.querySelectorAll('.column').forEach((element) => {
            element.scrollTo({top: 0});
        });
    };

    let presetValue = (value) => {
        editor.setValue(value);
        editor.moveCursorTo(0, 0);
        editor.focus();
        editor.navigateLineEnd();
        hasEdited = false;
    };

    // ----- sync scroll position -----

    function syncScrolling(reference, target) {
        let ratio = reference.scrollTop / (reference.scrollHeight - reference.clientHeight);
        let targetY = (target.scrollHeight - target.clientHeight) * ratio;
        target.scrollTo(0, targetY);
    }

    let debounceTimeout;

    function scrollEditor(event) {
        const wrapper = document.getElementById('preview');
        const iframeDoc = wrapper.contentDocument || wrapper.contentWindow.document;
        const preview = iframeDoc.scrollingElement;

        iframeDoc.removeEventListener('scroll', scrollPreview);
        clearTimeout(debounceTimeout);

        syncScrolling(event.currentTarget, preview);

        debounceTimeout = setTimeout(() => {
            iframeDoc.addEventListener('scroll', scrollPreview);
        }, 100);
    }

    function scrollPreview(event) {
        const editor = document.querySelector('#edit');
        editor.removeEventListener('scroll', scrollEditor);
        clearTimeout(debounceTimeout);

        syncScrolling(event.currentTarget.scrollingElement, editor);

        debounceTimeout = setTimeout(() => {
            editor.addEventListener('scroll', scrollEditor);
        }, 100);
    }

    // ----- clipboard utils -----

    let copyToClipboard = (text, successHandler, errorHandler) => {
        navigator.clipboard.writeText(text).then(
            () => {
                successHandler();
            },

            () => {
                errorHandler();
            }
        );
    };

    let notifyCopied = () => {
        let labelElement = document.querySelector("#copy-button a");
        labelElement.innerHTML = "<i class=\"fa-solid fa-copy\"></i> Copied!";
        setTimeout(() => {
            labelElement.innerHTML = "<i class=\"fa-solid fa-copy\"></i> Copy";
        }, 1000)
    };

    // ----- drive -----

    function getIdFromUrl(url) {
        return url.match(/[-\w]{25,}/);
    }

    let addGoogleDriveImage = () => {
        function addImage() {
            let imageUrl = prompt("Please type the Google Drive image URL");
            if (imageUrl !== null) {
                let id = getIdFromUrl(imageUrl)[0];
                let url = `https://drive.google.com/thumbnail?id=${id}&sz=w1000`
                editor.session.insert(editor.getCursorPosition(), `![Image](${url})`);
            }
        }

        document.querySelector("#add-image-button").addEventListener('click', addImage);
    }

    let addGoogleDriveFile = () => {
        function addFile() {
            let fileUrl = prompt("Please type the Google Drive file URL");
            if (fileUrl !== null) {
                let id = getIdFromUrl(fileUrl)[0];
                let url = `https://drive.google.com/uc?export=download&id=${id}`
                editor.session.insert(editor.getCursorPosition(), `[<button> [Button Name] </button>](${url})`);
            }
        }

        document.querySelector("#add-file-button").addEventListener('click', addFile);
    }

    // ----- setup -----

    // setup navigation actions
    let setupResetButton = () => {
        document.querySelector("#reset-button").addEventListener('click', (event) => {
            event.preventDefault();
            reset();
        });
    };

    let setupCopyButton = (editor) => {
        function copy() {
            let value = editor.getValue();
            copyToClipboard(value, () => {
                    notifyCopied();
                },
                () => {
                    // nothing to do
                });
        }

        document.querySelector("#copy-button").addEventListener('click', (event) => {
            event.preventDefault();
            copy();
        });
    };

    let setupLoadButton = () => {
        document.querySelector("#load-button").addEventListener('click', (event) => {
            event.preventDefault();
            loadMD();
        });
    };

    let setupSaveButton = () => {
        document.querySelector("#save-button").addEventListener('click', (event) => {
            event.preventDefault();
            saveMD();
        });
    };

    // ----- local state -----

    let loadLastContent = () => {
        return Storehouse.getItem(localStorageNamespace, localStorageKey);
    };

    let saveLastContent = (content) => {
        let expiredAt = new Date(2099, 1, 1);
        Storehouse.setItem(localStorageNamespace, localStorageKey, content, expiredAt);
    };

    // ----- load save button ----

    self.currentFileName = 'document.md';
    let loadMD = () => {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = '.md';
        input.onchange = (e) => {
            const file = e.target.files[0];
            if (file) {
                const reader = new FileReader();
                reader.onload = (ev) => {
                    presetValue(ev.target.result)
                    self.currentFileName = file.name; // Update filename
                };
                reader.readAsText(file);
            }

            document.body.removeChild(input); // Remove the input element after usage
        };

        input.click(); // Trigger file input click
    }

    let saveMD = () => {
        const blob = new Blob([editor.getValue()], {type: 'text/plain'});
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');

        link.href = url;
        link.download = currentFileName; // Use the current file name for saving
        document.body.appendChild(link);
        link.click();

        // Clean up
        URL.revokeObjectURL(url);
        document.body.removeChild(link); // Remove the link element after usage
    }

    // ----- load template ----

    let loadDefaultTemplate = () => {
        const defaultTemplate = 'default-template.html';
        fetch(defaultTemplate)
            .then(response => {
                if (!response.ok) {
                    throw new Error(`Could not fetch ${defaultTemplate}: ${response.statusText}`);
                }
                return response.text();
            })
            .then(html => {
                placeTemplate(html);
            });
    }

    let setupTemplateLoad = () => {
        const modal = document.getElementById("load-template-modal");
        const btn = document.getElementById("load-template");
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = '.html';

        btn.onclick = function () {
            input.click();
        }

        input.addEventListener('change', handleTemplate);

        function handleTemplate(event) {
            const file = event.target.files[0];

            if (!file)
                return;

            const reader = new FileReader();
            reader.onload = async function (e) {
                const contents = e.target.result;
                await placeTemplate(contents);
                modal.style.display = "none";
            }

            reader.readAsText(file);
        }

        loadDefaultTemplate();
    }

    let placeTemplate = async function (template) {
        const wrapper = document.getElementById('preview');

        try {
            const iframeDoc = wrapper.contentDocument || wrapper.contentWindow.document;
            iframeDoc.open();
            iframeDoc.write(template);
            iframeDoc.close();
            editContent(ace.edit('editor').getValue())

            const edit = document.querySelector('#edit');
            const preview = iframeDoc;
            edit.addEventListener('scroll', scrollEditor);
            preview.addEventListener('scroll', scrollPreview);
        } catch (e) {
            console.error(e);
        }
    }

    let editContent = (value) => {
        const wrapper = document.getElementById('preview');
        const iframeDoc = wrapper.contentDocument || wrapper.contentWindow.document;

        if (!iframeDoc || !iframeDoc.body || !iframeDoc.body.childNodes.length)
            return;

        let style = wrapper.contentWindow.document.querySelector("style");
        const defaultTemplate = 'css/markdown.css';
        fetch(defaultTemplate)
            .then(response => {
                if (!response.ok) {
                    throw new Error(`Could not fetch ${defaultTemplate}: ${response.statusText}`);
                }
                return response.text();
            })
            .then(css => {
                style.innerHTML += css;
            });

        wrapper.contentWindow.document.getElementById('output').innerHTML = convert(value);
    }

    // ----- divider resize ----

    let setupDividerResize = () => {
        const container = document.getElementById('container');
        const edit = document.getElementById('edit');
        const preview = document.getElementById('preview');
        const divider = document.getElementById('divider');

        let isDragging = false;
        let dividerPosition = 50;

        divider.addEventListener('mousedown', function (event) {
            isDragging = true;
            document.body.style.cursor = 'ew-resize';
            dividerPosition = (event.clientX / container.offsetWidth) * 100;
            event.preventDefault();
        });

        function clamp(num, min, max) {
            return num <= min ? min : num >= max ? max : num
        }

        function moveDivider(event) {
            if (!isDragging) return;

            dividerPosition = clamp(dividerPosition + event.movementX / container.offsetWidth * 100, 0, 100);
            const newLeftWidth = dividerPosition;
            const newRightWidth = 100 - newLeftWidth;

            edit.style.flexBasis = `${newLeftWidth}%`;
            preview.style.flexBasis = `${newRightWidth}%`;
        }

        document.addEventListener('mousemove', moveDivider);

        document.addEventListener('mouseup', function () {
            isDragging = false;
            document.body.style.cursor = 'default';
        });

        const wrapper = document.getElementById('preview');
        wrapper.onload = function () {
            const iframeDoc = wrapper.contentDocument || wrapper.contentWindow.document;
            iframeDoc.addEventListener('mousemove', moveDivider);
            iframeDoc.addEventListener('mouseup', function () {
                isDragging = false;
                document.body.style.cursor = 'default';
            });
        }
    }

    // ----- export button ----

    let setupExportButton = () => {
        const exportButton = document.getElementById('export-mail');
        const iframe = document.getElementById('preview');

        function minifyHTML(html) {
            return html
                .replace(/<!--[\s\S]*?-->/g, '')
                .replace(/\s+/g, ' ')
                .replace(/>\s</g, '><')
                .trim();
        }

        function exportEmail() {
            const iframeDoc = iframe.contentDocument || iframe.contentWindow.document;
            const iframeHtml = minifyHTML(iframeDoc.documentElement.outerHTML);

            const blob = new Blob([iframeHtml], {type: 'text/html'});
            const link = document.createElement('a');
            link.href = URL.createObjectURL(blob);
            link.download = 'email.html';

            link.click();
        }

        exportButton.addEventListener('click', exportEmail);
    }

    // ----- editor shortcuts -----

    let setupAddHeadingButton = () => {
        function addHeading() {
            let position = {row: editor.getCursorPosition().row, column: 0};
            let character = editor.session.getLine(position.row).charAt(0);
            if (character === ' ' || character === '#')
                editor.session.insert(position, '#');
            else
                editor.session.insert(position, '# ');
        }

        document.querySelector("#add-heading-button").addEventListener('click', addHeading);
    }

    let setupAddBulletedListButton = () => {
        function addBulletedList() {
            let position = {row: editor.getCursorPosition().row, column: 0};
            let character = editor.session.getLine(position.row).charAt(0);
            if (character === ' ')
                editor.session.insert(position, '-');
            else if (character !== '-')
                editor.session.insert(position, '- ');
        }

        document.querySelector("#add-bullet-list-button").addEventListener('click', addBulletedList);
    }

    let setupAddNumberedListButton = () => {
        function addNumberedList() {
            let position = {row: editor.getCursorPosition().row, column: 0};
            let character = editor.session.getLine(position.row).charAt(0);
            if (character === ' ')
                editor.session.insert(position, '1.');
            else
                editor.session.insert(position, '1. ');
        }

        document.querySelector("#add-number-list-button").addEventListener('click', addNumberedList);
    }

    let setupAddQuoteButton = () => {
        function addQuote() {
            let position = {row: editor.getCursorPosition().row, column: 0};
            let character = editor.session.getLine(position.row).charAt(0);
            if (character === ' ' || character === '>')
                editor.session.insert(position, '>');
            else
                editor.session.insert(position, '> ');
        }

        document.querySelector("#add-quote-button").addEventListener('click', addQuote);
    }

    function deleteCharacterAtPosition(row, column, length) {
        let range = new ace.Range(row, column, row, column + length);
        editor.session.getDocument().remove(range);
    }

    function addStyle(opening, closing) {
        let range = editor.selection.getRange();

        function getStartStringExclusive() {
            const firstCharacterLine = editor.session.getLine(range.start.row);
            const startString = firstCharacterLine.substring(range.start.column - opening.length, range.start.column);
            return startString === opening;
        }

        function getEndStringExclusive() {
            const lastCharacterLine = editor.session.getLine(range.end.row);
            const closingString = lastCharacterLine.substring(range.end.column, range.end.column + closing.length);
            return closingString === closing;
        }

        function getStartStringInclusive() {
            const firstCharacterLine = editor.session.getLine(range.start.row);
            const startString = firstCharacterLine.substring(range.start.column, range.start.column + opening.length);
            return startString === opening;
        }

        function getEndStringInclusive() {
            const lastCharacterLine = editor.session.getLine(range.end.row);
            const closingString = lastCharacterLine.substring(range.end.column - closing.length, range.end.column);
            return closingString === closing;
        }

        if (getStartStringExclusive() && getEndStringExclusive()) {
            deleteCharacterAtPosition(range.end.row, range.end.column, closing.length);
            deleteCharacterAtPosition(range.start.row, range.start.column - opening.length, opening.length);
        } else if (getStartStringInclusive() && getEndStringInclusive()) {
            deleteCharacterAtPosition(range.end.row, range.end.column - closing.length, closing.length);
            deleteCharacterAtPosition(range.start.row, range.start.column, opening.length);
        } else {
            editor.session.insert({row: range.end.row, column: range.end.column}, closing);
            editor.session.insert({row: range.start.row, column: range.start.column}, opening);
            editor.selection.setRange({
                start: {row: range.start.row, column: range.start.column},
                end: {row: range.end.row, column: range.end.column + opening.length + closing.length}
            })
        }
    }

    let setupAddItalicButton = () => {
        document.querySelector("#add-italic-button").addEventListener('click', () => {
            addStyle('_', '_')
        });
    }

    let setupAddBoldButton = () => {
        document.querySelector("#add-bold-button").addEventListener('click', () => {
            addStyle('**', '**')
        });
    }

    // ----- entry point -----

    setupMarked();
    let lastContent = loadLastContent();
    editor = setupEditor();
    if (lastContent) {
        presetValue(lastContent);
    } else {
        presetValue(defaultInput);
    }
    setupResetButton();
    setupCopyButton(editor);
    setupLoadButton();
    setupSaveButton();
    setupDividerResize();
    setupTemplateLoad();
    setupExportButton();

    addGoogleDriveImage();
    addGoogleDriveFile();

    setupAddHeadingButton();
    setupAddBulletedListButton();
    setupAddNumberedListButton();
    setupAddQuoteButton();
    setupAddItalicButton();
    setupAddBoldButton();
});
