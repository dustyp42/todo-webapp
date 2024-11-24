let taskData = {};
let categoryMappings = {};
let selectedTaskId = null;

function populateFromServer() {
    fetch('/tasks', { cache: "no-store" })
        .then(response => response.json())
        .then(data => {
            taskData = data.tasks;
            categoryMappings = data.categories;
            refreshTaskTable();
        })
        .catch(error => console.error('Error loading tasks:', error));
}

function refreshTaskTable() {
    let tasks = Object.values(taskData).filter(task => task.taskCompletionTime !== null);

    tasks.sort((a, b) => {
        b.taskCompletionTime - a.taskCompletionTime
    });

    const container = document.getElementById('taskContainer');
    container.innerHTML = '';

    tasks.forEach(task => {
        const taskDiv = document.createElement('div');
        taskDiv.classList.add('task-item');

        const taskName = document.createElement('span');
        taskName.textContent = task.taskName;
        taskName.addEventListener('click', () => showModal(task.taskCreationTime, task.taskName));
        taskDiv.appendChild(taskName);
        container.appendChild(taskDiv);
    });
}

async function saveTaskDataToServer() {

    console.log("now pushing data to server...");

    const jsonData = JSON.stringify({ lastModified: Date.now(), categories: categoryMappings, tasks: taskData }, null, 2);

    try {
        const response = await fetch('/tasks', {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json'
            },
            body: jsonData
        });

        if (!response.ok) {
            throw new Error('Failed to save tasks');
        }

        const data = await response.json();
        console.log(data.message); // Success message from the server
    } catch (error) {
        console.error('Error:', error);
    }
}

function showModal(taskId, taskName) {
    selectedTaskId = taskId;
    document.getElementById('modalTaskName').textContent = taskName;

    const modal = document.getElementById('modal');
    modal.showModal();
}

function restoreTask() {
    if (selectedTaskId !== null) {
        taskData[selectedTaskId].taskCompletionTime = null;
        saveTaskDataToServer();
        closeModal();
        refreshTaskTable();
    }
}

function deleteTask() {
    if (selectedTaskId !== null) {
        delete taskData[selectedTaskId];
        saveTaskDataToServer();
        closeModal();
        refreshTaskTable();
    }
}

function closeModal() {
    const modal = document.getElementById('modal');
    modal.close();
    selectedTaskId = null;
}

document.getElementById('restoreButton').addEventListener('click', restoreTask);
document.getElementById('deleteButton').addEventListener('click', deleteTask);
document.getElementById('cancelButton').addEventListener('click', closeModal);

document.addEventListener('DOMContentLoaded', populateFromServer);