document.addEventListener("DOMContentLoaded", () => {
    let hasEdited = false;

    const localStorageNamespace = 'com.markdownlivepreview';
    const localStorageKey = 'last_state';
    const confirmationMessage = 'Are you sure you want to reset? Your changes will be lost.';

    function stringIsNullOrEmpty(string){
        if (typeof string === "string" && string.length === 0 )
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
            if(stringIsNullOrEmpty(editor.getValue())){
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
        });

        var MarkdownMode = ace.require("ace/mode/markdown").Mode;
        editor.session.setMode(new MarkdownMode());

        editor.on('change', () => {
            let changed = editor.getValue() != defaultInput;
            if (changed) {
                hasEdited = true;
            }
            let value = editor.getValue();
            convert(value);
            saveLastContent(value);
        });

        return editor;
    };

    // Render markdown text as html
    let convert = (markdown) => {
        let options = {
            headerIds: false,
            mangle: false
        };
        let html = marked.parse(markdown, options);
        let sanitized = DOMPurify.sanitize(html);
        document.querySelector('#output').innerHTML = sanitized;
    };

    // Reset input text
    let reset = () => {
        let changed = editor.getValue() != defaultInput;
        if (hasEdited || changed) {
            var confirmed = window.confirm(confirmationMessage);
            if (!confirmed) {
                return;
            }
        }
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

    document.querySelector('#edit').addEventListener('scroll', (event) => {
        let editorElement = event.currentTarget;
        let ratio = editorElement.scrollTop / (editorElement.scrollHeight - editorElement.clientHeight);

        let previewElement = document.querySelector('#preview');
        let targetY = (previewElement.scrollHeight - previewElement.clientHeight) * ratio;
        previewElement.scrollTo(0, targetY);
    });

    document.querySelector('#preview').addEventListener('scroll', (event) => {
        let previewElement = event.currentTarget;
        let ratio = previewElement.scrollTop / (previewElement.scrollHeight - previewElement.clientHeight);

        let editorElement = document.querySelector('#edit');
        let targetY = (editorElement.scrollHeight - editorElement.clientHeight) * ratio;
        editorElement.scrollTo(0, targetY);
    });

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

    // ----- local state -----

    let loadLastContent = () => {
        let lastContent = Storehouse.getItem(localStorageNamespace, localStorageKey);
        return lastContent;
    };

    let saveLastContent = (content) => {
        let expiredAt = new Date(2099, 1, 1);
        Storehouse.setItem(localStorageNamespace, localStorageKey, content, expiredAt);
    };


    // ----- entry point -----

    let lastContent = loadLastContent();
    let editor = setupEditor();
    if (lastContent) {
        presetValue(lastContent);
    } else {
        presetValue(defaultInput);
    }
    setupResetButton();
    setupCopyButton(editor);
});
