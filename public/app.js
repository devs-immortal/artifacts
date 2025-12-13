const filesContainer = document.getElementById('files');
const breadcrumbs = document.getElementById('breadcrumbs');
const backButton = document.getElementById('back-button');

const mods = ['bind-cmd', 'chest-colorizer', 'paradise-lost', 'test-mod'];
const root = {
    name: '',
    children: [],
};

let currentPath = [];

const loadDir = async (paths) => {
    return Promise.all(
        paths.map(async (path) => {
            const response = await fetch(`/artifacts/${path}`);
            if (!response.ok)
                throw new Error(
                    `Failed to load directory: ${response.statusText}`,
                );
            const data = await response.json();
            return { name: path, items: data };
        }),
    );
};

const normalizePath = (rawPath) =>
    rawPath.replace(/\/+$/, '').replace(/^\//, '');

const getPathFromLocation = () => {
    const cleaned = normalizePath(window.location.pathname);
    return cleaned ? cleaned.split('/').filter(Boolean) : [];
};

const resolveDirectory = (pathSegments) => {
    const resolved = [];
    let node = root;

    for (const segment of pathSegments) {
        const next = (node.children || []).find(
            (child) => child.children && child.name === segment,
        );
        if (!next) return { node: root, path: [] };
        resolved.push(segment);
        node = next;
    }

    return { node, path: resolved };
};

const formatTimestamp = (entry) => {
    const value = entry.modified || entry.created;
    if (!value) return '';
    const date = new Date(value);
    if (Number.isNaN(date)) return '';
    return date.toISOString().replace('T', ' ').split('.')[0];
};

const updateBackButton = (path) => {
    if (!backButton) return;
    backButton.disabled = path.length === 0;
};

const renderDirectory = (pathSegments) => {
    const { node, path } = resolveDirectory(pathSegments);
    currentPath = path;
    filesContainer.innerHTML = '';
    breadcrumbs.textContent = `/${path.join('/') || ''}` || '/';
    updateBackButton(path);

    if (!node.children || node.children.length === 0) {
        const empty = document.createElement('div');
        empty.className = 'file empty-state';
        empty.textContent = 'This directory is empty.';
        filesContainer.appendChild(empty);
        return;
    }

    for (const entry of node.children) {
        const link = document.createElement('a');
        link.className = 'file';

        const name = document.createElement('span');
        name.className = 'file-name';

        const meta = document.createElement('span');
        meta.className = 'file-meta';
        const metaText = formatTimestamp(entry);
        meta.textContent = metaText || (entry.children ? '' : '—');

        if (entry.children) {
            const nextPath = [...path, entry.name];
            link.href = `/${nextPath.join('/')}/`;
            name.innerHTML = `<i class="ph-fill ph-folder-simple"></i> ${entry.name}`;
            link.addEventListener('click', (event) => {
                event.preventDefault();
                navigateTo(nextPath);
            });
        } else {
            if (entry.expired) {
                link.classList.add('expired');
                name.innerHTML = `<i class="ph ph-file-dashed"></i> ${entry.name}`;
            } else {
                link.href = entry.url;
                link.download = entry.name;
                name.innerHTML = `<i class="ph ph-file"></i> ${entry.name}`;
            }
        }

        link.appendChild(name);
        link.appendChild(meta);
        filesContainer.appendChild(link);
    }
};

const navigateTo = (pathSegments, { replace = false } = {}) => {
    const method = replace ? 'replaceState' : 'pushState';
    const urlPath = `/${pathSegments.join('/')}`;
    history[method]({ path: pathSegments }, '', urlPath || '/');
    renderDirectory(pathSegments);
};

if (backButton) {
    backButton.addEventListener('click', () => {
        if (currentPath.length === 0) return;
        const parentPath = currentPath.slice(0, -1);
        navigateTo(parentPath);
    });
}

window.addEventListener('popstate', (event) => {
    const path =
        event.state?.path ?? resolveDirectory(getPathFromLocation()).path;
    renderDirectory(path);
});

loadDir(mods)
    .then((data) => {
        for (const { name, items } of data) {
            root.children.push({
                name: name,
                children: items.map((item) => ({
                    name: `artifact-${item.name.slice(0, 7)}.zip`,
                    expired: item.expired,
                    url: item.url,
                    created: item.created,
                })),
            });
        }

        const initialPath = resolveDirectory(getPathFromLocation()).path;
        navigateTo(initialPath, { replace: true });
    })
    .catch((error) => {
        console.error('Error loading directory:', error);
    });
