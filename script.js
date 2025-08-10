class TodoApp {
    constructor() {
        this.tasks = [];
        this.currentTheme = 'light';
        this.selectedTasks = new Set();
        this.selectedTags = new Set();
        this.domRefs = {};

        // Initialize when DOM is ready
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', () => this.initialize());
        } else {
            this.initialize();
        }
    }

    initialize() {
        this.loadSavedData();
        this.cacheElements();
        this.initEventListeners();
        this.initDateTimePicker();
        this.applyTheme();
        this.render();
    }

    loadSavedData() {
        try {
            this.tasks = JSON.parse(localStorage.getItem('tasks')) || [];
            this.currentTheme = localStorage.getItem('theme') || 'light';
        } catch (error) {
            console.error('Error loading saved data:', error);
            this.tasks = [];
            this.currentTheme = 'light';
        }
    }

    cacheElements() {
        this.domRefs = {
            taskInput: document.getElementById('taskInput'),
            taskDateTime: document.getElementById('taskDateTime'),
            addTaskBtn: document.getElementById('addTaskBtn'),
            taskList: document.getElementById('taskList'),
            themeBtn: document.querySelector('[data-action="theme"]'),
            helpBtn: document.querySelector('[data-action="help"]'),
            calendarBtn: document.querySelector('[data-action="calendar"]'),
            statsBtn: document.querySelector('[data-action="stats"]'),
            taskCount: document.getElementById('taskCount'),
            calendarModal: document.getElementById('calendarModal'),
            helpModal: document.getElementById('helpModal'),
            statisticsModal: document.getElementById('statisticsModal')
        };
    }

    initEventListeners() {
        // Add Task
        this.domRefs.addTaskBtn?.addEventListener('click', () => this.addTask());
        this.domRefs.taskInput?.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') this.addTask();
        });

        // Theme Toggle
        this.domRefs.themeBtn?.addEventListener('click', () => this.toggleTheme());

        // Modals
        this.domRefs.calendarBtn?.addEventListener('click', () => this.showCalendar());
        this.domRefs.helpBtn?.addEventListener('click', () => this.showHelp());
        this.domRefs.statsBtn?.addEventListener('click', () => this.showStatistics());

        // Close modals on outside click
        document.querySelectorAll('.modal-overlay').forEach(modal => {
            modal.addEventListener('click', (e) => {
                if (e.target === modal) this.closeAllModals();
            });
        });
    }

    initDateTimePicker() {
        if (this.domRefs.taskDateTime) {
            flatpickr(this.domRefs.taskDateTime, {
                enableTime: true,
                dateFormat: "Y-m-d H:i",
                minDate: "today",
                defaultHour: new Date().getHours(),
                defaultMinute: new Date().getMinutes()
            });
        }
    }

    // Modal handling
    showCalendar() {
        this.closeAllModals();
        this.domRefs.calendarModal?.classList.remove('hidden');
        this.renderCalendar();
    }

    showHelp() {
        this.closeAllModals();
        this.domRefs.helpModal?.classList.remove('hidden');
    }

    showStatistics() {
        this.closeAllModals();
        this.updateStatistics();
        this.domRefs.statisticsModal?.classList.remove('hidden');
    }

    closeAllModals() {
        document.querySelectorAll('.modal-overlay').forEach(modal => {
            modal.classList.add('hidden');
        });
    }

    // Theme handling
    toggleTheme() {
        this.currentTheme = this.currentTheme === 'light' ? 'dark' : 'light';
        localStorage.setItem('theme', this.currentTheme);
        this.applyTheme();
    }

    applyTheme() {
        document.documentElement.setAttribute('data-theme', this.currentTheme);
        const themeIcon = this.domRefs.themeBtn?.querySelector('i');
        if (themeIcon) {
            themeIcon.className = this.currentTheme === 'light' ? 'fas fa-moon' : 'fas fa-sun';
        }
    }

    // Task management
    addTask() {
        const text = this.domRefs.taskInput?.value.trim();
        const datetime = this.domRefs.taskDateTime?.value;

        if (!this.domRefs.taskInput || !this.domRefs.taskDateTime) {
            console.error('Task input elements not found');
            return;
        }

        if (!text) {
            alert('Please enter a task description');
            return;
        }

        if (!datetime) {
            alert('Please select a date and time');
            return;
        }

        const newTask = {
            id: Date.now(),
            text,
            datetime,
            completed: false,
            createdAt: new Date().toISOString()
        };

        this.tasks.push(newTask);
        this.saveAndRender();

        // Clear inputs
        this.domRefs.taskInput.value = '';
        this.domRefs.taskDateTime.value = '';
    }

    updateStatistics() {
        const stats = {
            total: this.tasks.length,
            completed: this.tasks.filter(t => t.completed).length,
            pending: this.tasks.filter(t => !t.completed).length,
            overdue: this.tasks.filter(t => !t.completed && new Date(t.datetime) < new Date()).length
        };

        Object.entries(stats).forEach(([key, value]) => {
            const element = document.getElementById(`stats${key.charAt(0).toUpperCase() + key.slice(1)}Tasks`);
            if (element) {
                element.textContent = value.toString();
            }
        });
    }

    saveAndRender() {
        localStorage.setItem('tasks', JSON.stringify(this.tasks));
        this.render();
        this.updateStatistics();
    }

    render() {
        if (!this.domRefs.taskList) return;
        
        this.domRefs.taskList.innerHTML = '';
        this.tasks.forEach(task => {
            const taskElement = this.createTaskElement(task);
            this.domRefs.taskList.appendChild(taskElement);
        });

        if (this.domRefs.taskCount) {
            this.domRefs.taskCount.textContent = `${this.tasks.length} tasks`;
        }
    }

    createTaskElement(task) {
        const listItem = document.createElement('li');
        listItem.className = `task-item${task.completed ? ' completed' : ''}`;
        listItem.setAttribute('data-id', task.id);

        // Create checkbox
        const checkbox = document.createElement('input');
        checkbox.type = 'checkbox';
        checkbox.className = 'task-checkbox-input';
        checkbox.checked = task.completed;
        checkbox.addEventListener('change', () => {
            task.completed = !task.completed;
            this.saveAndRender();
        });

        // Create task text
        const taskText = document.createElement('span');
        taskText.className = 'task-text';
        taskText.textContent = task.text;

        // Create datetime display
        const taskDateTime = document.createElement('span');
        taskDateTime.className = 'task-datetime';
        const date = new Date(task.datetime);
        taskDateTime.innerHTML = `<i class="far fa-clock"></i> ${date.toLocaleString()}`;

        // Create action buttons
        const actions = document.createElement('div');
        actions.className = 'task-actions';

        // Edit button
        const editBtn = document.createElement('button');
        editBtn.className = 'edit-btn';
        editBtn.innerHTML = '<i class="fas fa-edit"></i>';
        editBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            this.handleEdit(task.id);
        });

        // Delete button
        const deleteBtn = document.createElement('button');
        deleteBtn.className = 'delete-btn';
        deleteBtn.innerHTML = '<i class="fas fa-trash-alt"></i>';
        deleteBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            if (confirm('Are you sure you want to delete this task?')) {
                this.tasks = this.tasks.filter(t => t.id !== task.id);
                this.saveAndRender();
            }
        });

        // Append all elements
        actions.appendChild(editBtn);
        actions.appendChild(deleteBtn);
        listItem.appendChild(checkbox);
        listItem.appendChild(taskText);
        listItem.appendChild(taskDateTime);
        listItem.appendChild(actions);

        return listItem;
    }

    // Also add this method to handle task editing
    handleEdit(taskId) {
        const task = this.tasks.find(t => t.id === taskId);
        if (!task) return;

        const newText = prompt('Edit task:', task.text);
        if (newText !== null && newText.trim() !== '') {
            task.text = newText.trim();
            this.saveAndRender();
        }
    }
}

// Initialize the app
const todoApp = new TodoApp();