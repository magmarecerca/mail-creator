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
            theme: 'ace/theme/chrome',
            fontFamily: 'JetBrains Mono'
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
        marked.use({ renderer });
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
        labelElement.innerHTML = "Copied!";
        setTimeout(() => {
            labelElement.innerHTML = "Copy";
        }, 1000)
    };

    // ----- drive -----

    function getIdFromUrl(url) {
        return url.match(/[-\w]{25,}/);
    }

    let addGoogleDriveImage = () => {
        document.querySelector("#add-image-button").addEventListener('click', () => {
            let imageUrl = prompt("Please type the Google Drive image URL");
            if (imageUrl !== null) {
                let id = getIdFromUrl(imageUrl)[0];
                let url = `https://drive.google.com/thumbnail?id=${id}&sz=w1000`
                editor.session.insert(editor.getCursorPosition(), `![Image](${url})`);
            }
        });
    }

    let addGoogleDriveFile = () => {
        document.querySelector("#add-file-button").addEventListener('click', () => {
            let fileUrl = prompt("Please type the Google Drive file URL");
            if (fileUrl !== null) {
                let id = getIdFromUrl(fileUrl)[0];
                let url = `https://drive.google.com/uc?export=download&id=${id}`
                editor.session.insert(editor.getCursorPosition(), `[<button> [Button Name] </button>](${url})`);
            }
        });
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
        document.querySelector("#copy-button").addEventListener('click', (event) => {
            event.preventDefault();
            let value = editor.getValue();
            copyToClipboard(value, () => {
                    notifyCopied();
                },
                () => {
                    // nothing to do
                });
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

        const span = document.getElementsByClassName("close")[0];

        btn.onclick = function () {
            modal.style.display = "block";
        }

        span.onclick = function () {
            modal.style.display = "none";
        }

        window.onclick = function (event) {
            if (event.target === modal) {
                modal.style.display = "none";
            }
        }

        document.querySelector("#load-template-modal input").addEventListener('change', handleTemplate);

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

        let style = wrapper.contentWindow.document.createElement("style");
        const defaultTemplate = 'css/github-markdown-light.min.css';
        fetch(defaultTemplate)
            .then(response => {
                if (!response.ok) {
                    throw new Error(`Could not fetch ${defaultTemplate}: ${response.statusText}`);
                }
                return response.text();
            })
            .then(css => {
                style.innerHTML = css;
            });
        wrapper.contentWindow.document.head.appendChild(style);

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

        exportButton.addEventListener('click', () => {
            const iframeDoc = iframe.contentDocument || iframe.contentWindow.document;
            const iframeHtml = minifyHTML(iframeDoc.documentElement.outerHTML);

            const blob = new Blob([iframeHtml], {type: 'text/html'});
            const link = document.createElement('a');
            link.href = URL.createObjectURL(blob);
            link.download = 'email.html';

            link.click();
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

    addGoogleDriveImage()
    addGoogleDriveFile()
});
