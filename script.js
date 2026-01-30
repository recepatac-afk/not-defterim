import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getFirestore, collection, doc, setDoc, deleteDoc, onSnapshot, updateDoc, query } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import firebaseConfig from './firebase-config.js';

// --- Firebase Init ---
// Using a known stable CDN version (10.7.1) to avoid 404s
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

console.log("Firebase başlatıldı.");

// --- Global State ---
let notes = [];
let educationGroups = [];

// --- Global Functions (Attached to Window for HTML access) ---
window.toggleFavorite = async function (event, id) {
    if (event) event.stopPropagation();
    const note = notes.find(n => n.id === id);
    if (note) {
        try {
            await setDoc(doc(db, "notes", id), { ...note, isFavorite: !note.isFavorite });
        } catch (e) {
            console.error("Favori hatası:", e);
        }
    }
};

window.openModal = function (isEdit = false) {
    try {
        console.log("Modal açılıyor...", isEdit);
        const modal = document.getElementById('note-modal');
        const noteIdInput = document.getElementById('note-id');
        const noteTitleInput = document.getElementById('note-title');
        const noteContentInput = document.getElementById('note-content');
        const categorySelect = document.getElementById('note-category');
        const subCategoryInput = document.getElementById('note-subcategory-input');
        const canvas = document.getElementById('drawing-canvas');

        // Clear previous state for new notes
        if (!isEdit) {
            if (noteIdInput) noteIdInput.value = '';
            if (noteTitleInput) noteTitleInput.value = '';
            if (noteContentInput) noteContentInput.value = '';

            // --- SET DEFAULT WHITE BACKGROUND ---
            const wrapper = document.getElementById('note-content-wrapper');
            if (wrapper) {
                wrapper.style.backgroundColor = '#ffffff';
                if (noteContentInput) noteContentInput.style.color = '#1e293b'; // Dark text
            }
            // Update Palette UI
            document.querySelectorAll('.palette-color').forEach(el => {
                if (el.getAttribute('data-color') === '#ffffff') el.classList.add('active');
                else el.classList.remove('active');
            });

            // Context-aware defaults
            if (currentCategory && currentCategory !== 'all' && categorySelect) {
                categorySelect.value = currentCategory;

                if (currentCategory === 'egitim') {
                    if (subCategoryInput) {
                        subCategoryInput.style.display = 'block';
                        // Populate suggestions
                        const dataList = document.getElementById('group-suggestions');
                        if (dataList) {
                            const allGroups = new Set(educationGroups);
                            notes.forEach(n => {
                                if (n.category === 'egitim' && n.subCategory) {
                                    allGroups.add(n.subCategory);
                                }
                            });
                            dataList.innerHTML = Array.from(allGroups).map(g => `<option value="${g}">`).join('');
                        }
                        if (currentSubCategory) subCategoryInput.value = currentSubCategory;
                    }
                }
            } else {
                if (categorySelect) categorySelect.value = 'genel';
                if (subCategoryInput) subCategoryInput.style.display = 'none';
            }

            // Clear canvas
            if (canvas) {
                const ctx = canvas.getContext('2d');
                ctx.clearRect(0, 0, canvas.width, canvas.height);
            }
            currentAttachments = [];
            renderAttachments();

            // Reset view to Text
            if (window.switchView) window.switchView('text');
        }

        if (modal) {
            modal.style.display = 'flex';
            // Focus title
            setTimeout(() => {
                if (noteTitleInput) noteTitleInput.focus();
            }, 100);
        } else {
            alert("Hata: 'note-modal' ID'li pencere bulunamadı!");
        }
    } catch (err) {
        console.error(err);
        alert("Modal Açılma Hatası: " + err.message);
    }
};

// --- Advanced Shape Logic ---
let selectedShape = null;
let isDragging = false;
let isResizing = false;
let startX, startY;
let startLeft, startTop;
let startWidth, startHeight;
let currentResizeHandle = null;

window.toggleShapeMenu = function () {
    const menu = document.getElementById('shape-menu');
    if (menu) menu.style.display = (menu.style.display === 'none' || menu.style.display === '') ? 'grid' : 'none';
};

// Insert Interactive Shape
window.insertShape = function (type) {
    const wrapper = document.getElementById('note-content-wrapper');
    // Ensure relative positioning
    wrapper.style.position = 'relative';

    const shapeId = 'shape-' + Date.now();
    const div = document.createElement('div');
    div.className = 'draggable-shape selected';
    div.id = shapeId;
    div.style.left = '50px';
    div.style.top = '50px';
    div.style.width = '100px';
    div.style.height = '100px';
    div.style.position = 'absolute';

    const color = '#3b82f6';
    let content = '';

    // Logic for specific shapes
    // Logic for specific shapes (EXCLUSIVE CHAIN)
    if (type === 'square') {
        div.style.border = `3px solid ${color}`;
        div.style.borderRadius = '0';
    } else if (type === 'rectangle' || type === 'rect') {
        div.style.border = `3px solid ${color}`;
        div.style.width = '160px'; // Wider for rect
        div.style.borderRadius = '0';
    } else if (type === 'circle') {
        div.style.border = `3px solid ${color}`;
        div.style.borderRadius = '50%';
    } else if (type === 'ellipse') {
        div.style.border = `3px solid ${color}`;
        div.style.borderRadius = '50%';
        div.style.width = '160px';
    } else if (type.startsWith('arrow')) {
        // ARROW LOGIC
        let rotation = 0;
        if (type.includes('down')) rotation = 90;
        if (type.includes('left')) rotation = 180;
        if (type.includes('up')) rotation = 270;

        div.style.border = 'none';
        div.style.display = 'flex';
        div.style.justifyContent = 'center';
        div.style.alignItems = 'center';
        div.innerHTML = `<i class="fa-solid fa-arrow-right" style="font-size: 3rem; color: ${color}; transform: rotate(${rotation}deg);"></i>`;
    } else if (type === 'star') {
        div.style.border = 'none';
        div.style.display = 'flex';
        div.style.justifyContent = 'center';
        div.style.alignItems = 'center';
        div.innerHTML = '<i class="fa-solid fa-star" style="font-size: 3rem; color: #f59e0b;"></i>';
    } else if (type === 'heart') {
        div.style.border = 'none';
        div.style.display = 'flex';
        div.style.justifyContent = 'center';
        div.style.alignItems = 'center';
        div.innerHTML = '<i class="fa-solid fa-heart" style="font-size: 3rem; color: #ec4899;"></i>';
    }

    // Add Text Area (Hidden by default or empty)
    const textarea = document.createElement('textarea');
    textarea.className = 'shape-text';
    textarea.placeholder = ''; // Empty placeholder
    textarea.style.position = 'absolute';
    textarea.style.width = '80%';
    textarea.style.height = '60%';
    textarea.style.background = 'transparent';
    textarea.style.border = 'none';
    textarea.style.resize = 'none';
    textarea.style.color = 'inherit';
    textarea.style.pointerEvents = 'none'; // Allow dragging via shape
    div.appendChild(textarea);

    // Edit Mode on Double Click
    div.addEventListener('dblclick', () => {
        div.classList.add('editing');
        textarea.style.pointerEvents = 'auto';
        textarea.focus();
    });

    textarea.addEventListener('blur', () => {
        div.classList.remove('editing');
        textarea.style.pointerEvents = 'none';
    });

    // Resize Handles (with inline styles)
    const handles = ['nw', 'ne', 'sw', 'se'];
    handles.forEach(h => {
        const span = document.createElement('span');
        span.className = `resize-handle handle-${h}`;
        span.setAttribute('data-handle', h);

        // Inline Handle Styles
        span.style.position = 'absolute';
        span.style.width = '20px';
        span.style.height = '20px';
        span.style.background = '#3b82f6';
        span.style.border = '2px solid white';
        span.style.borderRadius = '50%';
        span.style.zIndex = '1001';
        span.style.display = 'none'; // Hidden by default, shown on select

        if (h === 'nw') { span.style.top = '-10px'; span.style.left = '-10px'; span.style.cursor = 'nw-resize'; }
        if (h === 'ne') { span.style.top = '-10px'; span.style.right = '-10px'; span.style.cursor = 'ne-resize'; }
        if (h === 'sw') { span.style.bottom = '-10px'; span.style.left = '-10px'; span.style.cursor = 'sw-resize'; }
        if (h === 'se') { span.style.bottom = '-10px'; span.style.right = '-10px'; span.style.cursor = 'se-resize'; }

        div.appendChild(span);
    });

    wrapper.appendChild(div);

    // Select it immediately
    selectShape(div);

    // Attach Events (Mouse & Touch)
    attachShapeEvents(div);

    // Hide menu
    document.getElementById('shape-menu').style.display = 'none';
}
};

function attachShapeEvents(el) {
    el.addEventListener('mousedown', shapeMouseDown);
    el.addEventListener('touchstart', shapeTouchStart, { passive: false });
}

function selectShape(el) {
    // Deselect all
    document.querySelectorAll('.draggable-shape').forEach(s => {
        s.classList.remove('selected');
        s.style.outline = 'none';
        // Hide handles inline
        s.querySelectorAll('.resize-handle').forEach(h => h.style.display = 'none');
    });

    selectedShape = el;
    if (el) {
        el.classList.add('selected');
        el.style.outline = '2px dashed #3b82f6';
        // Show handles inline
        el.querySelectorAll('.resize-handle').forEach(h => h.style.display = 'block');
    }
}

// Global deselect when clicking background
document.addEventListener('click', (e) => {
    if (e.target.id === 'note-content-wrapper') {
        selectShape(null);
    }
});

function shapeMouseDown(e) {
    // console.log("Shape Mouse Down!", e.target);
    const shape = e.target.closest('.draggable-shape');
    if (!shape) return;

    // Prevent default only if not clicking textarea (to allow focus)
    if (e.target.tagName !== 'TEXTAREA') {
        e.preventDefault();
    }

    selectShape(shape);

    if (e.target.classList.contains('resize-handle')) {
        isResizing = true;
        currentResizeHandle = e.target.getAttribute('data-handle');
        startX = e.clientX;
        startY = e.clientY;
        startWidth = parseInt(document.defaultView.getComputedStyle(shape).width, 10);
        startHeight = parseInt(document.defaultView.getComputedStyle(shape).height, 10);
        // console.log("Resizing started", currentResizeHandle);

        document.addEventListener('mousemove', shapeResizeMove);
        document.addEventListener('mouseup', shapeResizeUp);
    } else {
        isDragging = true;
        startX = e.clientX;
        startY = e.clientY;
        startLeft = parseInt(shape.style.left || 0, 10); // Use inline style preferrably
        startTop = parseInt(shape.style.top || 0, 10);

        // Fix for NaN if style is empty but computed exists (shouldn't happen with our insert)
        if (isNaN(startLeft)) startLeft = shape.offsetLeft;
        if (isNaN(startTop)) startTop = shape.offsetTop;

        // console.log("Dragging started", startLeft, startTop);

        document.addEventListener('mousemove', shapeDragMove);
        document.addEventListener('mouseup', shapeDragUp);
    }
}

function shapeDragMove(e) {
    if (!isDragging || !selectedShape) return;
    const dx = e.clientX - startX;
    const dy = e.clientY - startY;
    selectedShape.style.left = (startLeft + dx) + 'px';
    selectedShape.style.top = (startTop + dy) + 'px';
}

function shapeDragUp() {
    isDragging = false;
    document.removeEventListener('mousemove', shapeDragMove);
    document.removeEventListener('mouseup', shapeDragUp);
}

function shapeResizeMove(e) {
    if (!isResizing || !selectedShape) return;
    const dx = e.clientX - startX;
    const dy = e.clientY - startY;

    // Basic Resize (SE, SW, NE, NW Logic)
    // Simplify to width/height for now to ensure stability
    if (currentResizeHandle.includes('e')) selectedShape.style.width = Math.max(50, startWidth + dx) + 'px';
    if (currentResizeHandle.includes('s')) selectedShape.style.height = Math.max(50, startHeight + dy) + 'px';

    // For icon scaling
    const icon = selectedShape.querySelector('i');
    if (icon) {
        // Font size relative to container
        // const minDim = Math.min(parseInt(selectedShape.style.width), parseInt(selectedShape.style.height));
        // icon.style.fontSize = (minDim * 0.8) + 'px'; 
        // Actually 100% width/height in CSS handles it generally if display flex
    }
}

function shapeResizeUp() {
    isResizing = false;
    document.removeEventListener('mousemove', shapeResizeMove);
    document.removeEventListener('mouseup', shapeResizeUp);
}

// Touch Support
function shapeTouchStart(e) {
    if (e.touches.length > 1) return;
    const touch = e.touches[0];
    const fakeEvent = {
        target: e.target,
        clientX: touch.clientX,
        clientY: touch.clientY,
        stopPropagation: () => e.stopPropagation(),
        preventDefault: () => e.preventDefault(),
        // Mock closest
        closest: (sel) => e.target.closest(sel)
    };

    shapeMouseDown(fakeEvent);

    const touchMove = (tm) => {
        const t = tm.touches[0];
        const fe = { clientX: t.clientX, clientY: t.clientY };
        if (isDragging) shapeDragMove(fe);
        if (isResizing) shapeResizeMove(fe);
    };

    const touchEnd = () => {
        shapeDragUp();
        shapeResizeUp();
        document.removeEventListener('touchmove', touchMove);
        document.removeEventListener('touchend', touchEnd);
    };

    document.addEventListener('touchmove', touchMove, { passive: false });
    document.addEventListener('touchend', touchEnd);
}


window.closeModal = function () {
    const modal = document.getElementById('note-modal');
    if (modal) modal.style.display = 'none';
};

window.saveNote = async function () {
    console.log("Kaydediliyor...");
    const titleInput = document.getElementById('note-title-input'); // Fixed ID
    const contentInput = document.getElementById('note-content');
    const categoryInput = document.getElementById('note-category-select'); // Fixed ID
    const subCategoryInput = document.getElementById('note-subcategory-input');
    const noteIdInput = document.getElementById('note-id'); // Need to check if this exists in HTML

    const title = titleInput ? titleInput.value : '';
    const content = contentInput ? contentInput.value : '';
    const category = categoryInput ? categoryInput.value : 'genel';
    const subCategory = subCategoryInput ? subCategoryInput.value : ''; // Fixed self-reference
    const noteId = noteIdInput ? noteIdInput.value : null;

    if (!title && !content && currentAttachments.length === 0) {
        alert('Lütfen boş not kaydetmeyin.');
        return;
    }

    const noteData = {
        id: noteId || Date.now().toString(),
        title: title || 'Başlıksız',
        content: content,
        category: category,
        subCategory: (category === 'egitim') ? subCategory : '',
        type: currentType, // 'text', 'drawing', etc.
        attachments: currentAttachments,
        createdAt: noteId ? (notes.find(n => n.id === noteId)?.createdAt || new Date().toISOString()) : new Date().toISOString(),
        isFavorite: noteId ? (notes.find(n => n.id === noteId)?.isFavorite || false) : false
    };

    try {
        // alert("Veritabanına yazılıyor..."); // Debug
        await setDoc(doc(db, "notes", noteData.id), noteData);
        alert("Not Başarıyla Kaydedildi! (ID: " + noteData.id + ")");
        window.closeModal();
    } catch (e) {
        console.error("Kaydetme hatası:", e);
        alert("KAYDETME HATASI: " + e.message);
    }
};

window.deleteNote = async function (id) {
    if (confirm('Bu notu silmek istediğinize emin misiniz?')) {
        try {
            await deleteDoc(doc(db, "notes", id));
        } catch (e) {
            console.error(e);
            alert("Silinemedi: " + e.message);
        }
    }
};

window.filterByCategory = function (category, event) {
    console.log("Filtreleniyor:", category);
    if (event) {
        // Reset all styles
        document.querySelectorAll('.cat-item').forEach(el => el.style.background = 'rgba(255,255,255,0.02)');
        // Highlight current
        // Since we attached listener to div, 'event.currentTarget' is safe
        if (event.currentTarget) {
            const info = categoryLabels[category];
            event.currentTarget.style.background = (info ? info.bg : 'rgba(255,255,255,0.1)');
        }
    }
    currentCategory = category;
    currentSubCategory = null;
    renderNotes();
    updateSidebarSubMenu();
    updateContextActions();

    // Auto-close sidebar on mobile
    if (window.innerWidth <= 768) {
        const sidebar = document.querySelector('.sidebar');
        if (sidebar && sidebar.classList.contains('active')) {
            sidebar.classList.remove('active');
        }
    }
};

window.filterBySub = function (sub, event) {
    if (event) event.stopPropagation();
    currentSubCategory = sub;
    renderNotes();

    // Auto-close sidebar on mobile
    if (window.innerWidth <= 768) {
        const sidebar = document.querySelector('.sidebar');
        if (sidebar && sidebar.classList.contains('active')) {
            sidebar.classList.remove('active');
        }
    }
};

window.openGroupNewNote = function (groupName, e) {
    e.stopPropagation();
    currentSubCategory = groupName;
    renderNotes();
    if (currentCategory !== 'egitim') {
        currentCategory = 'egitim';
    }
    window.openModal();
};

window.deleteGroup = async function (groupName, e) {
    e.stopPropagation();
    if (confirm(`"${groupName}" grubunu silmek istediğinize emin misiniz?`)) {
        const newGroups = educationGroups.filter(g => g !== groupName);
        try {
            await setDoc(doc(db, "metadata", "groups"), { list: newGroups });
        } catch (e) {
            console.error(e);
        }
    }
};

window.createNewGroup = async function (e) {
    e.stopPropagation();
    const name = prompt("Yeni Grup Adı:");
    if (name && name.trim()) {
        const cleanName = name.trim();
        if (!educationGroups.includes(cleanName)) {
            const newGroups = [...educationGroups, cleanName];
            try {
                await setDoc(doc(db, "metadata", "groups"), { list: newGroups });
            } catch (e) {
                console.error(e);
                alert("Grup oluşturulamadı: " + e.message);
            }
        }
    }
};

// --- Internal Variables & Helpers ---
// let currentCategory = 'all'; // Moved to top
// let currentSubCategory = null; // Moved to top
let currentType = 'text';
let currentAttachments = [];

const categoryLabels = {
    'genel': { label: 'Genel', color: '#64748b', bg: 'rgba(100, 116, 139, 0.1)' },
    'is': { label: 'İş', color: '#a855f7', bg: 'rgba(168, 85, 247, 0.1)' },
    'gorev': { label: 'Görev', color: '#10b981', bg: 'rgba(16, 185, 129, 0.1)' },
    'fikir': { label: 'Fikir', color: '#f59e0b', bg: 'rgba(245, 158, 11, 0.1)' },
    'toplanti': { label: 'Toplantı', color: '#3b82f6', bg: 'rgba(59, 130, 246, 0.1)' },
    'karar': { label: 'Karar', color: '#ef4444', bg: 'rgba(239, 68, 68, 0.1)' },
    'egitim': { label: 'Eğitim', color: '#4f46e5', bg: 'rgba(79, 70, 229, 0.1)' },
    'finans': { label: 'Finans', color: '#059669', bg: 'rgba(5, 150, 105, 0.1)' }
};

// --- Filter & Sort Globals ---
let currentSort = 'date-desc';
let currentViewMode = 'grid';
let currentCategory = 'all';
let currentSubCategory = null;

// --- Helper Functions ---
window.setSort = function (mode) {
    currentSort = mode;
    console.log("Sıralama:", mode);
    // Update UI active state if needed
    document.querySelectorAll('.sort-option').forEach(el => el.classList.remove('active'));
    // Simple text match to highlight would go here, skipping for brevity
    renderNotes();
};

window.toggleViewMode = function (btn) {
    currentViewMode = currentViewMode === 'grid' ? 'list' : 'grid';
    // Update Icon
    const icon = btn.querySelector('i');
    if (currentViewMode === 'list') {
        icon.className = 'fa-solid fa-bars';
        btn.innerHTML = '<i class="fa-solid fa-bars"></i> Liste';
    } else {
        icon.className = 'fa-solid fa-border-all';
        btn.innerHTML = '<i class="fa-solid fa-border-all"></i> Pano';
    }
    renderNotes();
};

window.setQuickFilter = function (type, btn) {
    // UI Update
    document.querySelectorAll('.pill').forEach(p => p.classList.remove('active'));
    btn.classList.add('active');

    // Logic
    if (type === 'all') {
        currentCategory = 'all';
    } else if (type === 'kisisel') {
        currentCategory = 'kisisel_filter'; // Special flag handled in render
    } else {
        currentCategory = 'diger_filter';   // Special flag
    }
    currentSubCategory = null;
    renderNotes();
};

function renderNotes() {
    const container = document.getElementById('notes-container');
    if (!container) return;

    // Apply View Mode Class
    if (currentViewMode === 'list') {
        container.classList.add('list-view');
    } else {
        container.classList.remove('list-view');
    }

    // Filter
    let filtered = notes.filter(n => {
        if (currentCategory === 'all') return true;
        if (currentCategory === 'favorites') return n.isFavorite; // Handle favorites special case

        // Custom Quick Filters
        if (currentCategory === 'kisisel_filter') {
            // "Kişisel" maps to: genel, fikir, karar (Example logic)
            return ['genel', 'fikir', 'karar'].includes(n.category);
        }
        if (currentCategory === 'diger_filter') {
            // "Diğerleri" maps to anything ELSE
            return !['genel', 'fikir', 'karar', 'is', 'egitim'].includes(n.category);
        }

        // Standard Category Filter
        const catMatch = (currentCategory === 'all' || n.category === currentCategory);
        const subMatch = (currentCategory !== 'egitim' || !currentSubCategory || n.subCategory === currentSubCategory);
        return catMatch && subMatch;
    });

    // Sort
    filtered.sort((a, b) => {
        if (currentSort === 'date-desc') return new Date(b.createdAt) - new Date(a.createdAt);
        if (currentSort === 'date-asc') return new Date(a.createdAt) - new Date(b.createdAt);
        if (currentSort === 'az') return a.title.localeCompare(b.title);
        if (currentSort === 'za') return b.title.localeCompare(a.title);
        return 0;
    });

    container.innerHTML = filtered.map(note => createNoteCard(note)).join('');

    // Update listeners (Context actions etc.)
    updateSidebarSubMenu();
    updateContextActions();
}

function createNoteCard(note) {
    const date = new Date(note.createdAt).toLocaleDateString('tr-TR', { day: '2-digit', month: 'short', year: 'numeric' });
    const catInfo = categoryLabels[note.category] || categoryLabels['genel'];

    let previewContent = '';
    if (note.type === 'text') {
        previewContent = `<p class="note-preview">${note.content || ''}</p>`;
    } else if (note.type === 'image' || note.type === 'drawing') {
        previewContent = `<img src="${note.content}" style="width:100%; height: 150px; object-fit: cover; border-radius: 4px;">`;
    }

    return `
    <div class="note-card" onclick="loadNoteForEdit('${note.id}')">
        <div class="note-card-inner" style="display:flex; flex-direction:column; height:100%;">
            <div class="note-badge" style="background:${catInfo.bg}; color:${catInfo.color}; font-size: 0.65rem; padding: 2px 8px; border-radius: 100px; width: fit-content; margin-bottom: 0.5rem; font-weight: 600;">
                ${catInfo.label}
            </div>
            <div class="note-header" style="margin-bottom: 0.5rem;">
                <h3 class="note-title" style="font-size: 1rem; line-height:1.4;">${note.title}</h3>
                <button class="icon-btn" onclick="toggleFavorite(event, '${note.id}')" style="font-size: 0.85rem;">
                    <i class="${note.isFavorite ? 'fa-solid' : 'fa-regular'} fa-star" style="${note.isFavorite ? 'color: var(--primary-color);' : ''}"></i>
                </button>
            </div>
            <div class="note-preview" style="color: var(--text-muted); font-size: 0.85rem; line-height: 1.5; flex: 1; margin-bottom: 1.5rem;">
                ${note.subCategory ? `<div style="font-size:0.75rem; color:var(--primary-color); font-weight:600; margin-bottom:0.25rem;">${note.subCategory}</div>` : ''}
                ${previewContent}
            </div>
            <div class="note-footer" style="margin-top: auto; display: flex; align-items: center; justify-content: space-between; border-top: 1px solid rgba(255,255,255,0.03); padding-top: 1rem;">
                <div class="note-date" style="font-size: 0.75rem; color: var(--text-muted); font-weight: 500;">
                    ${date}
                </div>
            </div>
             <div class="note-actions" style="display: flex; gap: 0.5rem; margin-top: 1rem;">
                <button class="btn-secondary edit-note-btn" onclick="event.stopPropagation(); loadNoteForEdit('${note.id}')" style="flex: 1; padding:0.5rem; cursor:pointer;">Düzenle</button>
                <button class="btn-secondary delete-note-btn" onclick="event.stopPropagation(); window.deleteNote('${note.id}')" style="flex: 1; padding:0.5rem; color:#ef4444; cursor:pointer;">Sil</button>
            </div>
        </div>
    </div>`;
}

// Make globally accessible for onclick events in HTML
window.loadNoteForEdit = loadNoteForEdit;

function updateSidebarSubMenu() {
    const subMenu = document.getElementById('education-sub-menu');
    if (!subMenu) return;

    if (currentCategory === 'egitim') {
        const allSubs = new Set(educationGroups);
        notes.forEach(n => {
            if (n.category === 'egitim' && n.subCategory) allSubs.add(n.subCategory);
        });

        let html = `
        <div style="display:flex; justify-content:space-between; align-items:center; padding-right:0.5rem; margin-bottom:0.5rem;">
            <div class="sub-menu-label">GRUPLAR</div>
            <div onclick="createNewGroup(event)" style="font-size:0.7rem; cursor:pointer; opacity:0.7; padding:2px 6px; border-radius:4px; background:rgba(255,255,255,0.1);"><i class="fa-solid fa-plus"></i></div>
        </div>`;

        allSubs.forEach(sub => {
            const actionsHtml = `
                <div style="margin-left:auto; display:flex; align-items:center; gap:6px;">
                    <i class="fa-solid fa-pen-to-square" onclick="openGroupNewNote('${sub}', event)" title="Bu gruba yeni not" style="font-size:0.7rem; opacity:0; transition:opacity 0.2s; color:var(--text-main);"></i>
                    <i class="fa-solid fa-trash" onclick="deleteGroup('${sub}', event)" title="Grubu/Filtreyi Kaldır" style="font-size:0.7rem; opacity:0; transition:opacity 0.2s; color:#ef4444;"></i>
                </div>
            `;
            html += `
            <div class="sub-menu-item ${currentSubCategory === sub ? 'active' : ''}" onclick="filterBySub('${sub}', event)" 
                 onmouseover="this.querySelectorAll('.fa-trash, .fa-pen-to-square').forEach(el=>el.style.opacity=1)" 
                 onmouseout="this.querySelectorAll('.fa-trash, .fa-pen-to-square').forEach(el=>el.style.opacity=0)">
                <i class="fa-solid fa-folder-open"></i> 
                <span style="flex:1; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; margin-right:4px;">${sub}</span>
                ${actionsHtml}
            </div>`;
        });
        subMenu.innerHTML = html;
        subMenu.style.display = 'flex';
    } else {
        subMenu.style.display = 'none';
    }
}

function updateContextActions() {
    const container = document.getElementById('context-actions');
    if (!container) return;
    if (currentCategory && currentCategory !== 'all') {
        const catInfo = categoryLabels[currentCategory];
        container.innerHTML = `
            <button onclick="openModal()" style="background: ${catInfo.color}; color: white; border: none; padding: 0.5rem 1rem; border-radius: 8px; font-size: 0.85rem; display: flex; align-items: center; gap: 0.5rem; cursor: pointer; box-shadow: 0 4px 12px ${catInfo.color}40;">
                <i class="fa-solid fa-plus"></i> Yeni ${catInfo.label} Notu
            </button>`;
        container.style.display = 'flex';
    } else {
        container.style.display = 'none';
    }
}

function loadNoteForEdit(id) {
    const note = notes.find(n => n.id === id);
    if (!note) return;

    window.openModal(true);

    window.openModal(true);

    const titleInput = document.getElementById('note-title-input');
    if (titleInput) titleInput.value = note.title;

    // Check for both possible content IDs just in case
    const contentInput = document.getElementById('note-content') || document.getElementById('note-content-text');
    if (contentInput) contentInput.value = note.content;

    const catSelect = document.getElementById('note-category-select');
    if (catSelect) catSelect.value = note.category;

    const subInput = document.getElementById('note-subcategory-input');
    if (note.category === 'egitim') {
        subInput.style.display = 'block';
        subInput.value = note.subCategory || '';
    } else {
        subInput.style.display = 'none';
    }

    const wrapper = document.getElementById('note-content-wrapper');
    if (wrapper && note.backgroundColor) {
        wrapper.style.backgroundColor = note.backgroundColor;
        // Text color contrast check (simple)
        const isDark = (note.backgroundColor === '#000000' || note.backgroundColor === '#181b24');
        document.getElementById('note-content').style.color = isDark ? '#f8fafc' : '#1e293b';
    }

    currentAttachments = note.attachments || [];
    renderAttachments();
}

function renderAttachments() {
    const container = document.getElementById('attachments-preview');
    if (!container) return;
    container.innerHTML = currentAttachments.map((att, index) => `
        <div class="attachment-item" style="position:relative; display:inline-block; margin:5px;">
            ${att.type === 'image' || att.type === 'drawing' ?
            `<img src="${att.content}" style="height:60px; border-radius:4px;">` :
            `<div style="padding:10px; background:#333; border-radius:4px;"><i class="fa-solid fa-file"></i></div>`}
             <button onclick="removeAttachment(${index})" style="position:absolute; top:-5px; right:-5px; background:red; color:white; border:none; border-radius:50%; width:18px; height:18px; font-size:10px;">x</button>
        </div>
    `).join('');
}
window.removeAttachment = function (index) {
    currentAttachments.splice(index, 1);
    renderAttachments();
}

function switchView(type) {
    currentType = type;
    document.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active'));
    // Tab update logic relies on matching text or onclick if present
    const btnText = type === 'text' ? 'Metin' : (type === 'drawing' ? 'Çizim' : '');
    if (btnText) {
        Array.from(document.querySelectorAll('.tab-btn')).forEach(b => {
            if (b.innerText.includes(btnText)) b.classList.add('active');
        });
    }

    document.getElementById('text-editor').style.display = (type === 'text') ? 'block' : 'none';
    document.getElementById('editor-area-drawing').style.display = (type === 'drawing') ? 'block' : 'none';
}
window.switchView = switchView;


// --- Event Listeners Initialization ---
document.addEventListener('DOMContentLoaded', () => {
    console.log("DOM Yüklendi. Olay dinleyicileri ekleniyor...");

    // Category Click Listeners
    document.querySelectorAll('.cat-item').forEach(item => {
        item.addEventListener('click', (e) => {
            const cat = item.getAttribute('data-category');
            if (cat) window.filterByCategory(cat, e);
        });
    });

    // View Switcher Listeners
    const tabBtns = document.querySelectorAll('.tab-btn');
    if (tabBtns.length > 0) {
        tabBtns[0].addEventListener('click', () => switchView('text'));
        if (tabBtns[1]) tabBtns[1].addEventListener('click', () => switchView('drawing'));
    }

    // Close Modal Button
    const closeBtn = document.querySelector('.close-modal');
    if (closeBtn) {
        closeBtn.addEventListener('click', window.closeModal);
    }

    // Color Palette Listener
    // Color Palette Listener
    const paletteColors = document.querySelectorAll('.palette-color');
    paletteColors.forEach(color => {
        color.addEventListener('click', () => {
            // Remove active class from all
            paletteColors.forEach(c => c.classList.remove('active'));
            // Add active to clicked
            color.classList.add('active');

            const selectedColor = color.getAttribute('data-color');

            if (selectedShape) {
                // Apply to Shape
                // If shape has border (Square, Rectangle, Circle, Ellipse)
                if (selectedShape.style.border) {
                    selectedShape.style.borderColor = selectedColor;
                }

                // If shape has Icon (Arrow, Star, Heart)
                const icon = selectedShape.querySelector('i');
                if (icon) {
                    icon.style.color = selectedColor;
                }
            } else {
                // Apply to Background
                const textEditor = document.getElementById('note-content-wrapper');
                if (textEditor) {
                    textEditor.style.backgroundColor = selectedColor;
                    // Adjust text color for contrast
                    const isDark = (selectedColor === '#000000' || selectedColor === '#181b24');
                    document.getElementById('note-content').style.color = isDark ? '#f8fafc' : '#1e293b';
                }
            }
        });
    });

    // NEW NOTE BUTTON FIX (Targeting ID instead of class)
    const sidebarNewBtn = document.getElementById('btn-new-note');
    if (sidebarNewBtn) {
        sidebarNewBtn.addEventListener('click', () => {
            // Reset UI before opening
            if (document.getElementById('note-title-input')) document.getElementById('note-title-input').value = ''; // Fixed ID
            if (document.getElementById('note-content')) document.getElementById('note-content').value = '';
            if (document.getElementById('note-content-wrapper')) document.getElementById('note-content-wrapper').style.backgroundColor = 'transparent';
            // Also hide drawing if open
            if (window.switchView) window.switchView('text');

            console.log("Yeni Not butonuna basıldı");
            window.openModal();
        });
    }

    // SAVE NOTE BUTTON LISTENER
    const saveBtn = document.getElementById('btn-save-note');
    if (saveBtn) {
        saveBtn.addEventListener('click', window.saveNote);
    } else {
        console.error("Kaydet butonu bulunamadı! (#btn-save-note)");
    }

    // --- REAL-TIME DATA LISTENER (onSnapshot) ---
    console.log("Listener kuruluyor...");
    try {
        const q = query(collection(db, "notes"));
        const unsubscribe = onSnapshot(q, (snapshot) => {
            notes = [];
            snapshot.forEach((doc) => {
                notes.push({ id: doc.id, ...doc.data() });
            });
            console.log("Sunucudan veri geldi. Belge sayısı:", notes.length);

            // DEBUG ALERT FOR FIRST LOAD
            // alert("Veriler indirildi: " + notes.length + " adet.");

            // Update Stats (Corrected IDs)
            const countTotal = document.getElementById('count-total');
            if (countTotal) countTotal.innerText = notes.length;

            const countFav = document.getElementById('count-favorites');
            if (countFav) countFav.innerText = notes.filter(n => n.isFavorite).length;

            // Render
            renderNotes();
        }, (error) => {
            console.error("Veri okuma hatası:", error);
            alert("VERİ OKUMA HATASI: " + error.message); // Show error to user
        });
    } catch (err) {
        alert("Listener Hatası: " + err.message);
    }

    // Mobile Menu & Other Initializations (retained)
    const mobileMenuBtn = document.createElement('button');
    mobileMenuBtn.className = 'icon-btn mobile-only';
    mobileMenuBtn.innerHTML = '<i class="fa-solid fa-bars"></i>';
    mobileMenuBtn.style.cssText = 'position:fixed; top:1rem; left:1rem; z-index:900; background:var(--bg-card); padding:0.5rem; border-radius:8px; display:none;'; // Initially hidden, CSS will show it

    // Inject into body or header? Layout is flex. 
    // Better to handle in logic: If screen is small, clicking outside sidebar closes it

    // Let's add the button to the DOM if it doesn't exist
    if (!document.getElementById('mobile-menu-toggle')) {
        mobileMenuBtn.id = 'mobile-menu-toggle';
        document.body.appendChild(mobileMenuBtn);

        mobileMenuBtn.addEventListener('click', () => {
            document.querySelector('.sidebar').classList.toggle('active');
        });

        // Close sidebar when clicking outside
        document.addEventListener('click', (e) => {
            const sidebar = document.querySelector('.sidebar');
            if (sidebar.classList.contains('active') && !sidebar.contains(e.target) && e.target !== mobileMenuBtn && !mobileMenuBtn.contains(e.target)) {
                sidebar.classList.remove('active');
            }
        });
    }

    // Add CSS for the button dynamically if not in style.css
    // CSS Injection removed (moved to style.css)

    // --- DATA MIGRATION TOOL ---
    // --- DATA MIGRATION TOOL (FILE BASED) ---
    window.migrateFromFile = function () {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = '.json';
        input.onchange = (e) => {
            const file = e.target.files[0];
            if (!file) return;

            const reader = new FileReader();
            reader.onload = async (event) => {
                try {
                    const backup = JSON.parse(event.target.result);
                    console.log("Yedek dosyası okundu:", backup);

                    if (backup.notes && Array.isArray(backup.notes)) {
                        let count = 0;
                        for (const n of backup.notes) {
                            await setDoc(doc(db, "notes", n.id || Date.now().toString()), n);
                            count++;
                        }
                        alert(`${count} not başarıyla yüklendi!`);
                    }

                    if (backup.groups && Array.isArray(backup.groups)) {
                        await setDoc(doc(db, "metadata", "groups"), { list: backup.groups });
                        alert("Gruplar yüklendi!");
                    }

                    setTimeout(() => location.reload(), 1000);

                } catch (err) {
                    console.error(err);
                    alert("Dosya okunamadı: " + err.message);
                }
            };
            reader.readAsText(file);
        };
        input.click();
    };

    // Create Migration Button
    const migrationBtn = document.createElement('button');
    migrationBtn.innerText = "Yedek Dosyasını Yükle (Import)";
    migrationBtn.style.position = 'fixed';
    migrationBtn.style.bottom = '10px';
    migrationBtn.style.right = '10px';
    migrationBtn.style.zIndex = '9999';
    migrationBtn.style.padding = '10px';
    migrationBtn.style.background = '#059669'; // Green for import
    migrationBtn.style.color = 'white';
    migrationBtn.style.border = 'none';
    migrationBtn.style.borderRadius = '5px';
    migrationBtn.style.cursor = 'pointer';
    migrationBtn.style.boxShadow = '0 4px 6px rgba(0,0,0,0.1)';
    migrationBtn.style.fontWeight = 'bold';
    migrationBtn.onclick = window.migrateFromFile;
    document.body.appendChild(migrationBtn);

    // --- DEBUG BUTTON (Temporary) ---
    const debugBtn = document.createElement('button');
    debugBtn.innerText = "HATA AYIKLA (DEBUG)";
    debugBtn.style.cssText = "position:fixed; bottom:50px; right:10px; z-index:9999; background:red; color:white; padding:10px;";
    debugBtn.onclick = () => {
        const info = `
        Ekran Genişliği: ${window.innerWidth}
        Not Sayısı: ${notes.length}
        Sidebar Sınıfları: ${document.querySelector('.sidebar').className}
        Sidebar Genişlik: ${document.querySelector('.sidebar').getBoundingClientRect().width}
        Sidebar Left: ${getComputedStyle(document.querySelector('.sidebar')).left}
        Hata Var mı?: ${document.querySelector('.error-banner') ? 'Evet' : 'Hayır'}
        `;
        alert(info);
        // Force Toggle Sidebar
        document.querySelector('.sidebar').classList.toggle('active');
    };
    document.body.appendChild(debugBtn);

    // --- Mobile Navigation Logic ---
    window.showMobileContent = function () {
        if (window.innerWidth <= 768) {
            document.body.classList.add('mobile-view-active');
        }
    };

    window.showMobileMenu = function () {
        document.body.classList.remove('mobile-view-active');
    };

    // Update Listeners to Trigger View Change
    const originalFilterCat = window.filterByCategory;
    window.filterByCategory = function (cat, e) {
        originalFilterCat(cat, e);
        window.showMobileContent();
    };

    const originalFilterFav = window.filterByFavorites;
    window.filterByFavorites = function () {
        originalFilterFav();
        window.showMobileContent();
    };

    const originalSetQuick = window.setQuickFilter;
    window.setQuickFilter = function (type, btn) {
        originalSetQuick(type, btn);
        // Don't necessarily switch view for quick filters inside the content view?
        // Actually, user might be in content view using filter bar. 
        // If we force showMobileContent, it's fine (idempotent).
    };

    // New Note opening
    const originalOpenModal = window.openModal;
    window.openModal = function (editMode) {
        originalOpenModal(editMode);
        // No need to switch background view, modal covers all.
    };

    // --- Init ---
    document.addEventListener('DOMContentLoaded', () => {
        // Force Menu Mode on Load for Mobile
        if (window.innerWidth <= 768) {
            document.body.classList.remove('mobile-view-active'); // Ensure menu is shown
        }

        alert("Not Defterim v29 - Şekil Hatası DÜZELDİ! ✅🎨");
    });

    // --- Data Listeners ---
    // --- Duplicate Data Listener Removed ---

    onSnapshot(doc(db, "metadata", "groups"), (doc) => {
        if (doc.exists()) {
            educationGroups = doc.data().list || [];
        } else {
            educationGroups = [];
        }
        if (currentCategory === 'egitim') updateSidebarSubMenu();
    });

    // Modal Category Listener
    const modCatSelect = document.getElementById('note-category');
    if (modCatSelect) {
        modCatSelect.addEventListener('change', (e) => {
            const subInput = document.getElementById('note-subcategory-input');
            if (e.target.value === 'egitim') {
                subInput.style.display = 'block';
                const dataList = document.getElementById('group-suggestions');
                if (dataList) {
                    const allGroups = new Set(educationGroups);
                    notes.forEach(n => {
                        if (n.category === 'egitim' && n.subCategory) allGroups.add(n.subCategory);
                    });
                    dataList.innerHTML = Array.from(allGroups).map(g => `<option value="${g}">`).join('');
                }
            } else {
                subInput.style.display = 'none';
            }
        });
    }
});
