let taskData = {}; // This dictionary stores the task data. Keys are taskCreationTimes
let categoryMappings = {}; // Dictionary to store category name to emoji mappings
let selectedTaskId = null;
let sortType = 'dueSoonest';
let pinHighPriority = true;
let saveTimeout;
const delayTime = 800;
const categoryOrder = {};

// Main function to fetch JSON and populate the UI
function populateFromServer() {
  fetch('/tasks', { cache: "no-store" })
    .then(response => response.json())
    .then(data => {
      categoryMappings = data.categories; // Emoji to category mappings
      taskData = data.tasks; // Now data.tasks is already an object with taskCreationTime as keys

      // Populate the dropdown category selector
      const dropdown = document.getElementById('catSelect');
      dropdown.innerHTML = ''; // Clear existing options

      for (const [category, emoji] of Object.entries(categoryMappings)) {
        const option = document.createElement('option');
        option.value = category; // Set the value to the category name
        option.textContent = `${emoji} ${category}`; // Set the display text
        dropdown.appendChild(option); // Add the option to the dropdown
      }

      // Create a map of category order based on original JSON order (need this to make sure category sort order is consistent)
      Object.keys(categoryMappings).forEach((category, index) => {
        categoryOrder[category] = index + 1;
      });

      // Refresh the task table after populating category dropdown
      refreshTaskTable();
    })
    .catch(error => console.error('Error loading tasks:', error));
}

// Populate the task table based on local object "taskData"
function refreshTaskTable() {
  const tableBody = document.querySelector('#taskTable tbody');
  tableBody.innerHTML = ''; // Clear existing rows

  // Extract tasks and sort them based on the current sortType and pinHighPriority
  let tasks = Object.values(taskData).filter(task => task.taskCompletionTime === null); // Exclude completed tasks

  // Apply sorting
  tasks.sort((a, b) => {

    // Sort based on sortType
    switch (sortType) {
      case 'oldestFirst':
        return a.taskCreationTime - b.taskCreationTime;

      case 'newestFirst':
        return b.taskCreationTime - a.taskCreationTime;

      case 'dueSoonest':
        // Place tasks with no due dates (null) at the end
        return (a.taskDueTime === null ? (b.taskDueTime == null ? 0 : 1) : (b.taskDueTime == null ? -1 : a.taskDueTime - b.taskDueTime));

      case 'byCategory':
        const categoryIndexA = categoryOrder[a.taskCategory] || Infinity;
        const categoryIndexB = categoryOrder[b.taskCategory] || Infinity;
        return categoryIndexA - categoryIndexB;

      default:
        return 0;
    }
  });

  // Apply second sort for priority if applicable
  if (pinHighPriority) {
    tasks.sort((a, b) => {
      return b.taskPriority - a.taskPriority;
    })
  };

  // Populate table rows with sorted tasks
  for (const task of tasks) {
    const categoryEmoji = categoryMappings[task.taskCategory] || '❔';
    const priorityStyle = task.taskPriority > 0 ? 'font-weight: bold;' : '';
    const row = document.createElement('tr');
    row.innerHTML = `
    <td class="task-name" data-id="${task.taskCreationTime}" style="${priorityStyle}">
      ${categoryEmoji + '&nbsp;&nbsp;' + task.taskName}
    </td>
    <td style="display: none;">${task.taskCreationTime}</td>
    <td style="display: none;">${task.taskCategory}</td>
    <td style="display: none;">${task.taskPriority}</td>
    <td style="display: none;">${task.taskDueTime}</td>
    <td style="display: none;">${task.taskCompletionTime}</td>
    <td style="display: none;">${task.daysToResurrect}</td>
    `;
    tableBody.appendChild(row);

    // Select current task
    if (selectedTaskId !== null) {
      onTaskSelect(selectedTaskId);
    }
  }

  // Attach click listeners to each task row
  document.querySelectorAll('.task-name').forEach(cell => {
    cell.addEventListener('mousedown', (e) => {
      const taskId = e.target.getAttribute('data-id');
      onTaskSelect(taskId);
    });
  });
}

// Format taskData object as json and upload to server
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

// When a task item is clicked, update highlighting and form values
function onTaskSelect(taskId) {

  selectedTaskId = taskId;

  // Remove highlight from previously selected row
  document.querySelectorAll('.selected-item').forEach(row => row.classList.remove('selected-item'));

  // Find the clicked row
  const selectedRow = document.querySelector(`.task-name[data-id="${taskId}"]`);

  // Highlight the selected row
  if (selectedRow) {
    selectedRow.parentElement.classList.add('selected-item');

    // Display notes for the selected task
    const task = taskData[taskId];
    const notesBox = document.getElementById('notesBox');
    notesBox.value = task.taskNotes;

    // And due date (if it's null, make this an empty string
    const dueBox = document.getElementById('dueBox');
    dueBox.value = task.taskDueTime === null
      ? ''
      : millisecToDate(task.taskDueTime);

    // Priority
    const priorityBox = document.getElementById('prioritySelect');
    priorityBox.value = task.taskPriority;

    // Name
    const nameBox = document.getElementById('nameBox');
    nameBox.value = task.taskName;

    // Category
    const catBox = document.getElementById('catSelect');
    catBox.value = task.taskCategory;

    // Resurrect
    const resurrectBox = document.getElementById('resurrectBox');
    resurrectBox.value = task.daysToResurrect;
  }
}

// Save form changes to the local taskData object
function updateTaskDataFromInputs() {
  if (selectedTaskId !== null) { // Ensure a task is selected
    const task = taskData[selectedTaskId];

    task.taskName = document.getElementById('nameBox').value;
    task.taskCategory = document.getElementById('catSelect').value;
    task.taskPriority = Number(document.getElementById('prioritySelect').value);
    task.daysToResurrect = Number(document.getElementById('resurrectBox').value);
    task.taskNotes = document.getElementById('notesBox').value;
    task.taskDueTime = document.getElementById('dueBox').value === ''
      ? null
      : dateToMillisec(document.getElementById('dueBox').value);
  }
}

// Time conversion
function millisecToDate(timestamp) {
  const options = { year: 'numeric', month: 'short', day: 'numeric', timeZone: 'America/New_York' };
  const date = new Date(timestamp);
  return date.toLocaleDateString('en-GB', options);
}

// Time conversion
function dateToMillisec(dateString) {
  const options = { timeZone: 'America/New_York', year: 'numeric', month: 'short', day: 'numeric' };
  const localizedDateString = new Date(dateString).toLocaleString('en-US', options);
  const date = new Date(localizedDateString);
  return date.getTime();
}

// Days until
function daysUntil(timestamp) {
  return Math.round((timestamp - Date.now()) / 86400000)
}

// Add a new task to the taskData object (this bit doesn't do anything else)
function addNewTaskData() {
  const taskCreationTime = Date.now(); // Get the current timestamp

  // Add new task object to taskData
  taskData[taskCreationTime] = {
    taskCreationTime: taskCreationTime,
    taskName: "New thing",
    taskCategory: "idk",
    taskPriority: 0,
    taskDueTime: null,
    taskCompletionTime: null,
    taskNotes: "",
    daysToResurrect: 0
  };

  return taskCreationTime; // Return the taskCreationTime for selection
}

// Clear values from the form
function resetFormValues() {
  document.getElementById('nameBox').value = '';
  document.getElementById('catSelect').value = 'idk';
  document.getElementById('dueBox').value = '';
  document.getElementById('notesBox').value = '';
  document.getElementById('resurrectBox').value = 0;
  document.getElementById('prioritySelect').value = 0;
}

// The commonly-used save script
function fullSaveOperation() {
  updateTaskDataFromInputs(); // Writes to local object only
  saveTaskDataToServer(); // Async
  refreshTaskTable(); // Refresh GUI to reflect changes
}

//#############################################################################
// On page load:
document.addEventListener('DOMContentLoaded', async () => {

  // Due date picker
  const options = {
    formatter: (input, date) => {
      const options = { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'America/New_York' };
      input.value = date.toLocaleDateString('en-GB', options);
    },
    customDays: ['S', 'M', 'T', 'W', 'T', 'F', 'S'],
    customMonths: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'],
    onSelect: (instance, date) => {
      // Save to server if date is changed
      fullSaveOperation();
    }
  };
  duePicker = new datepicker(document.getElementById('dueBox'), options);

  // New button pressed
  document.getElementById('newBtn').addEventListener('click', function () {
    selectedTaskId = addNewTaskData();
    sortType = 'newestFirst';
    refreshTaskTable();
    document.getElementById('taskListContainer').scrollTop = 0;
  });

  // Clear due date button pressed
  document.getElementById('clearDue').addEventListener('click', function () {
    document.getElementById('dueBox').value = '';  // Clear the field
    fullSaveOperation();
  });

  // Done button pressed
  document.getElementById('doneBtn').addEventListener('click', function () {
    if (selectedTaskId !== null) { // Ensure a task is selected
      const task = taskData[selectedTaskId]; // Write change to local object
      task.taskCompletionTime = Date.now();
      saveTaskDataToServer();
      selectedTaskId = null;
      refreshTaskTable();
      resetFormValues();
    }
  });

  // pinHighPriority checkbox 
  document.getElementById('pinHighPriorityCheckbox').addEventListener('change', (event) => {
    pinHighPriority = event.target.checked;
    refreshTaskTable();
  });

  // Sort selector
  document.getElementById('sortSelect').addEventListener('change', function (event) {
    const selectedValue = event.target.value;

    switch (selectedValue) {
      case 'dueSoonest':
        sortType = 'dueSoonest';
        break;

      case 'newestFirst':
        sortType = 'newestFirst';
        break;

      case 'oldestFirst':
        sortType = 'oldestFirst';
        break;

      case 'byCategory':
        sortType = 'byCategory';
        break;

      default:
        console.warn('Unknown sort type selected');
        return; // exit without refreshing if value is unexpected
    }
    refreshTaskTable();
  });

  // Autosave on form changes -- I think this only catches changes to category, priority, resurrect; the other bits need their own
  const formContainer = document.getElementById("formContainer");
  formContainer.addEventListener("change", (event) => {
    // Filter out the "notes" field to handle its autosave separately
    if (event.target.id !== "notesBox" && event.target.id !== "nameBox") {
      fullSaveOperation();
    }
  });

  // Autosave on timeout after edits to notes field
  const notesBox = document.getElementById("notesBox");
  notesBox.addEventListener("input", () => {
    // Clear the existing timeout
    clearTimeout(saveTimeout);

    // Set a new timeout for the delay period
    saveTimeout = setTimeout(() => {
      fullSaveOperation();
    }, delayTime);
  });

  // Autosave on timeout after edits to name field
  const nameBox = document.getElementById("nameBox");
  nameBox.addEventListener("input", () => {
    // Clear the existing timeout
    clearTimeout(saveTimeout);

    // Set a new timeout for the delay period
    saveTimeout = setTimeout(() => {
      fullSaveOperation();
    }, delayTime);
  });

  document.getElementById('pinHighPriorityCheckbox').checked = true;
  document.getElementById('sortSelect').value = 'dueSoonest';
  resetFormValues();
  document.getElementById('taskListContainer').scrollTop = 0;
  populateFromServer();
});