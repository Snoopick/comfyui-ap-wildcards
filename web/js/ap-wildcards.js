import { app } from "../../../scripts/app.js";

function createCustomWildcardSelector(node) {
    const textWidget = node.widgets?.find(w => w.name === "text_input");
    if (!textWidget) return;

    const container = document.createElement("div");
    container.style.margin = "10px 0 5px 0";
    container.style.width = "100%";
    container.style.position = "relative";
    container.style.overflow = "visible";

    const searchInput = document.createElement("input");
    searchInput.type = "text";
    searchInput.placeholder = "🔍 Search wildcards...";
    searchInput.style.width = "100%";
    searchInput.style.padding = "6px";
    searchInput.style.backgroundColor = "#2a2a2a";
    searchInput.style.color = "#ccc";
    searchInput.style.border = "1px solid #555";
    searchInput.style.borderRadius = "4px";
    searchInput.style.fontSize = "12px";
    searchInput.style.boxSizing = "border-box";

    const treeContainer = document.createElement("div");
    treeContainer.style.width = "100%";
    treeContainer.style.overflowY = "auto";
    treeContainer.style.overflowX = "hidden";
    treeContainer.style.backgroundColor = "#1a1a1a";
    treeContainer.style.border = "1px solid #555";
    treeContainer.style.borderRadius = "4px";
    treeContainer.style.marginTop = "5px";
    treeContainer.style.boxSizing = "border-box";
    treeContainer.style.maxHeight = "200px";

    // Templates block
    const templatesContainer = document.createElement("div");
    templatesContainer.style.marginTop = "10px";
    templatesContainer.style.display = "flex";
    templatesContainer.style.flexWrap = "wrap";
    templatesContainer.style.gap = "5px";
    templatesContainer.style.alignItems = "center";

    const templateSelect = document.createElement("select");
    templateSelect.style.flex = "2";
    templateSelect.style.padding = "4px";
    templateSelect.style.backgroundColor = "#2a2a2a";
    templateSelect.style.color = "#ccc";
    templateSelect.style.border = "1px solid #555";
    templateSelect.style.borderRadius = "4px";

    const loadBtn = document.createElement("button");
    loadBtn.textContent = "Load";
    loadBtn.style.padding = "4px 8px";
    loadBtn.style.backgroundColor = "#3a6ea5";
    loadBtn.style.color = "#fff";
    loadBtn.style.border = "none";
    loadBtn.style.borderRadius = "4px";
    loadBtn.style.cursor = "pointer";

    const saveBtn = document.createElement("button");
    saveBtn.textContent = "Save";
    saveBtn.style.padding = "4px 8px";
    saveBtn.style.backgroundColor = "#5a6e3a";
    saveBtn.style.color = "#fff";
    saveBtn.style.border = "none";
    saveBtn.style.borderRadius = "4px";
    saveBtn.style.cursor = "pointer";

    const deleteBtn = document.createElement("button");
    deleteBtn.textContent = "Delete";
    deleteBtn.style.padding = "4px 8px";
    deleteBtn.style.backgroundColor = "#a53a3a";
    deleteBtn.style.color = "#fff";
    deleteBtn.style.border = "none";
    deleteBtn.style.borderRadius = "4px";
    deleteBtn.style.cursor = "pointer";

    const newTemplateName = document.createElement("input");
    newTemplateName.type = "text";
    newTemplateName.placeholder = "New template name";
    newTemplateName.style.flex = "2";
    newTemplateName.style.padding = "4px";
    newTemplateName.style.backgroundColor = "#2a2a2a";
    newTemplateName.style.color = "#ccc";
    newTemplateName.style.border = "1px solid #555";
    newTemplateName.style.borderRadius = "4px";

    templatesContainer.appendChild(templateSelect);
    templatesContainer.appendChild(loadBtn);
    templatesContainer.appendChild(saveBtn);
    templatesContainer.appendChild(deleteBtn);
    templatesContainer.appendChild(newTemplateName);

    let wildcardsData = [];
    let wildcardsCounts = {};
    let resizeObserver = null;
    let widgetsAreaRef = null;

    async function loadTemplatesList() {
        try {
            const resp = await fetch("/ap-wildcards/templates");
            if (!resp.ok) throw new Error();
            const names = await resp.json();
            templateSelect.innerHTML = '<option value="">-- Select template --</option>';
            names.forEach(name => {
                const opt = document.createElement("option");
                opt.value = name;
                opt.textContent = name;
                templateSelect.appendChild(opt);
            });
        } catch (e) {}
    }

    async function saveTemplate() {
        const name = newTemplateName.value.trim();
        if (!name) { alert("Enter template name"); return; }
        const content = textWidget.value;
        try {
            await fetch("/ap-wildcards/save_template", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ name, content })
            });
            newTemplateName.value = "";
            await loadTemplatesList();
        } catch (e) { alert("Save failed"); }
    }

    async function loadTemplate() {
        const name = templateSelect.value;
        if (!name) return;
        try {
            const resp = await fetch("/ap-wildcards/load_template", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ name })
            });
            const data = await resp.json();
            if (data.content !== undefined) {
                textWidget.value = data.content;
                if (textWidget.callback) textWidget.callback(textWidget.value);
            }
        } catch (e) { alert("Load failed"); }
    }

    async function deleteTemplate() {
        const name = templateSelect.value;
        if (!name) { alert("Select a template to delete"); return; }
        if (!confirm(`Delete template "${name}"?`)) return;
        try {
            const resp = await fetch("/ap-wildcards/delete_template", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ name })
            });
            const data = await resp.json();
            if (data.success) {
                await loadTemplatesList();
                templateSelect.value = "";
            } else {
                alert(data.error || "Delete failed");
            }
        } catch(e) { alert("Delete failed"); }
    }

    loadBtn.onclick = loadTemplate;
    saveBtn.onclick = saveTemplate;
    deleteBtn.onclick = deleteTemplate;

    async function loadWildcards() {
        try {
            const [listResp, countsResp] = await Promise.all([
                fetch("/ap-wildcards/list"),
                fetch("/ap-wildcards/counts")
            ]);
            if (!listResp.ok || !countsResp.ok) throw new Error();
            wildcardsData = await listResp.json();
            wildcardsCounts = await countsResp.json();
            renderTree(searchInput.value);
        } catch (error) {
            treeContainer.innerHTML = "<div style='padding:8px;color:red;'>Error loading wildcards</div>";
        }
    }

    function buildTree(paths) {
        const root = {};
        for (const path of paths) {
            const parts = path.split('/');
            let current = root;
            for (let i = 0; i < parts.length - 1; i++) {
                const part = parts[i];
                if (!current[part]) current[part] = {};
                current = current[part];
            }
            const category = parts[parts.length - 1];
            if (!current._categories) current._categories = [];
            current._categories.push({ fullPath: path, name: category });
        }
        return root;
    }

    function getFolderCount(node, counts) {
        let total = 0;
        if (node._categories) {
            node._categories.forEach(cat => {
                total += counts[cat.fullPath] || 0;
            });
        }
        for (const key in node) {
            if (key !== '_categories' && node.hasOwnProperty(key)) {
                total += getFolderCount(node[key], counts);
            }
        }
        return total;
    }

    function createTreeNode(treeNode, parentElement, level = 0, filterText = "") {
        const keys = Object.keys(treeNode).filter(k => k !== '_categories').sort();
        const categories = treeNode._categories || [];
        let hasVisibleChild = false;

        categories.forEach(cat => {
            const matches = filterText === "" || cat.name.toLowerCase().includes(filterText.toLowerCase()) || cat.fullPath.toLowerCase().includes(filterText.toLowerCase());
            if (matches) {
                hasVisibleChild = true;
                const count = wildcardsCounts[cat.fullPath] || 0;
                const item = document.createElement("div");
                item.style.padding = `${6}px ${8 + level * 16}px`;
                item.style.color = "#aaa";
                item.style.fontSize = "12px";
                item.style.cursor = "pointer";
                item.style.borderBottom = "1px solid #252525";
                item.textContent = `🏷️ ${cat.name} (${count})`;
                item.onmouseover = () => item.style.backgroundColor = "#333";
                item.onmouseout = () => item.style.backgroundColor = "transparent";
                item.onclick = (e) => {
                    e.stopPropagation();
                    selectWildcard(cat.fullPath);
                };
                parentElement.appendChild(item);
            }
        });

        for (const key of keys) {
            const childTree = treeNode[key];
            const childDiv = document.createElement("div");
            const hasVisible = createTreeNode(childTree, childDiv, level + 1, filterText);
            const folderCount = getFolderCount(childTree, wildcardsCounts);
            if (hasVisible || filterText === "" || key.toLowerCase().includes(filterText.toLowerCase())) {
                hasVisibleChild = true;
                const header = document.createElement("div");
                header.style.padding = `${6}px ${8 + level * 16}px`;
                header.style.color = "#fff";
                header.style.fontWeight = "bold";
                header.style.fontSize = "12px";
                header.style.cursor = "pointer";
                header.style.borderBottom = "1px solid #333";
                header.textContent = `📁 ${key} (${folderCount})`;
                let isExpanded = filterText !== "";
                const childrenDiv = document.createElement("div");
                childrenDiv.style.display = isExpanded ? "block" : "none";
                header.onclick = (e) => {
                    e.stopPropagation();
                    isExpanded = !isExpanded;
                    childrenDiv.style.display = isExpanded ? "block" : "none";
                    header.textContent = `${isExpanded ? '📂' : '📁'} ${key} (${folderCount})`;
                    setTimeout(() => updateTreeMaxHeight(), 10);
                };
                header.onmouseover = () => header.style.backgroundColor = "#3a3a3a";
                header.onmouseout = () => header.style.backgroundColor = "transparent";
                childrenDiv.appendChild(childDiv);
                const folderDiv = document.createElement("div");
                folderDiv.appendChild(header);
                folderDiv.appendChild(childrenDiv);
                parentElement.appendChild(folderDiv);
            }
        }
        return hasVisibleChild;
    }

    function renderTree(filterText = "") {
        treeContainer.innerHTML = "";
        if (!wildcardsData.length) {
            const emptyMsg = document.createElement("div");
            emptyMsg.textContent = "No wildcards found";
            emptyMsg.style.padding = "8px";
            emptyMsg.style.color = "#888";
            emptyMsg.style.textAlign = "center";
            treeContainer.appendChild(emptyMsg);
        } else {
            const tree = buildTree(wildcardsData);
            const rootDiv = document.createElement("div");
            createTreeNode(tree, rootDiv, 0, filterText);
            treeContainer.appendChild(rootDiv);
        }
        updateTreeMaxHeight();
    }

    function selectWildcard(fullPath) {
        if (!fullPath) return;
        const wildcardText = `__${fullPath}__`;
        let currentText = textWidget.value || "";
        currentText = currentText.replace(/[, ]+$/, "");
        if (!currentText) textWidget.value = wildcardText;
        else if (currentText.endsWith(",") || currentText.endsWith(" ")) textWidget.value = currentText + wildcardText;
        else textWidget.value = currentText + ", " + wildcardText;
        
        if (textWidget.callback) textWidget.callback(textWidget.value);
    }

    function updateTreeMaxHeight() {
        const widgetArea = container.parentElement;
        if (!widgetArea) return;

        const areaHeight = widgetArea.clientHeight || 300;
        const inputHeight = searchInput.offsetHeight || 30;
        const templateHeight = templatesContainer.offsetHeight || 30;
        const margins = 15;

        let available = areaHeight - inputHeight - templateHeight - margins - 10;
        if (available < 60) available = 60;
        if (available > 300) available = 300;

        treeContainer.style.maxHeight = `${available}px`;
    }

    searchInput.oninput = () => {
        renderTree(searchInput.value);
    };

    container.appendChild(searchInput);
    container.appendChild(treeContainer);
    container.appendChild(templatesContainer);

    node.addDOMWidget("custom_wildcard_selector", "custom", container, {
        getValue: () => searchInput.value,
        setValue: (val) => { searchInput.value = val; renderTree(val); },
        onRemove: () => {
            if (resizeObserver) resizeObserver.disconnect();
        }
    });

    const nodeEl = document.querySelector(`.comfy-node[data-id="${node.id}"]`);
    if (nodeEl) {
        widgetsAreaRef = nodeEl.querySelector('.comfy-widgets');
        if (widgetsAreaRef) {
            resizeObserver = new ResizeObserver(() => {
                requestAnimationFrame(() => updateTreeMaxHeight());
            });
            resizeObserver.observe(widgetsAreaRef);
        }
    }
    if (!resizeObserver) {
        resizeObserver = new ResizeObserver(() => {
            requestAnimationFrame(() => updateTreeMaxHeight());
        });
    }
    resizeObserver.observe(container);

    setTimeout(() => updateTreeMaxHeight(), 200);
    loadWildcards();
    loadTemplatesList();
}

app.registerExtension({
    name: "AP-Wildcards",
    async beforeRegisterNodeDef(nodeType, nodeData, app) {
        if (nodeData.name === "AP-Wildcards") {
            const onNodeCreated = nodeType.prototype.onNodeCreated;
            nodeType.prototype.onNodeCreated = function() {
                const result = onNodeCreated?.apply(this, arguments);
                if (this.size[1] < 400) {
                    this.setSize([this.size[0], 400]);
                }
                setTimeout(() => createCustomWildcardSelector(this), 100);
                return result;
            };
        }
    }
});