document.addEventListener("DOMContentLoaded", () => {
    function manageResize(md, sizeProp, posProp) {
        const r = md.target;

        const prev = r.previousElementSibling;
        const next = r.nextElementSibling;
        if (!prev || !next) {
            return;
        }

        md.preventDefault();

        let prevSize = prev[sizeProp];
        let nextSize = next[sizeProp];
        let lastPos = md[posProp];

        const sumSize = prevSize + nextSize;
        const prevGrow = Number(prev.style.flexGrow);
        const nextGrow = Number(next.style.flexGrow);
        const sumGrow = prevGrow + nextGrow;

        function onMouseMove(event) {
            let pos = event[posProp];
            const d = pos - lastPos;
            prevSize += d;
            nextSize -= d;
            if (prevSize < 0) {
                nextSize += prevSize;
                pos -= prevSize;
                prevSize = 0;
            }
            if (nextSize < 0) {
                prevSize += nextSize;
                pos += nextSize;
                nextSize = 0;
            }

            const prevGrowNew = sumGrow * (prevSize / sumSize);
            const nextGrowNew = sumGrow * (nextSize / sumSize);

            prev.style.flexGrow = prevGrowNew;
            next.style.flexGrow = nextGrowNew;

            lastPos = pos;
        }

        function onMouseUp() {
            window.removeEventListener("mousemove", onMouseMove);
            window.removeEventListener("mouseup", onMouseUp);
        }

        window.addEventListener("mousemove", onMouseMove);
        window.addEventListener("mouseup", onMouseUp);
    }

    function setupResizerEvents() {
        document.body.addEventListener("mousedown", function (md) {
            const target = md.target;
            if (target.nodeType !== 1 || target.tagName !== "FLEX-RESIZER") {
                return;
            }
            const parent = target.parentNode;
            const h = parent.classList.contains("h");
            const v = parent.classList.contains("v");
            if (h && v) {
                return;
            }
            if (h) {
                manageResize(md, "scrollWidth", "pageX");
                return;
            }
            if (v) {
                manageResize(md, "scrollHeight", "pageY");
            }
        });
    }

    setupResizerEvents();
});