
/**
 * @jest-environment jsdom
 */

describe('Modal Navigation Performance', () => {
    let treeContainer;
    let folderCount = 1000; // Large number to make performance difference visible

    beforeEach(() => {
        document.body.innerHTML = '<div class="modal-bookmark-tree"></div>';
        treeContainer = document.querySelector('.modal-bookmark-tree');

        // Create a deep nested structure or a flat list? The original code handles nested.
        // Let's create a mix to be realistic.

        // Helper to create folder
        const createFolder = (id) => {
            const folder = document.createElement('div');
            folder.className = 'bookmark-folder';
            folder.dataset.id = id;
            folder.tabIndex = 0;
            return folder;
        };

        const createContent = () => {
            const content = document.createElement('div');
            content.className = 'folder-content';
            return content;
        };

        // Create 1000 folders.
        // Let's do 10 roots, each with 10 children, each with 10 children (1000 total)
        for (let i = 0; i < 10; i++) {
            const root = createFolder(`root-${i}`);
            treeContainer.appendChild(root);
            const content1 = createContent();
            treeContainer.appendChild(content1);

            for (let j = 0; j < 10; j++) {
                const child1 = createFolder(`child-${i}-${j}`);
                content1.appendChild(child1);
                const content2 = createContent();
                content1.appendChild(content2);

                for (let k = 0; k < 10; k++) {
                    const child2 = createFolder(`child-${i}-${j}-${k}`);
                    content2.appendChild(child2);
                }
            }
        }
    });

    test('Baseline: querySelectorAll on every keypress', () => {
        const folders = treeContainer.querySelectorAll('.bookmark-folder');

        // Simulate attaching listeners to EACH folder as in the original code
        folders.forEach(folder => {
            folder.addEventListener('keydown', (e) => {
                 if (e.key === 'ArrowDown') {
                    // Original logic
                    const allFolders = Array.from(treeContainer.querySelectorAll('.bookmark-folder'));
                    const index = allFolders.indexOf(folder);
                    const next = allFolders[index + 1] || allFolders[0];
                    if (next) next.focus();
                 }
            });
        });

        // Trigger events
        const start = performance.now();
        // Simulate pressing down arrow 500 times
        let current = folders[0];
        current.focus();

        for (let i = 0; i < 500; i++) {
            const event = new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true });
            current.dispatchEvent(event);
            current = document.activeElement;
        }

        const end = performance.now();
        console.log(`Baseline time: ${(end - start).toFixed(2)}ms`);
    });

    test('Optimization: Event Delegation + Cached List', () => {
        // Optimization setup
        const allFoldersCached = Array.from(treeContainer.querySelectorAll('.bookmark-folder'));

        treeContainer.addEventListener('keydown', (e) => {
            if (e.key === 'ArrowDown') {
                const target = e.target.closest('.bookmark-folder');
                if (!target) return;

                const index = allFoldersCached.indexOf(target);
                if (index !== -1) {
                    const next = allFoldersCached[index + 1] || allFoldersCached[0];
                    if (next) next.focus();
                }
            }
        });

        const folders = treeContainer.querySelectorAll('.bookmark-folder');

        // Trigger events
        const start = performance.now();
        let current = folders[0];
        current.focus();

        for (let i = 0; i < 500; i++) {
            const event = new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true });
            // Dispatch on the element, it will bubble to treeContainer
            current.dispatchEvent(event);
            current = document.activeElement;
        }

        const end = performance.now();
        console.log(`Optimized time: ${(end - start).toFixed(2)}ms`);
    });
});
