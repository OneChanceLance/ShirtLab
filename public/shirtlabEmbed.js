class ShirtLabEmbed extends window.HTMLElement {
    connectedCallback() {
        const iframe = document.createElement("iframe");
        iframe.title = "shirtlab";
        iframe.src = "https://shirtlab-by-sod.web.app/";
        iframe.allow = "clipboard-write; fullscreen; web-share";
        iframe.loading = "lazy";
        iframe.style.width = "100%";
        iframe.style.height = "35rem"; // default height before resize
        iframe.style.border = "none";
        iframe.style.borderRadius = "1rem";
        iframe.style.transition = "height 0.3s ease"; // smooth resizing
        this.appendChild(iframe);

        // listen for resize messages from the iframe content
        window.addEventListener("message", (e) => {
            if (e.data?.type === "resize-iframe") {
                const newHeight = `${e.data.height}px`;
                if (iframe.style.height !== newHeight) {
                    iframe.style.height = newHeight;
                }
            }
        });
    }
}

// register the element
customElements.define("shirtlab-embed", ShirtLabEmbed);