class TodoApp {
    constructor() {
        // Wait for DOM to be ready before initializing
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', () => this.initialize());
        } else {
            this.initialize();
        }
    }

    initialize() {
        this.tasks = JSON.parse(localStorage.getItem('tasks')) || [];
        this.currentTheme = localStorage.getItem('theme') || 'light';
        this.selectedTasks = new Set();
    this.selectedTags = new Set(); // Track selected tags
        this.init();
    }

    init() {
        this.cacheElements();
        if (this.elementsLoaded()) {
            this.initEventListeners();
            this.applyTheme();
            this.render();
            this.initFlatpickr();
        } else {
            console.error('Some elements could not be found');
        }
    }

    elementsLoaded() {
        return this.elements.taskInput && 
               this.elements.taskDateTime && 
               this.elements.taskList && 
               this.elements.addTaskBtn;
    }

    cacheElements() {
        this.elements = {
            taskInput: document.getElementById('taskInput'),
            taskDateTime: document.getElementById('taskDateTime'),
            taskList: document.getElementById('taskList'),
            searchInput: document.getElementById('searchInput'),
            sortBy: document.getElementById('sortBy'),
            importFile: document.getElementById('importFile'),
            taskCount: document.getElementById('taskCount'),
            calendarModal: document.getElementById('calendarModal'), // Will be added in HTML
            calendar: document.getElementById('calendar'), // Will be added in HTML
            addTaskBtn: document.getElementById('addTaskBtn'),
            workTag: document.querySelector('.tag.work'),
            personalTag: document.querySelector('.tag.personal'),
            shoppingTag: document.querySelector('.tag.shopping'),
            calendarInline: document.getElementById('calendarInline'),
        };
    }

    initEventListeners() {
        // Only add listeners if elements exist
        if (this.elements.addTaskBtn) {
            this.elements.addTaskBtn.addEventListener('click', () => {
                console.log('Add button clicked');
                this.addTask();
            });
        }

        if (this.elements.taskInput) {
            this.elements.taskInput.addEventListener('keypress', (e) => {
                if (e.key === 'Enter') {
                    this.addTask();
                }
            });
        }

        
        if (this.elements.searchInput) this.elements.searchInput.addEventListener('input', () => this.render());
        if (this.elements.sortBy) this.elements.sortBy.addEventListener('change', () => this.render());
        if (this.elements.importFile) this.elements.importFile.addEventListener('change', (e) => this.handleFileImport(e));
        if (this.elements.taskList) {
            this.elements.taskList.addEventListener('dragover', (e) => this.handleDragOver(e));
            this.elements.taskList.addEventListener('dragend', () => this.handleDragEnd());
        }
        if (this.elements.workTag) this.elements.workTag.addEventListener('click', () => this.toggleTag('work'));
        if (this.elements.personalTag) this.elements.personalTag.addEventListener('click', () => this.toggleTag('personal'));
        if (this.elements.shoppingTag) this.elements.shoppingTag.addEventListener('click', () => this.toggleTag('shopping'));
    }

    // Core functionality methods
    addTask() {
        const text = this.elements.taskInput.value.trim();
        const datetime = this.elements.taskDateTime.value;

        if (!text) {
            alert('Please enter a task description');
            return;
        }
        if (!datetime) {
            alert('Please select a date and time');
            return;
        }

        // Add selected tags to the new task
        const tags = Array.from(this.selectedTags);

        const newTask = {
            id: Date.now(),
            text,
            datetime,
            completed: false,
            createdAt: new Date().toISOString(),
            tags
        };

        this.tasks.push(newTask);
        this.saveAndRender();
        this.elements.taskInput.value = '';
        this.elements.taskDateTime.value = '';
        this.updateStatistics();
        // Clear selected tags after adding
        this.selectedTags.clear();
        this.updateTagUI();
    }

    deleteTask(id) {
        this.tasks = this.tasks.filter(task => task.id !== id);
        this.saveAndRender();
        this.updateStatistics();
    }

    toggleComplete(id) {
        this.tasks = this.tasks.map(task =>
            task.id === id ? {...task, completed: !task.completed} : task
        );
        this.saveAndRender();
        this.updateStatistics();
    }

    editTask(id, newText, newDateTime) {
        this.tasks = this.tasks.map(task =>
            task.id === id ? {
                ...task,
                text: newText.trim(),
                datetime: newDateTime
            } : task
        );
        this.saveAndRender();
        this.updateStatistics();
    }

    // Theme management
    toggleTheme() {
        this.currentTheme = this.currentTheme === 'light' ? 'dark' : 'light';
        document.documentElement.setAttribute('data-theme', this.currentTheme);
        localStorage.setItem('theme', this.currentTheme);
    }

    applyTheme() {
        document.documentElement.setAttribute('data-theme', this.currentTheme);
    }

    // Drag and Drop functionality
    handleDragOver(e) {
        e.preventDefault();
        const afterElement = this.getDragAfterElement(e.clientY);
        const draggable = document.querySelector('.dragging');

        if (!afterElement) {
            this.elements.taskList.appendChild(draggable);
        } else {
            this.elements.taskList.insertBefore(draggable, afterElement);
        }
    }

    handleDragEnd() {
        const newTasks = [];
        Array.from(this.elements.taskList.children).forEach(child => {
            const taskId = parseInt(child.dataset.id);
            newTasks.push(this.tasks.find(t => t.id === taskId));
        });
        this.tasks = newTasks.filter(t => t);
        this.saveTasks();
    }

    getDragAfterElement(y) {
        const draggableElements = [...this.elements.taskList.querySelectorAll('.task-item:not(.dragging)')];
        return draggableElements.reduce((closest, child) => {
            const box = child.getBoundingClientRect();
            const offset = y - box.top - box.height / 2;
            return offset < 0 && offset > closest.offset
                ? { offset, element: child }
                : closest;
        }, { offset: Number.NEGATIVE_INFINITY }).element;
    }

    // Render methods
    render() {
        this.elements.taskList.innerHTML = '';
        const filteredTasks = this.getFilteredTasks();
        const sortedTasks = this.sortTasks(filteredTasks);

        sortedTasks.forEach(task => {
            const taskElement = this.createTaskElement(task);
            this.elements.taskList.appendChild(taskElement);
        });
        this.updateStats();
        this.initDragEvents();
    }

    createTaskElement(task) {
        const li = document.createElement('li');
        li.className = `task-item${this.selectedTasks.has(task.id) ? ' selected' : ''}${task.completed ? ' completed' : ''}`;
        li.dataset.id = task.id;
        li.draggable = true;

        const dueDate = new Date(task.datetime);
        const now = new Date();
        const isOverdue = dueDate < now && !task.completed;

        const checkbox = document.createElement('input');
        checkbox.type = 'checkbox';
        checkbox.checked = task.completed;
        checkbox.classList.add('task-checkbox-input');
        checkbox.addEventListener('change', (e) => {
            e.stopPropagation();
            this.toggleComplete(task.id);
        });

        const taskCheckbox = document.createElement('label');
        taskCheckbox.classList.add('task-checkbox');
        taskCheckbox.appendChild(checkbox);
        const checkMarkSpan = document.createElement('span');
        checkMarkSpan.classList.add('checkmark');
        taskCheckbox.appendChild(checkMarkSpan);

        li.innerHTML = `
            <div class="task-content">
                <span class="task-text">${task.text}</span>
            </div>
            <div class="task-meta">
                <span class="task-datetime ${isOverdue ? 'overdue' : ''}">
                    <i class="fas fa-clock"></i>
                    ${this.formatDateTime(task.datetime)}
                </span>
                <button class="icon-btn" onclick="todoApp.handleEdit(${task.id});event.stopPropagation();">
                    <i class="fas fa-edit"></i>
                </button>
                <button class="icon-btn" onclick="todoApp.deleteTask(${task.id});event.stopPropagation();">
                    <i class="fas fa-trash"></i>
                </button>
            </div>
        `;
        li.insertBefore(taskCheckbox, li.firstChild);

        // Only toggle selection when clicking on the task-content (not buttons or checkboxes)
        li.querySelector('.task-content').addEventListener('click', (e) => {
            this.toggleTaskSelection(task.id, li);
        });

        // Add tags to the task element
        if (task.tags && task.tags.length > 0) {
            const tagsContainer = document.createElement('div');
            tagsContainer.className = "task-tags";
            task.tags.forEach(tag => {
                const tagSpan = document.createElement('span');
                tagSpan.className = 'task-tag';
                tagSpan.textContent = tag;
                tagsContainer.appendChild(tagSpan);
            });
            li.querySelector('.task-content').appendChild(tagsContainer);
        }

        return li;
    }

    // Helper methods
    getFilteredTasks() {
        const searchTerm = this.elements.searchInput.value.toLowerCase();
        return this.tasks.filter(task => {
            const matchesSearch = task.text.toLowerCase().includes(searchTerm);
            return matchesSearch
        });
    }

    sortTasks(tasks) {
        const sortBy = this.elements.sortBy.value;
        return [...tasks].sort((a, b) => {
            switch(sortBy) {
                case 'datetime':
                    return new Date(a.datetime) - new Date(b.datetime);
                case 'priority':
                    return this.isOverdue(b.datetime) - this.isOverdue(a.datetime);
                default:
                    return new Date(b.createdAt) - new Date(a.createdAt);
            }
        });
    }

    updateStats() {
        const totalTasks = this.tasks.length;
        const completedTasks = this.tasks.filter(t => t.completed).length;
        this.elements.taskCount.textContent =
            `${totalTasks} tasks (${completedTasks} completed)`;
        this.updateProgressBar(totalTasks, completedTasks);
    }

    updateProgressBar(total, completed) {
        const progressFill = document.querySelector('.progress-fill');
        if (total === 0) {
            progressFill.style.width = '0%';
        } else {
            const percentage = (completed / total) * 100;
            progressFill.style.width = `${percentage}%`;
        }
    }

    // File handling
    exportTasks() {
        const data = JSON.stringify(this.tasks);
        const blob = new Blob([data], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'tasks.json';
        a.click();
    }

    handleFileImport(e) {
        const file = e.target.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const importedTasks = JSON.parse(e.target.result);
                this.tasks = importedTasks;
                this.saveAndRender();
            } catch {
                alert('Invalid file format');
            }
        };
        reader.readAsText(file);
    }

    // Utility methods
    isToday(datetimeString) {
        if (!datetimeString) return false;
        const date = new Date(datetimeString);
        const today = new Date();
        return date.toDateString() === today.toDateString();
    }

    isOverdue(datetimeString) {
        if (!datetimeString) return false;
        const dueDate = new Date(datetimeString);
        return dueDate < new Date() && !this.isToday(datetimeString);
    }

    formatDateTime(datetimeString) {
        const date = new Date(datetimeString);
        return date.toLocaleString('en-US', {
            weekday: 'short',
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
            hour12: true
        });
    }

    handleEdit(id) {
        const task = this.tasks.find(t => t.id === id);
        const editForm = `
            <div class="edit-modal">
                <h3>Edit Task</h3>
                <input type="text" id="editText" value="${task.text}" class="edit-input">
                <input type="datetime-local" id="editDateTime"
                    value="${task.datetime.replace('Z', '')}"
                    class="edit-input">
                <div class="modal-buttons">
                    <button onclick="todoApp.saveEdit(${id})">Save</button>
                    <button onclick="todoApp.closeEditModal()">Cancel</button>
                </div>
            </div>
        `;

        const modal = document.createElement('div');
        modal.className = 'modal-overlay';
        modal.innerHTML = editForm;
        document.body.appendChild(modal);
    }

    saveEdit(id) {
        const newText = document.getElementById('editText').value.trim();
        const newDateTime = document.getElementById('editDateTime').value;

        if (!newText || !newDateTime) {
            alert('Please fill in all fields');
            return;
        }

        this.editTask(id, newText, newDateTime);
        this.closeEditModal();
    }

    closeEditModal() {
        const modal = document.querySelector('.modal-overlay');
        if (modal) modal.remove();
    }

    // State management
    saveTasks() {
        localStorage.setItem('tasks', JSON.stringify(this.tasks));
    }

    saveAndRender() {
        this.saveTasks();
        this.render();
    }

    initDragEvents() {
        document.querySelectorAll('.task-item').forEach(item => {
            item.addEventListener('dragstart', () => item.classList.add('dragging'));
            item.addEventListener('dragend', () => item.classList.remove('dragging'));
        });
    }

    clearCompleted() {
        this.tasks = this.tasks.filter(t => !t.completed);
        this.saveAndRender();
        this.updateStatistics();
    }

    // Tag Management
    toggleTag(tagName) {
        const tagBtn = this.elements[`${tagName}Tag`];
        if (this.selectedTags.has(tagName)) {
            this.selectedTags.delete(tagName);
            tagBtn.classList.remove('selected');
        } else {
            this.selectedTags.add(tagName);
            tagBtn.classList.add('selected');
        }
    }

    updateTagUI() {
        ['work', 'personal', 'shopping'].forEach(tag => {
            const tagBtn = this.elements[`${tag}Tag`];
            if (this.selectedTags.has(tag)) {
                tagBtn.classList.add('selected');
            } else {
                tagBtn.classList.remove('selected');
            }
        });
    }

    toggleTaskSelection(taskId, listItem) {
        if (this.selectedTasks.has(taskId)) {
            this.selectedTasks.delete(taskId);
            listItem.classList.remove('selected')
        } else {
            this.selectedTasks.add(taskId)
            listItem.classList.add('selected')
        }
    }

    bulkActions(action) {
        if (this.selectedTasks.size === 0) {
            alert('No tasks selected');
            return;
        }

        if (action === 'complete') {
            this.tasks = this.tasks.map(task =>
                this.selectedTasks.has(task.id) ? { ...task, completed: true } : task
            );
        } else if (action === 'delete') {
            this.tasks = this.tasks.filter(task => !this.selectedTasks.has(task.id))
        }

        this.selectedTasks.clear()
        this.saveAndRender();
        this.updateStatistics(); 
    }

    showCalendar() {
        this.elements.calendarModal.classList.remove('hidden');
        this.renderCalendar();
    }

    hideCalendar() {
        this.elements.calendarModal.classList.add('hidden');
    }

    // In the TodoApp class, keep only these versions of the methods:

showHelp() {
    this.hideAllModals(); // First hide any open modals
    document.getElementById('helpModal').classList.remove('hidden');
}

hideHelp() {
        document.getElementById('helpModal').classList.add('hidden');

}

showStatistics() {
    this.hideAllModals(); // First hide any open modals
    // this.updateStatistics();
    document.getElementById('statisticsModal').classList.remove('hidden');
}

hideStatistics() {
    document.getElementById('statisticsModal').classList.add('hidden');
}
hideAllModals() {
    document.querySelectorAll('.modal-overlay').forEach(modal => {
        modal.classList.add('hidden');
    });
}
updateStatistics() {
    const totalTasks = this.tasks.length;
    const completedTasks = this.tasks.filter(t => t.completed).length;
    const pendingTasks = totalTasks - completedTasks;
    const workTasks = this.tasks.filter(t => t.tags.includes('work')).length;
    const personalTasks = this.tasks.filter(t => t.tags.includes('personal')).length;
    const shoppingTasks = this.tasks.filter(t => t.tags.includes('shopping')).length;
    const overdueTasks = this.tasks.filter(t => 
        !t.completed && new Date(t.datetime) < new Date()
    ).length;

     // Update the DOM
    if (document.getElementById('statsTotalTasks')) {
        document.getElementById('statsTotalTasks').textContent = totalTasks;
        document.getElementById('statsCompletedTasks').textContent = completedTasks;
        document.getElementById('statsPendingTasks').textContent = pendingTasks;
        document.getElementById('statsWorkTasks').textContent = workTasks;
        document.getElementById('statsPersonalTasks').textContent = personalTasks;
        document.getElementById('statsShoppingTasks').textContent = shoppingTasks;
        document.getElementById('statsOverdueTasks').textContent = overdueTasks;
    }
     // Also update the progress bar
    this.updateProgressBar(totalTasks, completedTasks);
}

    toggleCalendarInline() {
        this.elements.calendarInline.classList.toggle('hidden');
        if (!this.elements.calendarInline.classList.contains('hidden')) {
            this.renderCalendarInline();
        }
    }

    showCalendarInline() {
        this.elements.calendarInline.classList.remove('hidden');
        this.renderCalendarInline();
    }

    hideCalendarInline() {
        this.elements.calendarInline.classList.add('hidden');
    }

    renderCalendar() {
        const calendarDiv = this.elements.calendar;
        if (!calendarDiv) {
            console.error("Calendar container not found.");
            return;
        }
        calendarDiv.innerHTML = ""; // Clear existing content
        const now = new Date();
        const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
        const firstDayOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).getDay();
        const calendarTable = document.createElement('table');
        calendarTable.classList.add('calendar-table');
        const headerRow = document.createElement('tr');
        const daysOfWeek = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
        daysOfWeek.forEach(day => {
            const headerCell = document.createElement('th');
            headerCell.textContent = day;
            headerRow.appendChild(headerCell);
        });
        calendarTable.appendChild(headerRow);

        let dayCounter = 1;
        for (let week = 0; week < 6; week++) { // Maximum 6 rows
            const row = document.createElement('tr');
            for (let day = 0; day < 7; day++) {
                const cell = document.createElement('td');
                if (week === 0 && day < firstDayOfMonth) {
                    // Empty cells before the first day
                } else if (dayCounter <= daysInMonth) {
                    cell.textContent = dayCounter;
                    const date = new Date(now.getFullYear(), now.getMonth(), dayCounter);
                    const tasksForDay = this.tasks.filter(task =>
                        new Date(task.datetime).toDateString() === date.toDateString()
                    );

                    if (tasksForDay.length > 0) {
                        cell.classList.add('task-day');
                        cell.title = tasksForDay.map(t => t.text).join('\n'); // Display tasks on hover
                    }

                    dayCounter++;
                }
                row.appendChild(cell);
            }
            calendarTable.appendChild(row);
            if(dayCounter > daysInMonth) {
                break;
            }
        }
        calendarDiv.appendChild(calendarTable);
    }

    renderCalendarInline() {
        const calendarDiv = this.elements.calendarInline;
        if (!calendarDiv) return;
        calendarDiv.innerHTML = "";
        const now = new Date();
        const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
        const firstDayOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).getDay();
        const calendarTable = document.createElement('table');
        calendarTable.classList.add('calendar-table');
        const headerRow = document.createElement('tr');
        const daysOfWeek = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
        daysOfWeek.forEach(day => {
            const headerCell = document.createElement('th');
            headerCell.textContent = day;
            headerRow.appendChild(headerCell);
        });
        calendarTable.appendChild(headerRow);

        let dayCounter = 1;
        for (let week = 0; week < 6; week++) {
            const row = document.createElement('tr');
            for (let day = 0; day < 7; day++) {
                const cell = document.createElement('td');
                if (week === 0 && day < firstDayOfMonth) {
                    // Empty cells before the first day
                } else if (dayCounter <= daysInMonth) {
                    cell.textContent = dayCounter;
                    const date = new Date(now.getFullYear(), now.getMonth(), dayCounter);
                    const tasksForDay = this.tasks.filter(task =>
                        new Date(task.datetime).toDateString() === date.toDateString()
                    );
                    if (tasksForDay.length > 0) {
                        cell.classList.add('task-day');
                        cell.title = tasksForDay.map(t => t.text).join('\n');
                    }
                    dayCounter++;
                }
                row.appendChild(cell);
            }
            calendarTable.appendChild(row);
            if(dayCounter > daysInMonth) break;
        }
        calendarDiv.appendChild(calendarTable);
    }

    initFlatpickr() {
        flatpickr(this.elements.taskDateTime, {
            enableTime: true,
            dateFormat: "Y-m-d H:i",
        });
    }
}

// Initialize the app and make it globally available
let todoApp;
document.addEventListener('DOMContentLoaded', () => {
    todoApp = new TodoApp();
    window.todoApp = todoApp;
});

// Define global functions
// Define global functions
window.toggleTheme = () => todoApp.toggleTheme();
window.clearCompleted = () => todoApp.clearCompleted();
window.exportTasks = () => todoApp.exportTasks();
window.showCalendar = () => todoApp.showCalendar();
window.hideCalendar = () => todoApp.hideCalendar();
window.bulkActions = (action) => todoApp.bulkActions(action);
window.toggleCalendarInline = () => todoApp.toggleCalendarInline();
window.showHelp = () => todoApp.showHelp();
window.hideHelp = () => todoApp.hideHelp();
window.showStatistics = () => todoApp.showStatistics();
window.hideStatistics = () => todoApp.hideStatistics();
