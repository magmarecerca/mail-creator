document.addEventListener("DOMContentLoaded", () => {
    let hasEdited = false;
    let editor = null;

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
            fontFamily: 'JetBrains Mono'
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

    function syncScrolling(reference, target){
        let ratio = reference.scrollTop / (reference.scrollHeight - reference.clientHeight);
        let targetY = (target.scrollHeight - target.clientHeight) * ratio;
        target.scrollTo(0, targetY);
    }

    function scrollEditor(event){
        const preview = document.querySelector('#preview');
        preview.removeEventListener('scroll', scrollPreview);

        syncScrolling(event.currentTarget, preview);

        setTimeout(() => {
            preview.addEventListener('scroll', scrollPreview);
        }, 0);
    }

    function scrollPreview(event){
        const editor = document.querySelector('#edit');
        editor.removeEventListener('scroll', scrollEditor);

        syncScrolling(event.currentTarget, editor);

        setTimeout(() => {
            editor.addEventListener('scroll', scrollEditor);
        }, 0);
    }

    document.querySelector('#edit').addEventListener('scroll', scrollEditor);

    document.querySelector('#preview').addEventListener('scroll', scrollPreview);

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

    function getIdFromUrl(url) { return url.match(/[-\w]{25,}/); }

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
        let lastContent = Storehouse.getItem(localStorageNamespace, localStorageKey);
        return lastContent;
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
        const textarea =

            input.onchange = (e) => {
                const file = e.target.files[0];
                if (file) {
                    const reader = new FileReader();
                    reader.onload = (ev) => {
                        presetValue(ev.target.result)
                        currentFileName = file.name; // Update filename
                    };
                    reader.readAsText(file);
                }

                document.body.removeChild(input); // Remove the input element after usage
            };

        input.click(); // Trigger file input click
    }

    let saveMD = () => {
        const blob = new Blob([editor.getValue()], { type: 'text/plain' });
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

    // ----- divider resize ----

    let setupDividerResize = () => {
        const container = document.getElementById('container');
        const edit = document.getElementById('edit');
        const preview = document.getElementById('preview');
        const divider = document.getElementById('divider');

        let isDragging = false;

        // Saat user mulai drag
        divider.addEventListener('mousedown', function(e) {
            isDragging = true;
            document.body.style.cursor = 'ew-resize';
        });

        document.addEventListener('mousemove', function(e) {
            if (!isDragging) return;

            // Dapatkan lebar total container
            const containerWidth = container.offsetWidth;

            // Hitung posisi relatif dari mouse terhadap container
            const newLeftWidth = (e.clientX / containerWidth) * 100;
            const newRightWidth = 100 - newLeftWidth;

            // Update lebar edit dan preview
            edit.style.flexBasis = `${newLeftWidth}%`;
            preview.style.flexBasis = `${newRightWidth}%`;
        });

        document.addEventListener('mouseup', function() {
            isDragging = false;
            document.body.style.cursor = 'default';
        });
    }


    // ----- entry point -----

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

    addGoogleDriveImage()
    addGoogleDriveFile()
});
